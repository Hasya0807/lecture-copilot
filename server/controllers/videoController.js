const Video = require("../models/Video");
const { fetchAndChunkTranscript } = require("../services/transcriptService");
const { createVectorStore } = require("../services/vectorStore");
const { YoutubeTranscript } = require("youtube-transcript");

/**
 * Extracts YouTube Video ID from a URL
 */
function extractVideoId(url) {
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
      return res.status(400).json({ error: "Invalid YouTube URL" });
    }

    // Check if already processed
    let video = await Video.findOne({ videoId });
    if (video && video.status === 'ready') {
      const { hasVectorStore } = require("../services/vectorStore");
      const rawTranscript = await YoutubeTranscript.fetchTranscript(videoId);
      
      // If server restarted, the in-memory vector store is lost. We need to recreate it.
      if (!hasVectorStore(videoId)) {
        const chunks = await fetchAndChunkTranscript(videoId);
        await createVectorStore(videoId, chunks);
      }
      
      return res.json({ video, transcript: rawTranscript, message: "Video already processed." });
    }

    if (!video) {
      video = new Video({
        videoId,
        title: `Video ${videoId}`, // In a real app we'd use YouTube Data API to get title
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        status: 'processing'
      });
      await video.save();
    }

    // Process
    try {
      const rawTranscript = await YoutubeTranscript.fetchTranscript(videoId);
      const chunks = await fetchAndChunkTranscript(videoId);
      
      await createVectorStore(videoId, chunks);

      video.status = 'ready';
      // Calculate approx duration from last transcript item
      if (rawTranscript.length > 0) {
        const last = rawTranscript[rawTranscript.length - 1];
        video.duration = Math.floor((last.offset + last.duration) / 1000);
      }
      await video.save();

      return res.json({ video, transcript: rawTranscript, message: "Video processed successfully." });
    } catch (processError) {
      video.status = 'failed';
      await video.save();
      console.error(processError);
      return res.status(500).json({ error: "Failed to process video: " + processError.message });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};
