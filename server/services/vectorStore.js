const { GoogleGenerativeAI } = require("@google/generative-ai");
const Chunk = require("../models/Chunk");
const { extractKeywords, STOPWORDS } = require("./transcriptService");

// In-memory cache for fast sub-millisecond retrieval: videoId -> Array of chunk objects with embeddings
let memoryVectorStores = {};

/**
 * Returns Gemini Embedding model instance
 */
function getEmbeddingsModel() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: "gemini-embedding-2" });
}

/**
 * Calculates standard Cosine Similarity between two numerical vectors
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Sleep helper utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executes an async operation with automated exponential backoff retry on 429 rate limits
 */
async function withRetry(fn, maxRetries = 4, initialDelayMs = 2500) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      const isRateLimit = error.status === 429 || 
                          error.message?.includes('429') || 
                          error.message?.includes('Quota exceeded') ||
                          error.message?.includes('Too Many Requests');

      if (isRateLimit && attempt <= maxRetries) {
        // Check if error response included retryDelay
        let delay = initialDelayMs * Math.pow(2, attempt - 1);
        if (error.errorDetails) {
          for (const d of error.errorDetails) {
            if (d.retryDelay) {
              const seconds = parseInt(d.retryDelay.replace('s', ''), 10);
              if (!isNaN(seconds)) delay = Math.max(delay, (seconds + 1) * 1000);
            }
          }
        }
        console.warn(`[Gemini API Rate Limit] Quota hit. Pausing for ${(delay / 1000).toFixed(1)}s before retry ${attempt}/${maxRetries}...`);
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
}

/**
 * BM25 Sparse Keyword Retrieval Engine
 * @param {Array<Object>} docs Collection of chunk documents
 * @param {string} query Search query string
 * @param {number} k1 Term frequency saturation parameter (default: 1.5)
 * @param {number} b Document length normalization parameter (default: 0.75)
 * @returns {Array<{index: number, score: number}>}
 */
function computeBM25Scores(docs, query, k1 = 1.5, b = 0.75) {
  const queryTokens = extractKeywords(query);
  if (queryTokens.length === 0 || docs.length === 0) {
    return docs.map((_, i) => ({ index: i, score: 0 }));
  }

  const N = docs.length;
  const totalLength = docs.reduce((acc, d) => acc + (d.wordCount || d.pageContent?.split(/\s+/).length || 1), 0);
  const avgdl = totalLength / N || 1;

  const dfMap = {};
  for (const token of queryTokens) {
    let count = 0;
    for (const doc of docs) {
      const text = (doc.pageContent || doc.text || '').toLowerCase();
      if (text.includes(token)) {
        count++;
      }
    }
    dfMap[token] = count;
  }

  const scores = docs.map((doc, idx) => {
    const text = (doc.pageContent || doc.text || '').toLowerCase();
    const docLength = doc.wordCount || text.split(/\s+/).length || 1;
    let score = 0;

    for (const token of queryTokens) {
      const df = dfMap[token] || 0;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));

      const regex = new RegExp(`\\b${token}\\b`, 'gi');
      const matches = text.match(regex);
      const tf = matches ? matches.length : 0;

      if (tf > 0) {
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * (docLength / avgdl));
        score += idf * (numerator / denominator);
      }
    }

    return { index: idx, score };
  });

  return scores;
}

/**
 * Reciprocal Rank Fusion (RRF) to merge Dense and Sparse ranked lists.
 * Formula: RRF_score(d) = 1 / (60 + rank_dense) + 1 / (60 + rank_sparse)
 */
function reciprocalRankFusion(denseScores, sparseScores, kConstant = 60) {
  const sortedDense = [...denseScores].sort((a, b) => b.score - a.score);
  const sortedSparse = [...sparseScores].sort((a, b) => b.score - a.score);

  const rrfMap = {};

  sortedDense.forEach((item, rank) => {
    if (!rrfMap[item.index]) {
      rrfMap[item.index] = { index: item.index, rrfScore: 0, denseScore: item.score, sparseScore: 0 };
    }
    rrfMap[item.index].rrfScore += 1 / (kConstant + rank + 1);
    rrfMap[item.index].denseScore = item.score;
  });

  sortedSparse.forEach((item, rank) => {
    if (!rrfMap[item.index]) {
      rrfMap[item.index] = { index: item.index, rrfScore: 0, denseScore: 0, sparseScore: item.score };
    }
    rrfMap[item.index].rrfScore += 1 / (kConstant + rank + 1);
    rrfMap[item.index].sparseScore = item.score;
  });

  return Object.values(rrfMap).sort((a, b) => b.rrfScore - a.rrfScore);
}

/**
 * Creates, embeds, and stores chunks persistently in MongoDB and in-memory cache.
 * Uses batchEmbedContents (up to 40 items per API request) with rate-limit retries to prevent 429 quota exhaustion.
 */
