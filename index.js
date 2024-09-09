// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

import { Worker } from 'worker_threads';
import express from 'express';
import axios from 'axios';

// Initialize Express
const app = express();
app.use(express.json());

// Logging to confirm server is running
console.log("Server starting...");

// API key middleware for authentication
function checkAPIKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.APP_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key.' });
  }
  next();
}

// Worker function to run in a separate thread
function runWorker(data) {
  return new Promise((resolve, reject) => {
    console.log('Starting worker with data:', data);  // Log worker input

    const worker = new Worker('./worker.js', { workerData: data });

    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker stopped with exit code ${code}`);  // Log worker exit code
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

// Main API endpoint for generating responses
app.post('/generate', checkAPIKey, async (req, res) => {
  try {
    console.log('Received request to /generate:', req.body);  // Log the incoming request

    const systemRole = req.body.system_role || 'You are a teacher who will provide a structured response.';

    // Call worker for the current request
    const result = await runWorker({
      prompt: req.body.messages,
      maxTokens: req.body.max_tokens || 2000,
      model: req.body.model || 'gpt-4o',
      targetFieldId: req.body.targetField_id || 'defaultField',
      recordId: req.body.record_id || 'defaultRecordId',
      systemRole: systemRole,
      temperature: req.body.temperature || 0.7,
    });

    console.log('Worker result:', result);  // Log the result from the worker

    res.json({ message: 'success', result });
  } catch (error) {
    console.error('Worker failed:', error);  // Log the error
    res.status(500).json({ error: 'An error occurred while generating text.' });
  }
});

// Test route to confirm the server is running
app.get('/test', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
