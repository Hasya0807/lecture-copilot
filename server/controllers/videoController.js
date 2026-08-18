const Video = require("../models/Video");
const Chunk = require("../models/Chunk");
const { fetchAndChunkTranscript } = require("../services/transcriptService");
const { createVectorStore, hasVectorStore, loadVectorStore } = require("../services/vectorStore");
const { transcribeWithWhisperFallback } = require("../services/whisperService");
const { YoutubeTranscript } = require("youtube-transcript");

/**
 * Extracts YouTube Video ID from any standard or shortened YouTube URL
 */
function extractVideoId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

exports.ingestVideo = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "YouTube URL is required" });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: "Invalid YouTube URL format." });
    }

    console.log(`[Video Ingest] Processing request for videoId: ${videoId}`);

    // 1. Check if already processed in MongoDB
    let video = await Video.findOne({ videoId });
    const existingChunkCount = await Chunk.countDocuments({ videoId });

    if (video && video.status === 'ready' && existingChunkCount > 0) {
      console.log(`[Video Ingest] Video ${videoId} found in MongoDB with ${existingChunkCount} persistent chunks.`);
      
      // Ensure in-memory cache is warmed up
      await loadVectorStore(videoId);

      let rawTranscript = [];
      try {
        rawTranscript = await YoutubeTranscript.fetchTranscript(videoId);
      } catch {
        // If raw transcript fetch fails but chunks are in DB, reconstruct transcript from chunks
        const dbChunks = await Chunk.find({ videoId }).sort({ chunkIndex: 1 });
        rawTranscript = dbChunks.map(c => ({
          text: c.text,
          offset: c.startTime * 1000,
          duration: (c.endTime - c.startTime) * 1000
        }));
      }

      return res.json({
        video,
        transcript: rawTranscript,
        totalChunks: existingChunkCount,
        message: "Video already processed and loaded from persistent database."
      });
    }

    // 2. Initialize or update Video document
    if (!video) {
      video = new Video({
        videoId,
        title: `Video ${videoId}`,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        status: 'processing'
      });
      await video.save();
    } else {
      video.status = 'processing';
      await video.save();
    }

    // 3. Extract, Chunk, and Index
    let rawTranscript = [];
    let chunks = [];
    let ingestionSource = 'youtube-subtitles';

    try {
      rawTranscript = await YoutubeTranscript.fetchTranscript(videoId);
      chunks = await fetchAndChunkTranscript(videoId);
    } catch (transcriptError) {
      console.warn(`[Video Ingest] YouTube caption fetch failed: ${transcriptError.message}. Trying Whisper ASR fallback...`);
      try {
        chunks = await transcribeWithWhisperFallback(videoId);
        ingestionSource = 'whisper-asr';
      } catch (whisperError) {
        video.status = 'failed';
        await video.save();
        return res.status(400).json({
          error: `Could not extract transcript for this lecture. Details: ${transcriptError.message}`
        });
      }
    }

    // 4. Generate Embeddings & Save to Persistent Vector Store
    console.log(`[Video Ingest] Generating vector embeddings for ${chunks.length} chunks...`);
    await createVectorStore(videoId, chunks);

    // 5. Update Video Metadata
    video.status = 'ready';
    video.totalChunks = chunks.length;
    video.ingestionSource = ingestionSource;
    if (rawTranscript && rawTranscript.length > 0) {
      const last = rawTranscript[rawTranscript.length - 1];
      video.duration = Math.floor((last.offset + last.duration) / 1000);
    } else if (chunks.length > 0) {
      video.duration = chunks[chunks.length - 1].endTime;
    }
    await video.save();

    console.log(`[Video Ingest] Successfully indexed ${chunks.length} chunks for ${videoId}.`);

    return res.json({
      video,
      transcript: rawTranscript,
      totalChunks: chunks.length,
      message: "Video processed, vectorized, and indexed successfully."
    });

  } catch (error) {
    console.error("[Video Ingest Error]:", error);
    return res.status(500).json({ error: error.message || "Internal server error during video ingestion" });
  }
};
