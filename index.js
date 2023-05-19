// Load environment variables
require('dotenv').config();

const { Configuration, OpenAIApi } = require('openai');
const express = require('express');
const axios = require('axios');
const app = express();

// Allow JSON parsing in POST requests
app.use(express.json());

// Replace with your OpenAI API key
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

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

const MAX_RETRIES = 5;

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
    const completion = await openai.createChatCompletion({
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

    const generatedMessage = completion.data.choices[0].message;

    await axios.post(webhookURL, {
      generatedMessage,
      recordId,
      targetFieldId,
    });
  } catch (error) {
    console.error(error);

    // If the status code is above 500 and we haven't reached the maximum retries yet, retry
    if (
      error.response &&
      error.response.status >= 500 &&
      retryCount < MAX_RETRIES
    ) {
      console.log(`Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
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

// Set up the route for calling the OpenAI API
app.post('/generate', checkAPIKey, async (req, res) => {
  try {
    const prompt = req.body.prompt;
    const maxTokens = req.body.max_tokens || 2000;
    const model = req.body.model || 'gpt-4';
    const targetFieldId = req.body.targetField_id;
    const recordId = req.body.record_id;
    const systemRole = req.body.system_role;
    const temperature = req.body.temperature || 1;

    createText(
      prompt,
      maxTokens,
      model,
      targetFieldId,
      recordId,
      temperature,
      systemRole
    );

    res.json({ message: 'success' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while generating text.' });
  }
});

// Start the server
const port = process.env.PORT || 5000;
app.listen(port);
