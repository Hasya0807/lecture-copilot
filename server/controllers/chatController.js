const { searchVectorStore, hasVectorStore, createVectorStore } = require("../services/vectorStore");
const { fetchAndChunkTranscript } = require("../services/transcriptService");
const { generateAnswer } = require("../services/llmService");

exports.askQuestion = async (req, res) => {
  try {
    const { videoId, query } = req.body;

    if (!videoId || !query) {
      return res.status(400).json({ error: "videoId and query are required" });
    }

    // If server restarted, the in-memory vector store is lost. Auto-recover it here.
    if (!hasVectorStore(videoId)) {
      console.log(`Auto-recovering vector store for ${videoId}...`);
      const chunks = await fetchAndChunkTranscript(videoId);
      await createVectorStore(videoId, chunks);
    }

    // 1. Search for relevant context
    let contextDocuments;
    try {
      contextDocuments = await searchVectorStore(videoId, query, 5); // top 5 chunks
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!contextDocuments || contextDocuments.length === 0) {
      return res.json({ answer: "I couldn't find any relevant information in the transcript to answer your question." });
    }

    // 2. Generate answer using LLM
    const answer = await generateAnswer(query, contextDocuments);

    res.json({ answer });
  } catch (error) {
    console.error("Error in chatController:", error);
    res.status(500).json({ error: error.stack || error.message || "Internal server error" });
  }
};
