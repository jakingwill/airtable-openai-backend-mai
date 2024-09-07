// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';
import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,  // Ensure this is set in your .env file
});

// Webhook URL
const webhookURL = process.env.WEBHOOK_URL;

// API key middleware
function checkAPIKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.APP_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key.' });
  }
  next();
}

// Function to create a single text completion
async function createText(
  prompt,
  maxTokens,
  model,
  targetFieldId,
  recordId,
  temperature,
  systemRole,
  retryCount = 0
) {
  try {
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: systemRole,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: maxTokens,
      temperature: temperature,
    });

    const generatedMessage = completion.choices[0].message;

    // Log the generated message before sending it to the webhook
    console.log('Generated message:', generatedMessage);

    // Send the generated message to the webhook
    await axios.post(webhookURL, {
      generatedMessage,
      recordId,
      targetFieldId,
    });
  } catch (error) {
    console.error(error);

    if (
      error.response &&
      error.response.status >= 500 &&
      retryCount < 5
    ) {
      console.log(`Retrying... (${retryCount + 1}/5)`);
      await createText(
        prompt,
        maxTokens,
        model,
        targetFieldId,
        recordId,
        temperature,
        systemRole,
        retryCount + 1
      );
    }
  }
}

// Function to process multiple questions in parallel
async function processQuestionsInParallel(questions) {
  const promises = questions.map((question) =>
    createText(
      question.prompt,
      question.maxTokens,
      question.model,
      question.targetFieldId,
      question.recordId,
      question.temperature,
      question.systemRole
    )
  );

  // Process all requests in parallel
  await Promise.all(promises);
}

// Set up the route for handling multiple requests
app.post('/generate', checkAPIKey, async (req, res) => {
  try {
    const questions = req.body.questions; // Assuming multiple questions are passed as an array
    await processQuestionsInParallel(questions); // Process all questions in parallel

    res.json({ message: 'success' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while generating text.' });
  }
});

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