async function createVectorStore(videoId, chunks) {
  const model = getEmbeddingsModel();

  // Delete previous chunks from MongoDB if any
  try {
    await Chunk.deleteMany({ videoId });
  } catch (err) {
    console.warn(`MongoDB cleanup warning for ${videoId}:`, err.message);
  }

  const chunkDocs = [];
  const BATCH_SIZE = 40; // Send up to 40 chunks per batchEmbedContents request

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    
    // Format requests for Google batchEmbedContents API
    const requests = batch.map(chunk => ({
      content: { parts: [{ text: chunk.text }] }
    }));

    console.log(`[Embedding Service] Batch embedding ${batch.length} chunks (${i + 1}-${i + batch.length} of ${chunks.length})...`);

    // Execute with automated retry on rate limit
    const batchResult = await withRetry(async () => {
      return await model.batchEmbedContents({ requests });
    });

    if (!batchResult || !batchResult.embeddings) {
      throw new Error("Batch embedding failed to return valid embeddings array.");
    }

    // Map embeddings back to chunk documents
    batch.forEach((chunk, offset) => {
      const globalIndex = i + offset;
      const embeddingValues = batchResult.embeddings[offset]?.values;
      
      chunkDocs.push({
        videoId,
        chunkIndex: globalIndex,
        text: chunk.text,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        embedding: embeddingValues,
        wordCount: chunk.wordCount || chunk.text.split(/\s+/).length,
        keywords: chunk.keywords || extractKeywords(chunk.text)
      });
    });

    // Small courteous pause between large batches
    if (i + BATCH_SIZE < chunks.length) {
      await sleep(600);
    }
  }

  // Persist to MongoDB
  try {
    if (chunkDocs.length > 0) {
      await Chunk.insertMany(chunkDocs);
    }
  } catch (dbErr) {
    console.warn(`Could not save chunks to MongoDB for ${videoId}:`, dbErr.message);
  }

  // Populate in-memory store
  const inMemoryStore = chunkDocs.map(c => ({
    document: {
      pageContent: c.text,
      metadata: {
        videoId: c.videoId,
        chunkIndex: c.chunkIndex,
        startTime: c.startTime,
        endTime: c.endTime,
        wordCount: c.wordCount,
        keywords: c.keywords
      }
    },
    embedding: c.embedding
  }));

  memoryVectorStores[videoId] = inMemoryStore;
  return inMemoryStore;
}

/**
 * Loads vector store from MongoDB if not already in memory
 */
async function loadVectorStore(videoId) {
  if (memoryVectorStores[videoId] && memoryVectorStores[videoId].length > 0) {
    return memoryVectorStores[videoId];
  }

  try {
    const dbChunks = await Chunk.find({ videoId }).sort({ chunkIndex: 1 }).lean();
    if (dbChunks && dbChunks.length > 0) {
      const store = dbChunks.map(c => ({
        document: {
          pageContent: c.text,
          metadata: {
            videoId: c.videoId,
            chunkIndex: c.chunkIndex,
            startTime: c.startTime,
            endTime: c.endTime,
            wordCount: c.wordCount,
            keywords: c.keywords || []
          }
        },
        embedding: c.embedding
      }));
      memoryVectorStores[videoId] = store;
      return store;
    }
  } catch (err) {
    console.error(`Failed to load vector store from MongoDB for ${videoId}:`, err.message);
  }

  return null;
}

/**
 * Performs 2-Stage Hybrid Search (Dense Embeddings + Sparse BM25 + Reciprocal Rank Fusion)
 */
async function searchVectorStore(videoId, query, topK = 5) {
  let store = await loadVectorStore(videoId);

  if (!store || store.length === 0) {
    throw new Error(`Vector store not found for video: ${videoId}. Please ingest the video first.`);
  }

  // 1. Generate query embedding for Dense Retrieval with retry protection
  const model = getEmbeddingsModel();
  const queryEmbeddingResult = await withRetry(async () => {
    return await model.embedContent(query);
  });
  const queryEmbedding = queryEmbeddingResult.embedding.values;

  // 2. Dense Semantic Scores
  const denseScores = store.map((item, idx) => ({
    index: idx,
    score: cosineSimilarity(queryEmbedding, item.embedding)
  }));

  // 3. Sparse BM25 Keyword Scores
  const docsList = store.map(item => item.document);
  const sparseScores = computeBM25Scores(docsList, query);

  // 4. Reciprocal Rank Fusion (RRF)
  const fusedRanks = reciprocalRankFusion(denseScores, sparseScores, 60);

  // 5. Select Top-K candidates
  const topCandidates = fusedRanks.slice(0, topK).map(candidate => {
    const doc = store[candidate.index].document;
    return {
      ...doc,
      score: candidate.rrfScore,
      denseScore: candidate.denseScore,
      sparseScore: candidate.sparseScore
    };
  });

  return topCandidates;
}

/**
 * Checks if vector store exists either in-memory or in MongoDB
 */
async function hasVectorStore(videoId) {
  if (memoryVectorStores[videoId] && memoryVectorStores[videoId].length > 0) {
    return true;
  }
  try {
    const count = await Chunk.countDocuments({ videoId });
    return count > 0;
  } catch {
    return false;
  }
}

module.exports = {
  createVectorStore,
  loadVectorStore,
  searchVectorStore,
  hasVectorStore,
  computeBM25Scores,
  reciprocalRankFusion,
  cosineSimilarity,
  withRetry
};
