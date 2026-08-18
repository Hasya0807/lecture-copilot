const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Gets a response from the LLM based on user query and context
 * @param {string} query 
 * @param {Array<any>} contextDocuments 
 * @returns {Promise<string>}
 */
async function generateAnswer(query, contextDocuments) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" }); // Fast and free tier friendly

  let contextText = "Context:\n";
  for (const doc of contextDocuments) {
    const startMins = Math.floor(doc.metadata.startTime / 60).toString().padStart(2, '0');
    const startSecs = (doc.metadata.startTime % 60).toString().padStart(2, '0');
    const timestampStr = `[${startMins}:${startSecs}]`;
    contextText += `${timestampStr} ${doc.pageContent}\n`;
  }

  const prompt = `
You are a helpful teaching assistant (Copilot) for a video lecture.
Use the provided Context to answer the user's question. 

IMPORTANT RULE: 
Whenever you state a fact or point that is supported by the context, you MUST include a clickable timestamp right after it.
The timestamp MUST be in exactly this markdown format: \`[MM:SS](timestamp:seconds)\`
Example: \`[12:45](timestamp:765)\`

If the context does not contain the answer, say so politely.

Context:
${contextText}

User Question: ${query}

Answer strictly following the formatting rule above:
`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

module.exports = {
  generateAnswer
};
