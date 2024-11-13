import { parentPort, workerData } from 'worker_threads';
import axios from 'axios';
import OpenAI from 'openai';

// Create OpenAI instance
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function processEssayMG() {
  try {
    const {
      markingGuidePrompt,
      totalMarksPrompt,
      model,
      maxTokens,
      temperature,
      systemRole,
      recordId,
      targetFieldId,
    } = workerData;

    console.log('Starting OpenAI request for essay marking guide and total marks');

    // Marking guide API call
    const markingGuideCompletion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: systemRole },
        { role: 'user', content: markingGuidePrompt },
      ],
      max_tokens: maxTokens,
      temperature: temperature,
    });
    const markingGuide = markingGuideCompletion.choices[0].message.content.trim();
    console.log('Marking guide generated successfully');

    // Total marks API call
    const totalMarksCompletion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: systemRole },
        { role: 'user', content: totalMarksPrompt },
      ],
      max_tokens: maxTokens,
      temperature: temperature,
    });
    const totalMarks = totalMarksCompletion.choices[0].message.content.trim();
    console.log('Total marks generated successfully');

    // Payload with success message
    const payload = {
      recordId: recordId,
      targetFieldId: targetFieldId,
      markingGuide: markingGuide,
      totalMarks: totalMarks,
      status_message: "Successfully processed by OpenAI",
    };

    await axios.post(process.env.WEBHOOK_URL_ESSAYMG, payload);
    console.log('Sent successfully to Airtable via webhook');
    parentPort.postMessage({ status: 'success', recordId: recordId, data: payload });
  } catch (error) {
    console.error('Error in workerEssayMG:', error.message);

    const errorPayload = {
      recordId: workerData.recordId,
      targetFieldId: workerData.targetFieldId,
      status_message: `Error: ${error.message}`,
    };

    await axios.post(process.env.WEBHOOK_URL_ESSAYMG, errorPayload);
    console.log('Error sent to Airtable via webhook');
    parentPort.postMessage({ status: 'error', error: error.message });
  }
}

processEssayMG();
