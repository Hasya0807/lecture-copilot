const { YoutubeTranscript } = require('youtube-transcript');

/**
 * Fetches transcript from a YouTube video and chunks it.
 * @param {string} videoId 
 * @returns {Promise<Array<{text: string, startTime: number, endTime: number}>>}
 */
async function fetchAndChunkTranscript(videoId) {
  try {
    const rawTranscript = await YoutubeTranscript.fetchTranscript(videoId);
    return chunkTranscript(rawTranscript);
  } catch (error) {
    console.error("Error fetching transcript:", error);
    throw new Error("Could not fetch transcript for this video. It might not have closed captions.");
  }
}

/**
 * Groups transcript segments into semantic chunks of roughly 45-60 seconds.
 * @param {Array<{text: string, duration: number, offset: number}>} transcript 
 */
function chunkTranscript(transcript) {
  const chunks = [];
  let currentChunkText = "";
  let currentStartTime = -1;
  let currentDuration = 0;

  for (const item of transcript) {
    if (currentStartTime === -1) {
      currentStartTime = item.offset;
    }
    
    // Normalize text (remove newlines, extra spaces)
    const normalizedText = item.text.replace(/\n/g, ' ').trim();
    currentChunkText += (currentChunkText ? ' ' : '') + normalizedText;
    currentDuration += item.duration;

    // If we've hit roughly 45 seconds or it's the last item
    // (Duration is in milliseconds usually for youtube-transcript, so we check > 45000)
    if (currentDuration >= 45000) {
      chunks.push({
        text: currentChunkText,
        startTime: Math.floor(currentStartTime / 1000), // convert to seconds
        endTime: Math.floor((currentStartTime + currentDuration) / 1000)
      });
      currentChunkText = "";
      currentStartTime = -1;
      currentDuration = 0;
    }
  }

  // Push remaining text as a chunk
  if (currentChunkText.trim()) {
    chunks.push({
      text: currentChunkText,
      startTime: Math.floor(currentStartTime / 1000),
      endTime: Math.floor((currentStartTime + currentDuration) / 1000)
    });
  }

  return chunks;
}

module.exports = {
  fetchAndChunkTranscript
};
