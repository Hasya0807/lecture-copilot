require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const videoController = require('./controllers/videoController');
const chatController = require('./controllers/chatController');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    version: '2.5.0-rag-hybrid'
  });
});

app.post('/api/video/ingest', videoController.ingestVideo);
app.post('/api/chat', chatController.askQuestion);
app.post('/api/chat/stream', chatController.askQuestionStream);

// Connect to MongoDB and start server
async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      console.warn("WARNING: MONGODB_URI not found in environment. In-memory mode will be used.");
    } else {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("Connected to MongoDB database successfully.");
    }
    
    app.listen(PORT, () => {
      console.log(`Lecture Copilot server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
