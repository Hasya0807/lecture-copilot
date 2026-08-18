const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  videoId: {
    type: String,
    required: true,
    unique: true
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
  }
}, { timestamps: true });

module.exports = mongoose.model('Video', videoSchema);
