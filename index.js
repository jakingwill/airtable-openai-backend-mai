// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';  // Correct import for the current version of the library
import { Worker } from 'worker_threads';
import express from 'express';
import axios from 'axios';

// Create OpenAI instance
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Express
const app = express();
app.use(express.json());

const webhookURL = process.env.WEBHOOK_URL;

// API key middleware
function checkAPIKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.APP_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key.' });
  }
  next();
}

// Function to run worker for parallel processing
function runWorker(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./worker.js', { workerData: data });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

// Route to handle requests and spawn workers
app.post('/generate', checkAPIKey, async (req, res) => {
  try {
    const { prompt, max_tokens, model, targetField_id, record_id, system_role, temperature } = req.body;

    // Call worker for the current request
    const result = await runWorker({
      prompt,
      maxTokens: max_tokens || 2000,
      model: model || 'gpt-4',
      targetFieldId: targetField_id,
      recordId: record_id,
      systemRole: system_role,
      temperature: temperature || 0.7,
    });

    res.json({ message: 'success', result });
  } catch (error) {
    console.error('Worker failed:', error);
    res.status(500).json({ error: 'An error occurred while generating text.' });
  }
});

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
