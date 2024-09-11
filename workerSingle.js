import { parentPort, workerData } from 'worker_threads';
import axios from 'axios';
import OpenAI from 'openai';

// Create OpenAI instance
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function processQuestion() {
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

    await axios.post(process.env.WEBHOOK_URL, {
      generatedMessage,
      recordId: workerData.recordId,
      targetFieldId: workerData.targetFieldId,
    });

    parentPort.postMessage({ status: 'success', recordId: workerData.recordId });
  } catch (error) {
    parentPort.postMessage({ status: 'error', error: error.message });
  }
}

processQuestion();
