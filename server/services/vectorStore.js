const { GoogleGenerativeAI } = require("@google/generative-ai");

let vectorStores = {}; // In-memory map of videoId -> Array of { document, embedding }

function getEmbeddingsModel() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // Use the available embedding model for this API key
  return genAI.getGenerativeModel({ model: "gemini-embedding-2" });
}

function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function createVectorStore(videoId, chunks) {
  const model = getEmbeddingsModel();
  
  // Create documents
  const documents = chunks.map(chunk => ({
    pageContent: chunk.text,
    metadata: {
      videoId,
      startTime: chunk.startTime,
      endTime: chunk.endTime
    }
  }));

  // Generate embeddings for all documents
  const store = [];
  for (const doc of documents) {
    const result = await model.embedContent(doc.pageContent);
    store.push({
      document: doc,
      embedding: result.embedding.values
    });
  }

  vectorStores[videoId] = store;
  return store;
}

async function searchVectorStore(videoId, query, k = 4) {
  const store = vectorStores[videoId];
  if (!store) {
    throw new Error("Vector store not found for video: " + videoId + ". Please ensure the video is fully processed.");
  }

  const model = getEmbeddingsModel();
  const result = await model.embedContent(query);
  const queryEmbedding = result.embedding.values;

  // Calculate similarity for all chunks
  const results = store.map(item => ({
    document: item.document,
    score: cosineSimilarity(queryEmbedding, item.embedding)
  }));

  // Sort by score descending and take top k
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, k).map(res => res.document);
}

function hasVectorStore(videoId) {
  return !!vectorStores[videoId];
}

module.exports = {
  createVectorStore,
  searchVectorStore,
  hasVectorStore
};
