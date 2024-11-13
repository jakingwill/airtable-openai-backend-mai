import { parentPort, workerData } from 'worker_threads';
import axios from 'axios';
import OpenAI from 'openai';

// Create OpenAI instance
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_RETRIES = 3; // Define the maximum number of retries

async function processQuestion(retries = 0) {
  try {
    console.log('Processing question with workerData:', workerData);

    if (!workerData.prompt) {
      throw new Error('Prompt is missing or undefined.');
    }

    // Sending request to OpenAI
    const completion = await openai.chat.completions.create({
      model: workerData.model,
      messages: [
        { role: 'system', content: workerData.systemRole || 'You are a teacher providing a structured response.' },  
        { role: 'user', content: workerData.prompt }
      ],
      max_tokens: workerData.maxTokens,
      temperature: workerData.temperature,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "marking_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              mark: { type: "string" },
              breakdown: { type: "string" },
              feedback: { type: "string" }
            },
            required: ["mark", "breakdown", "feedback"],
            additionalProperties: false
          }
        }
      }
    });

    const generatedMessage = completion.choices[0].message;
    const structuredResponse = JSON.parse(generatedMessage.content);

    const payload = {
      recordId: workerData.recordId,
      targetFieldId: workerData.targetFieldId,
      mark: structuredResponse.mark,
      feedback: structuredResponse.feedback,
      breakdown: structuredResponse.breakdown
    };

    await axios.post(process.env.WEBHOOK_URL_MULTIPLE, payload);

    parentPort.postMessage({ status: 'success', recordId: workerData.recordId });

  } catch (error) {
    console.error('Error in worker:', error.message);

    if (retries < MAX_RETRIES) {
      await processQuestion(retries + 1);
    } else {
      parentPort.postMessage({ status: 'error', error: error.message });
    }
  }
}

// Execute the worker task
processQuestion();
