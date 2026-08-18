const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  videoId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String
  },
  duration: {
    type: Number // in seconds
  },
  status: {
    type: String,
    enum: ['processing', 'ready', 'failed'],
    default: 'processing'
  },
  totalChunks: {
    type: Number,
    default: 0
  },
  embeddingModel: {
    type: String,
    default: 'gemini-embedding-2'
  },
  language: {
    type: String,
    default: 'en'
  },
  hasCaptions: {
    type: Boolean,
    default: true
  },
  ingestionSource: {
    type: String,
    enum: ['youtube-subtitles', 'whisper-asr', 'manual'],
    default: 'youtube-subtitles'
  }
}, { timestamps: true });

module.exports = mongoose.model('Video', videoSchema);
