# Airtable OpenAI Backend

The purpose of this simple backend is to circumvent Airtable's 30 seconds limit in automation scripts. It acts as a proxy between Airtable and the OpenAI API. Instead of a synchronous request, it's asynchronous and will immediately return a 200 if the request was received properly. The server then waits for the response from OpenAI and will then send a request to an Airtable webhook (incoming webhook automation trigger).This request includes the generated message, a triggering record id and a "target field id". The record id and target field id are sent in order to write an update on that record and in a particular field.

Instructions:

1. Deploy to your favorite PaaS / Server: render.com, Heroku, Railway, Vercel, ...
2. Add your OpenAI API key, the incoming webhook trigger endpoint from Airtable and your "App API key" (random api key you define yourself) as environment variables ("OPENAI_API_KEY", "WEBHOOK_URL", "APP_API_KEY")
3. Send a POST request with the necessary body parameters (prompt, maxTokens, model, targetFieldId, recordId, systemRole, temperature) to "https://YOURADDRESS/generate"
4. Once text completion is finished, the generated messsage will be sent to the Airtable endpoint incl. the record and field id in order to process the message further.
