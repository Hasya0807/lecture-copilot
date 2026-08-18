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
app.post('/api/video/ingest', videoController.ingestVideo);
app.post('/api/chat', chatController.askQuestion);

// Connect to MongoDB and start server
async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      console.warn("WARNING: MONGODB_URI not found in environment. Please add it to your .env file.");
    } else {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("Connected to MongoDB");
    }
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
