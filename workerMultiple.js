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

    // Step 1: Generate Mark Breakdown and Total Mark using markingPrompt
    const { markBreakdown, totalMark } = await generateMarkAndBreakdown(workerData.markingPrompt);
    if (!markBreakdown || !totalMark) {
      throw new Error('Failed to generate mark breakdown or total mark.');
    }

    // Step 2: Generate Feedback using feedbackPrompt, markBreakdown, and totalMark
    const feedback = await generateFeedback(workerData.feedbackPrompt, markBreakdown, totalMark);
    if (!feedback) {
      throw new Error('Failed to generate feedback.');
    }

    // Log the raw response from OpenAI for debugging
    console.log('Raw API response from OpenAI for marking breakdown and feedback:', {
      markBreakdown,
      totalMark,
      feedback
    });

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

    // Return structured breakdown and total mark
    return { markBreakdown: structuredResponse.breakdown, totalMark: structuredResponse.mark };
  } catch (error) {
    console.error('Error generating mark breakdown and total mark:', error.message);
    return { markBreakdown: null, totalMark: null };
  }
}

// Generate Feedback based on Mark Breakdown and Total Mark
async function generateFeedback(feedbackPrompt, markBreakdown, totalMark) {
  try {
    const userPrompt = `The student got this total mark: ${totalMark}. The student got this mark breakdown: ${markBreakdown}. ${feedbackPrompt}`;
    
    // Log the prompt
    console.log('User prompt:', userPrompt);

    const completion = await openai.chat.completions.create({
      model: workerData.model,
      messages: [
        { role: 'system', content: 'You are a teacher providing feedback for a student based on the mark breakdown and total mark.' },
        { role: 'user', content: userPrompt }
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
