const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema({
  videoId: {
    type: String,
    required: true,
    index: true
  },
  chunkIndex: {
    type: Number,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  startTime: {
    type: Number, // in seconds
    required: true
  },
  endTime: {
    type: Number, // in seconds
    required: true
  },
  embedding: {
    type: [Number], // dense vector
    required: true,
    select: true
  },
  wordCount: {
    type: Number,
    default: 0
  },
  keywords: {
    type: [String],
    default: []
  }
}, { timestamps: true });

// Compound index for fast lookup of a video's chunks
chunkSchema.index({ videoId: 1, chunkIndex: 1 });

module.exports = mongoose.model('Chunk', chunkSchema);
