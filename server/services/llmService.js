const { GoogleGenerativeAI } = require("@google/generative-ai");

const MODEL_NAME = "gemini-3.6-flash";

/**
 * Returns Gemini Generative Model instance
 */
function getGenerativeModel(modelName = MODEL_NAME) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: modelName });
}

/**
 * Helper to sleep for ms
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exponential backoff retry handler for transient 503 / 429 errors
 */
async function withLlmRetry(fn, maxRetries = 3, baseDelayMs = 1500) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      const isTransient = err.status === 503 || 
                          err.status === 429 || 
                          err.message?.includes('503') || 
                          err.message?.includes('429') ||
                          err.message?.includes('high demand') ||
                          err.message?.includes('Quota exceeded');

      if (isTransient && attempt <= maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(`[LLM Transient Warning] Status ${err.status || '503/429'}. Retrying attempt ${attempt}/${maxRetries} after ${delay}ms...`);
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
}

/**
 * Formats context documents into grounded timestamped text blocks
 */
function formatContextPrompt(contextDocuments) {
  let contextText = "";
  for (const doc of contextDocuments) {
    const meta = doc.metadata || {};
    const startSec = meta.startTime || 0;
    const endSec = meta.endTime || (startSec + 30);
    const startMins = Math.floor(startSec / 60).toString().padStart(2, '0');
    const startSecs = (startSec % 60).toString().padStart(2, '0');
    const endMins = Math.floor(endSec / 60).toString().padStart(2, '0');
    const endSecs = (endSec % 60).toString().padStart(2, '0');
    
    contextText += `[Segment ${startMins}:${startSecs} - ${endMins}:${endSecs}] (offset: ${startSec}s):\n${doc.pageContent}\n\n`;
  }
  return contextText.trim();
}

/**
 * Re-writes multi-turn conversational follow-ups into standalone search queries.
 */
async function condenseQueryWithHistory(query, history = []) {
  if (!history || history.length === 0) {
    return query;
  }

  const recentHistory = history
    .filter(msg => msg.text && !msg.text.startsWith("👋"))
    .slice(-4);

  if (recentHistory.length === 0) {
    return query;
  }

  const model = getGenerativeModel(MODEL_NAME);
  const conversationSummary = recentHistory
    .map(m => `${m.isUser ? "Student" : "Copilot"}: ${m.text.slice(0, 300)}`)
    .join("\n");

  const prompt = `Given the conversation history and a follow-up question from a student watching a video lecture, rephrase the follow-up question into a standalone, keyword-rich search query suitable for searching a vector database of lecture transcripts.
Do NOT answer the question. Just return the standalone rephrased query.

Conversation History:
${conversationSummary}

Follow-up Question: ${query}

Standalone Query:`;

  try {
    const result = await withLlmRetry(async () => {
      return await model.generateContent(prompt);
    });
    const rephrased = result.response.text().trim();
    return rephrased.length > 3 ? rephrased : query;
  } catch (err) {
    console.warn("Query condensation fallback to original query:", err.message);
    return query;
  }
}

/**
 * Optional HyDE (Hypothetical Document Embeddings) Generator
 */
async function generateHypotheticalDocument(query) {
  try {
    const model = getGenerativeModel(MODEL_NAME);
    const prompt = `Write a short 2-3 sentence hypothetical excerpt from an academic video lecture that directly explains or answers: "${query}".`;
    const result = await withLlmRetry(async () => {
      return await model.generateContent(prompt);
    });
    return result.response.text().trim();
  } catch {
    return query;
  }
}

/**
 * Builds the grounded and pedagogically enriched prompt for Lecture Copilot
 */
function buildRagPrompt(query, contextDocuments) {
  const contextText = formatContextPrompt(contextDocuments);

  return `You are an exceptional AI Professor and Study Copilot for a video lecture.
Your mission is to help the student deeply understand the material by synthesizing the video content AND providing rich, practical, pedagogical value (intuition, practical examples, formulas, and real-world context).

LECTURE CONTEXT SEGMENTS:
${contextText}

STUDENT QUESTION:
${query}

INSTRUCTIONS FOR GENERATING THE RESPONSE:
1. **Lecture-Grounded Foundation (With Timestamps)**:
   - Always explain how the instructor presents the topic in the video.
   - For ANY fact, definition, or segment referenced from the lecture, provide an interactive clickable timestamp anchor in exact Markdown format: \`[MM:SS](timestamp:seconds)\`.
   - Example: \`The instructor introduces the concept at [03:15](timestamp:195) and derives the equation at [08:40](timestamp:520).\`

2. **Pedagogical Enrichment & Value-Add (Crucial)**:
   - Do NOT just summarize the raw transcript. Act like a world-class tutor!
   - Provide **Intuitive Explanations & Analogies** that make the concept click.
   - Provide **Concrete Examples or Code Snippets** (in Python/JS/Math LaTeX) whenever relevant to the topic.
   - Include **Real-World Applications & Industry Context** (e.g. how companies or modern ML systems use this).
   - Point out **Common Pitfalls or Exam/Interview Tips** related to the concept.

3. **Structure & Formatting**:
   - Organize your response with clear Markdown headers, bold terminology, and bullet points.
   - Recommended structure when applicable:
     - **Lecture Coverage**: What the instructor explained (with timestamp anchors).
     - **💡 Intuition & Deep Dive**: The underlying "why" and conceptual breakdown.
     - **💻 Practical Example / Application**: Concrete code, formula, or use case.
     - **⚡ Key Takeaways**: 2-3 high-impact summary bullets.

4. **Tone**: Warm, encouraging, intellectually rigorous, and crystal clear.

Now, write your comprehensive, beautifully formatted answer:`;
}

/**
 * Non-streaming answer generation with automated retry
 */
async function generateAnswer(query, contextDocuments) {
  const model = getGenerativeModel(MODEL_NAME);
  const prompt = buildRagPrompt(query, contextDocuments);
  const result = await withLlmRetry(async () => {
    return await model.generateContent(prompt);
  });
  return result.response.text();
}

/**
 * Real-Time Token Streaming answer generation via Gemini Content Stream
 */
async function generateAnswerStream(query, contextDocuments, onChunk) {
  const model = getGenerativeModel(MODEL_NAME);
  const prompt = buildRagPrompt(query, contextDocuments);

  const resultStream = await withLlmRetry(async () => {
    return await model.generateContentStream(prompt);
  });

  for await (const chunk of resultStream.stream) {
    const chunkText = chunk.text();
    if (chunkText && onChunk) {
      onChunk(chunkText);
    }
  }
}

module.exports = {
  generateAnswer,
  generateAnswerStream,
  condenseQueryWithHistory,
  generateHypotheticalDocument,
  formatContextPrompt,
  buildRagPrompt,
  withLlmRetry
};
