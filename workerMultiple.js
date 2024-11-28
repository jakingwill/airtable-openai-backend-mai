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

    if (!workerData.markingPrompt || !workerData.feedbackPrompt) {
      throw new Error('Marking prompt or feedback prompt is missing or undefined.');
    }

    // Step 1: Get Mark Breakdown and Total Mark using markingPrompt
    const { markBreakdown, totalMark } = await generateMarkAndBreakdown(workerData.markingPrompt);
    if (!markBreakdown || !totalMark) {
      throw new Error('Failed to generate mark breakdown or total mark.');
    }

    // Step 2: Get Student Feedback using feedbackPrompt
    const feedback = await generateFeedback(workerData.feedbackPrompt, markBreakdown, totalMark);
    if (!feedback) {
      throw new Error('Failed to generate feedback.');
    }

    // Prepare the payload for the webhook
    const payload = {
      recordId: workerData.recordId,
      targetFieldId: workerData.targetFieldId,
      mark: totalMark,
      feedback,
      breakdown: markBreakdown,
    };

    // Send the response to the webhook
    await axios.post(process.env.WEBHOOK_URL_MULTIPLE, payload);

    // Notify the main thread of success
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

// Generate Mark Breakdown and Total Mark
async function generateMarkAndBreakdown(markingPrompt) {
  try {
    const completion = await openai.chat.completions.create({
      model: workerData.model,
      messages: [
        { role: 'system', content: 'You are a teacher providing a detailed mark breakdown and the total mark for an assessment.' },
        { role: 'user', content: markingPrompt }
      ],
      max_tokens: workerData.maxTokens,
      temperature: workerData.temperature,
    });

    // Extract both the breakdown and total mark from the response
    const response = completion.choices[0].message.content;
    const { breakdown, totalMark } = parseMarkAndBreakdown(response);

    return { markBreakdown: breakdown, totalMark };
  } catch (error) {
    console.error('Error generating mark breakdown and total mark:', error.message);
    return { markBreakdown: null, totalMark: null };
  }
}

// Parse the breakdown and total mark from the response
function parseMarkAndBreakdown(response) {
  // Logic to extract mark breakdown and total mark from the response
  // Adjust this as per your model's output format
  const breakdownMatch = response.match(/Mark Breakdown:\s*(.*?)(?=\n|$)/);
  const totalMarkMatch = response.match(/Total Mark:\s*(\d+)/);

  const breakdown = breakdownMatch ? breakdownMatch[1] : 'No breakdown available';
  const totalMark = totalMarkMatch ? totalMarkMatch[1] : 'No total mark available';

  return { breakdown, totalMark };
}

// Generate Feedback based on Mark Breakdown and Total Mark
async function generateFeedback(feedbackPrompt, markBreakdown, totalMark) {
  try {
    const completion = await openai.chat.completions.create({
      model: workerData.model,
      messages: [
        { role: 'system', content: 'You are a teacher providing feedback for a student based on the mark breakdown and total mark.' },
        { role: 'user', content: `Given this mark breakdown: ${markBreakdown} and this total mark: ${totalMark}. ${feedbackPrompt} ` }
      ],
      max_tokens: workerData.maxTokens,
      temperature: workerData.temperature,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error generating feedback:', error.message);
    return null;
  }
}

// Execute the worker task
processQuestion();

