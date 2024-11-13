import { parentPort, workerData } from 'worker_threads';
import axios from 'axios';
import OpenAI from 'openai';

// Create OpenAI instance
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_RETRIES = 3; // Define the maximum number of retries

async function processMultiple(retries = 0) {
  try {
    const { prompt, model, maxTokens, temperature, systemRole, recordId, targetFieldId } = workerData;

    console.log('Starting OpenAI request for multiple responses');

    // Send request to OpenAI
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: systemRole || 'You are a teacher providing a structured response.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: temperature,
    });

    // Attempt to parse the response into the expected JSON structure
    const generatedMessage = completion.choices[0].message.content.trim();
    let structuredResponse = { mark: "", feedback: "", breakdown: "" }; // Default values

    try {
      structuredResponse = JSON.parse(generatedMessage);
      console.log('Structured response:', structuredResponse); // Log structured response
    } catch (parseError) {
      console.error('JSON parsing error:', parseError.message);
      structuredResponse.status_message = "Failed to parse OpenAI response as JSON"; // Error-specific message
    }

    // Ensure mark, feedback, and breakdown are present even if parsing fails
    const payload = {
      recordId: recordId,
      targetFieldId: targetFieldId,
      mark: structuredResponse.mark || "",
      feedback: structuredResponse.feedback || "",
      breakdown: structuredResponse.breakdown || "",
      status_message: structuredResponse.status_message || "Successfully processed by OpenAI",
    };

    await axios.post(process.env.WEBHOOK_URL_MULTIPLE, payload);
    console.log('Sent successfully to Airtable via webhook');
    parentPort.postMessage({ status: 'success', recordId: recordId, data: payload });
  } catch (error) {
    console.error('Error in workerMultiple:', error.message);

    // Always send payload with empty fields and an error message if retries fail
    const errorPayload = {
      recordId: workerData.recordId,
      targetFieldId: workerData.targetFieldId,
      mark: "", // Empty values for mark, feedback, and breakdown on error
      feedback: "",
      breakdown: "",
      status_message: `Error: ${error.message}`,
    };

    if (retries < MAX_RETRIES) {
      console.log(`Retrying... Attempt ${retries + 1}`);
      await processMultiple(retries + 1);
    } else {
      await axios.post(process.env.WEBHOOK_URL_MULTIPLE, errorPayload);
      console.log('Error sent to Airtable via webhook after retries');
      parentPort.postMessage({ status: 'error', error: error.message });
    }
  }
}

// Execute the worker task
processMultiple();
