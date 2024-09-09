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
    console.log('Processing question with workerData:', workerData);  // Log workerData

    if (!workerData.prompt) {
      throw new Error('Prompt is missing or undefined.');
    }

    // Sending request to OpenAI
    console.log('Sending request to OpenAI API...');
    const completion = await openai.chat.completions.create({
      model: workerData.model,
      messages: [
        { role: 'system', content: workerData.systemRole || 'You are a teacher providing a structured response.' },  
        { role: 'user', content: workerData.prompt }  // Pass the correct prompt here
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

    console.log('OpenAI API Response:', completion);

    // Access structured output directly from the API response
    const generatedMessage = completion.choices[0].message;
    const structuredResponse = JSON.parse(generatedMessage.content);  // Parse the JSON output

    console.log('Generated structured message:', structuredResponse);

    const payload = {
      recordId: workerData.recordId || 'defaultRecordId',
      targetFieldId: workerData.targetFieldId || 'defaultField',
      mark: structuredResponse.mark,
      feedback: structuredResponse.feedback,
      breakdown: structuredResponse.breakdown
    };

    console.log('Payload to be sent to webhook:', JSON.stringify(payload, null, 2));

    await axios.post(process.env.WEBHOOK_URL, payload);

    parentPort.postMessage({ status: 'success', recordId: workerData.recordId });

  } catch (error) {
    console.error('Error in worker:', error.message);

    if (retries < MAX_RETRIES) {
      console.log(`Retrying... (${retries + 1}/${MAX_RETRIES})`);
      await processQuestion(retries + 1);
    } else {
      parentPort.postMessage({ status: 'error', error: error.message });
    }
  }
}

// Execute the worker task
processQuestion();

