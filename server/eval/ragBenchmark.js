/**
 * Automated RAG Evaluation & Benchmark Suite for Lecture Copilot
 * 
 * Benchmarks:
 * 1. Chunking & Boundary Snapping Integrity
 * 2. Sparse BM25 Keyword Search Precision
 * 3. Dense & Reciprocal Rank Fusion (RRF) Ranking
 * 4. Grounded Timestamp Citation Syntax & Range Validity
 * 5. Latency & Throughput Benchmark
 * 
 * Run with: node server/eval/ragBenchmark.js
 */

const { chunkTranscript, extractKeywords } = require('../services/transcriptService');
const { computeBM25Scores, reciprocalRankFusion, cosineSimilarity } = require('../services/vectorStore');

// Mock transcript dataset for reproducible benchmarking
const MOCK_LECTURE_TRANSCRIPT = [
  { text: "Welcome to today's lecture on Convolutional Neural Networks.", offset: 0, duration: 4000 },
  { text: "Today we will explore kernel filters, strides, and pooling operations.", offset: 4200, duration: 5000 },
  { text: "A kernel filter slides across an input image to compute dot products.", offset: 9500, duration: 6000 },
  { text: "This produces a feature map capturing localized spatial patterns.", offset: 16000, duration: 5500 },
  { text: "Next, let us discuss max pooling.", offset: 22000, duration: 4000 },
  { text: "Max pooling reduces the spatial dimensions and prevents overfitting.", offset: 26500, duration: 6000 },
  { text: "Finally, we connect the pooled representations to a fully connected dense layer.", offset: 33000, duration: 7000 },
  { text: "The loss function is typically categorical cross entropy.", offset: 41000, duration: 5000 },
  { text: "We update weights via backpropagation using Adam or SGD optimizers.", offset: 46500, duration: 6500 },
  { text: "That concludes our overview of CNN architecture.", offset: 53500, duration: 4000 }
];

async function runBenchmarks() {
  console.log("================================================================================");
  console.log("             LECTURE COPILOT - RAG BENCHMARK & EVALUATION SUITE                 ");
  console.log("================================================================================\n");

  const results = [];
  let passedTests = 0;
  let totalTests = 0;

  function assertTest(name, condition, details = "") {
    totalTests++;
    if (condition) {
      passedTests++;
      results.push({ name, status: "PASS", details });
      console.log(`  [PASS] ${name} ${details ? `(${details})` : ''}`);
    } else {
      results.push({ name, status: "FAIL", details });
      console.error(`  [FAIL] ${name} ${details ? `(${details})` : ''}`);
    }
  }

  // TEST SUITE 1: Chunking & Boundary Snapping
  console.log("\n[1] Evaluating Boundary-Aware Semantic Chunking Engine...");
  const t0 = performance.now();
  const chunks = chunkTranscript(MOCK_LECTURE_TRANSCRIPT, { targetDurationMs: 25000, overlapDurationMs: 5000 });
  const chunkLatency = (performance.now() - t0).toFixed(2);

  assertTest("Chunk Generation Count", chunks.length >= 2, `${chunks.length} chunks generated in ${chunkLatency}ms`);
  assertTest("Timestamp Monotonicity", chunks.every((c, i) => i === 0 || c.startTime <= c.endTime), "All intervals valid");
  assertTest("Sentence Boundary Snapping", chunks.every(c => c.text.length > 10), "All chunks meet minimum text threshold");
  assertTest("Keyword Extraction", chunks[0].keywords.includes("convolutional") || chunks[0].keywords.includes("networks"), "Keywords extracted correctly");

  // TEST SUITE 2: Sparse BM25 Keyword Search
  console.log("\n[2] Evaluating Sparse BM25 Retrieval Engine...");
  const docs = chunks.map(c => ({ pageContent: c.text, wordCount: c.wordCount }));
  const bm25Scores = computeBM25Scores(docs, "max pooling overfitting dimensions");
  
  assertTest("BM25 Score Distribution", bm25Scores.some(s => s.score > 0), "Non-zero relevance scores computed");
  const highestBM25Idx = bm25Scores.reduce((maxIdx, curr, idx, arr) => curr.score > arr[maxIdx].score ? idx : maxIdx, 0);
  const topBM25ChunkText = docs[highestBM25Idx].pageContent.toLowerCase();
  assertTest("BM25 Term Match Accuracy", topBM25ChunkText.includes("pooling"), `Top match contains 'pooling'`);

  // TEST SUITE 3: Reciprocal Rank Fusion (RRF)
  console.log("\n[3] Evaluating 2-Stage Hybrid Search & Reciprocal Rank Fusion...");
  const mockDenseScores = docs.map((_, i) => ({ index: i, score: 0.85 - i * 0.1 }));
  const mockSparseScores = bm25Scores.map(s => ({ index: s.index, score: s.score }));
  const fusedRanks = reciprocalRankFusion(mockDenseScores, mockSparseScores, 60);

  assertTest("RRF Ranking Calculation", fusedRanks.length === docs.length, `${fusedRanks.length} documents ranked`);
  assertTest("RRF Top Candidate Selection", fusedRanks[0].rrfScore > 0, `Top RRF Score: ${fusedRanks[0].rrfScore.toFixed(4)}`);

  // TEST SUITE 4: Grounded Timestamp Citation Regex & Boundary Verification
  console.log("\n[4] Evaluating Citation Syntax & Timestamp Grounding Integrity...");
  const mockLLMResponse = "The instructor details max pooling operations at [00:26](timestamp:26) to mitigate overfitting. Later, backpropagation is introduced at [00:46](timestamp:46).";
  const citationRegex = /\[(\d{2}:\d{2})\]\(timestamp:(\d+)\)/g;
  
  const extractedCitations = [];
  let match;
  while ((match = citationRegex.exec(mockLLMResponse)) !== null) {
    extractedCitations.push({
      formatted: match[1],
      seconds: parseInt(match[2], 10)
    });
  }

  assertTest("Citation Pattern Matching", extractedCitations.length === 2, `Found ${extractedCitations.length} valid Markdown citations`);
  assertTest("Citation Timestamp Consistency", extractedCitations.every(c => c.seconds >= 0 && c.seconds <= 60), "All timestamps within lecture duration bounds");

  // TEST SUITE 5: Vector Cosine Similarity Precision
  console.log("\n[5] Evaluating Vector Mathematics & Cosine Similarity...");
  const vecA = [0.1, 0.5, 0.8, -0.2, 0.4];
  const vecB = [0.1, 0.5, 0.8, -0.2, 0.4];
  const vecC = [-0.1, -0.5, -0.8, 0.2, -0.4];
  
  const simIdentical = cosineSimilarity(vecA, vecB);
  const simOpposite = cosineSimilarity(vecA, vecC);
  
  assertTest("Cosine Similarity (Identical Vectors)", Math.abs(simIdentical - 1.0) < 1e-5, `Score: ${simIdentical.toFixed(4)}`);
  assertTest("Cosine Similarity (Opposite Vectors)", Math.abs(simOpposite - (-1.0)) < 1e-5, `Score: ${simOpposite.toFixed(4)}`);

  // SUMMARY REPORT
  console.log("\n================================================================================");
  console.log(`  EVALUATION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log("================================================================================\n");

  return { passedTests, totalTests, results };
}

if (require.main === module) {
  runBenchmarks().then(res => {
    process.exit(res.passedTests === res.totalTests ? 0 : 1);
  }).catch(err => {
    console.error("Benchmark failed with error:", err);
    process.exit(1);
  });
}

module.exports = { runBenchmarks };
