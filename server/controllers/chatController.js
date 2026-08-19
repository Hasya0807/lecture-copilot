const { searchVectorStore, hasVectorStore } = require("../services/vectorStore");
const { generateAnswer, generateAnswerStream, condenseQueryWithHistory } = require("../services/llmService");

/**
 * Standard (Non-Streaming) Q&A Handler
 */
exports.askQuestion = async (req, res) => {
  try {
    const { videoId, query, history = [] } = req.body;

    if (!videoId || !query) {
      return res.status(400).json({ error: "videoId and query are required" });
    }

    const hasStore = await hasVectorStore(videoId);
    if (!hasStore) {
      return res.status(400).json({ error: `Vector store not found for video: ${videoId}. Please ingest the video first.` });
    }

    // 1. Multi-turn Query Condensation (resolves pronouns like 'it', 'that equation')
    const standaloneQuery = await condenseQueryWithHistory(query, history);
    console.log(`[ChatController] Original query: "${query}" -> Search query: "${standaloneQuery}"`);

    // 2. 2-Stage Hybrid Search (Dense Embeddings + BM25 + RRF)
    const contextDocuments = await searchVectorStore(videoId, standaloneQuery, 5);

    if (!contextDocuments || contextDocuments.length === 0) {
      return res.json({
        answer: "I couldn't find any relevant sections in the lecture transcript to answer your question.",
        standaloneQuery,
        sources: []
      });
    }

    // 3. Generate Grounded Answer using Gemini
    const answer = await generateAnswer(query, contextDocuments);

    // Format sources metadata for frontend citation pills
    const sources = contextDocuments.map(doc => ({
      startTime: doc.metadata?.startTime,
      endTime: doc.metadata?.endTime,
      score: doc.score,
      denseScore: doc.denseScore,
      sparseScore: doc.sparseScore
    }));

    return res.json({
      answer,
      standaloneQuery,
      sources
    });

  } catch (error) {
    console.error("[ChatController Error]:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};

/**
 * Real-Time Token Streaming Q&A Handler via Server-Sent Events (SSE)
 */
exports.askQuestionStream = async (req, res) => {
  try {
    const { videoId, query, history = [] } = req.body;

    if (!videoId || !query) {
      return res.status(400).json({ error: "videoId and query are required" });
    }

    const hasStore = await hasVectorStore(videoId);
    if (!hasStore) {
      return res.status(400).json({ error: `Vector store not found for video: ${videoId}. Please ingest the video first.` });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // 1. Multi-turn Query Condensation
    const standaloneQuery = await condenseQueryWithHistory(query, history);
    
    // Send metadata event to client
    res.write(`event: metadata\ndata: ${JSON.stringify({ standaloneQuery })}\n\n`);

    // 2. 2-Stage Hybrid Search
    const contextDocuments = await searchVectorStore(videoId, standaloneQuery, 5);

    if (!contextDocuments || contextDocuments.length === 0) {
      res.write(`event: token\ndata: ${JSON.stringify({ token: "I couldn't find any relevant sections in the lecture transcript to answer your question." })}\n\n`);
      res.write(`event: end\ndata: [DONE]\n\n`);
      return res.end();
    }

    // Send sources event
    const sources = contextDocuments.map(doc => ({
      startTime: doc.metadata?.startTime,
      endTime: doc.metadata?.endTime,
      score: doc.score
    }));
    res.write(`event: sources\ndata: ${JSON.stringify({ sources })}\n\n`);

    let isClientConnected = true;
    req.on('close', () => {
      isClientConnected = false;
    });

    // 3. Stream LLM tokens to client
    await generateAnswerStream(query, contextDocuments, (chunkToken) => {
      if (isClientConnected) {
        res.write(`event: token\ndata: ${JSON.stringify({ token: chunkToken })}\n\n`);
      }
    });

    if (isClientConnected) {
      res.write(`event: end\ndata: [DONE]\n\n`);
      return res.end();
    }

  } catch (error) {
    console.error("[ChatController Streaming Error]:", error);
    // If headers already sent, write error event
    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      return res.end();
    }
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};
