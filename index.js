// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';
import { Worker } from 'worker_threads';
import express from 'express';
import axios from 'axios';

// Initialize Express
const app = express();
app.use(express.json());

// Create OpenAI instance
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// API key middleware for authentication
function checkAPIKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.APP_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key.' });
  }
  next();
}

// Worker function to run in a separate thread
function runWorker(workerFile, data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerFile, { workerData: data });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

// Single response generation endpoint
app.post('/generate/single', checkAPIKey, async (req, res) => {
  try {
    const { prompt, max_tokens, model, targetField_id, record_id, system_role, temperature } = req.body;

    // Call worker for generating single response
    const result = await runWorker('./workerSingle.js', {
      prompt,
      maxTokens: max_tokens || 2000,
      model: model || 'gpt-4o',
      targetFieldId: targetField_id,
      recordId: record_id,
      systemRole: system_role,
      temperature: temperature || 0.7,
    });

    res.json({ message: 'success', result });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'An error occurred while generating text.' });
  }
});

// Multiple response generation endpoint (mark, feedback, justification)
app.post('/generate/multiple', checkAPIKey, async (req, res) => {
  try {
    const { prompt, max_tokens, model, targetField_id, record_id, system_role, temperature } = req.body;

    // Call worker for generating multiple responses
    const result = await runWorker('./workerMultiple.js', {
      prompt,
      maxTokens: max_tokens || 2000,
      model: model || 'gpt-4o',
      targetFieldId: targetField_id,
      recordId: record_id,
      systemRole: system_role,
      temperature: temperature || 0.1,
    });

    res.json({ message: 'success', result });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'An error occurred while generating text.' });
  }
});

// Combined essay marking guide and total marks response generation endpoint
app.post('/generate/essaymg', checkAPIKey, async (req, res) => {
  try {
    const {
      marking_guide_prompt,
      total_marks_prompt,
      max_tokens,
      model,
      record_id,
      targetField_id,
      system_role,
      temperature,
    } = req.body;

    // Call worker for generating essay marking guide and total marks
    const result = await runWorker('./workerEssayMG.js', {
      markingGuidePrompt: marking_guide_prompt,
      totalMarksPrompt: total_marks_prompt,
      maxTokens: max_tokens || 2000,
      model: model || 'gpt-4',
      targetFieldId: targetField_id,
      recordId: record_id,
      systemRole: system_role,
      temperature: temperature || 0.2,
    });

    res.json({ message: 'success', result });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'An error occurred while generating text.' });
  }
});


// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
