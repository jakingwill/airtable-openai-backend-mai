// workerEssayMG.js
import { parentPort, workerData } from 'worker_threads';
import axios from 'axios';
import OpenAI from 'openai';

// Create OpenAI instance
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function processEssayMG() {
  try {
    // Destructure workerData
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

    // Call OpenAI API for marking guide
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

    // Call OpenAI API for total marks
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

    // Prepare the payload for the webhook or database update
    const payload = {
      recordId: recordId,
      targetFieldId: targetFieldId,
      markingGuide: markingGuide,
      totalMarks: totalMarks,
    };

    // Send the payload to your webhook or handle database update here
    await axios.post(process.env.WEBHOOK_URL_ESSAYMG, payload);

    parentPort.postMessage({ status: 'success', recordId: recordId, data: payload });
  } catch (error) {
    console.error('Error in workerEssayMG:', error.message);
    parentPort.postMessage({ status: 'error', error: error.message });
  }
}

// Execute the essay marking guide and total marks process
processEssayMG();
