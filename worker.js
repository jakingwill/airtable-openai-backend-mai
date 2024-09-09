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
    const completion = await openai.chat.completions.create({
      model: workerData.model,
      messages: [
        { role: 'system', content: workerData.systemRole },
        { role: 'user', content: workerData.prompt },
      ],
      max_tokens: workerData.maxTokens,
      temperature: workerData.temperature,
    });

    const generatedMessage = completion.choices[0].message;

    // Log the generated message before sending it to the webhook
    console.log('Generated message:', generatedMessage);

    // Send the response to the webhook
    await axios.post(process.env.WEBHOOK_URL, {
      generatedMessage,
      recordId: workerData.recordId,
      targetFieldId: workerData.targetFieldId,
    });

    // Return success to parent thread
    parentPort.postMessage({ status: 'success', recordId: workerData.recordId });
  } catch (error) {
    console.error('Error in worker:', error.message);

    if (retries < MAX_RETRIES) {
      console.log(`Retrying... (${retries + 1}/${MAX_RETRIES})`);
      await processQuestion(retries + 1);  // Retry the task
    } else {
      // If retries exceed limit, send error back to the parent thread
      parentPort.postMessage({ status: 'error', error: error.message });
    }
  }
}

// Execute the worker task with retries
processQuestion();
