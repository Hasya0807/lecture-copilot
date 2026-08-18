const { YoutubeTranscript } = require('youtube-transcript');

// Common English stopwords for tokenization & BM25 keyword filtering
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'can\'t', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing',
  'don\'t', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t',
  'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers',
  'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if',
  'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t',
  'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our',
  'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s',
  'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re',
  'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t',
  'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s',
  'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t',
  'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself',
  'yourselves'
]);

/**
 * Decode HTML entities commonly found in YouTube subtitles (e.g. &amp;, &#39;, &quot;)
 */
function decodeHtmlEntities(text) {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenizes text into lowercase keywords excluding stopwords and punctuation.
 */
function extractKeywords(text) {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
  return Array.from(new Set(words));
}

/**
 * Groups transcript segments into boundary-aware semantic chunks with sliding-window overlap.
 * 
 * @param {Array<{text: string, duration: number, offset: number}>} transcript 
 * @param {Object} options
 * @param {number} options.targetDurationMs Target duration per chunk in ms (default: 45000ms = 45s)
 * @param {number} options.overlapDurationMs Overlap duration from previous chunk in ms (default: 8000ms = 8s)
 * @returns {Array<{text: string, startTime: number, endTime: number, wordCount: number, keywords: string[]}>}
 */
function chunkTranscript(transcript, options = {}) {
  const targetDurationMs = options.targetDurationMs || 60000;
  const overlapDurationMs = options.overlapDurationMs || 10000;

  if (!transcript || transcript.length === 0) {
    return [];
  }

  // Pre-clean all transcript items
  const cleanItems = transcript.map(item => ({
    text: decodeHtmlEntities(item.text),
    offset: item.offset,
    duration: item.duration
  })).filter(item => item.text.length > 0);

  if (cleanItems.length === 0) return [];

  const chunks = [];
  let startIndex = 0;

  while (startIndex < cleanItems.length) {
    let currentText = "";
    let chunkStartTime = cleanItems[startIndex].offset;
    let chunkEndTime = chunkStartTime;
    let currentIndex = startIndex;
    let accumulatedDuration = 0;

    while (currentIndex < cleanItems.length) {
      const item = cleanItems[currentIndex];
      const itemDuration = item.duration || 2000;
      accumulatedDuration += itemDuration;
      chunkEndTime = item.offset + itemDuration;

      currentText += (currentText ? ' ' : '') + item.text;

      // Check if target duration reached and we are at a sentence boundary or near it
      const isSentenceEnd = /[.!?]$/.test(item.text.trim());
      const isPastTarget = accumulatedDuration >= targetDurationMs;
      const isMaxDuration = accumulatedDuration >= targetDurationMs * 1.4; // Force cut if too long

      if ((isPastTarget && isSentenceEnd) || isMaxDuration || currentIndex === cleanItems.length - 1) {
        break;
      }

      currentIndex++;
    }

    // Ensure valid non-empty chunk
    if (currentText.trim()) {
      const normalizedChunkText = currentText.trim();
      chunks.push({
        text: normalizedChunkText,
        startTime: Math.max(0, Math.floor(chunkStartTime / 1000)),
        endTime: Math.max(1, Math.floor(chunkEndTime / 1000)),
        wordCount: normalizedChunkText.split(/\s+/).length,
        keywords: extractKeywords(normalizedChunkText)
      });
    }

    // If we've reached the end, stop
    if (currentIndex >= cleanItems.length - 1) {
      break;
    }

    // Calculate next startIndex based on sliding window overlap
    // Find item whose offset is approximately (chunkEndTime - overlapDurationMs)
    const targetOverlapStart = Math.max(chunkStartTime, chunkEndTime - overlapDurationMs);
    let nextIndex = currentIndex + 1;
    for (let i = currentIndex; i > startIndex; i--) {
      if (cleanItems[i].offset <= targetOverlapStart) {
        nextIndex = i;
        break;
      }
    }

    // Guarantee forward progress to prevent infinite loop
    if (nextIndex <= startIndex) {
      nextIndex = startIndex + 1;
    }

    startIndex = nextIndex;
  }

  return chunks;
}

/**
 * Fetches transcript from a YouTube video and chunks it using semantic boundary snapping.
 * @param {string} videoId 
 * @returns {Promise<Array<{text: string, startTime: number, endTime: number, wordCount: number, keywords: string[]}>>}
 */
async function fetchAndChunkTranscript(videoId) {
  try {
    const rawTranscript = await YoutubeTranscript.fetchTranscript(videoId);
    if (!rawTranscript || rawTranscript.length === 0) {
      throw new Error("Empty transcript returned.");
    }
    return chunkTranscript(rawTranscript);
  } catch (error) {
    console.error(`Error fetching YouTube transcript for ${videoId}:`, error.message);
    throw new Error(`Could not fetch transcript for video (${videoId}): ${error.message}`);
  }
}

module.exports = {
  fetchAndChunkTranscript,
  chunkTranscript,
  extractKeywords,
  decodeHtmlEntities,
  STOPWORDS
};
