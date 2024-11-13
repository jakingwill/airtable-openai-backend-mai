import { parentPort, workerData } from 'worker_threads';
import axios from 'axios';
import OpenAI from 'openai';

// Create OpenAI instance
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function processSingle() {
  try {
    const { prompt, model, maxTokens, temperature, systemRole, recordId, targetFieldId } = workerData;

    console.log('Starting OpenAI request for single response');

    // Call OpenAI API for single response
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: systemRole },
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: temperature,
    });

    const generatedMessage = completion.choices[0].message.content.trim();
    console.log('Generated message successfully from OpenAI');

    // Prepare payload with original fields and added status_message
    const payload = {
      generatedMessage: generatedMessage,
      recordId: recordId,
      targetFieldId: targetFieldId,
      status_message: "Successfully processed by OpenAI",
    };

    await axios.post(process.env.WEBHOOK_URL_SINGLE, payload);
    console.log('Sent successfully to Airtable via webhook');
    parentPort.postMessage({ status: 'success', recordId: recordId, data: payload });
  } catch (error) {
    console.error('Error in workerSingle:', error.message);

    // Send error status to webhook
    const errorPayload = {
      recordId: workerData.recordId,
      targetFieldId: workerData.targetFieldId,
      status_message: `Error: ${error.message}`,
    };

    await axios.post(process.env.WEBHOOK_URL_SINGLE, errorPayload);
    console.log('Error sent to Airtable via webhook');
    parentPort.postMessage({ status: 'error', error: error.message });
  }
}

// Execute the worker task
processSingle();
