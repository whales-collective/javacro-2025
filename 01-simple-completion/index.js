import { ChatOpenAI } from "@langchain/openai";
import prompts from "prompts";

// Define [CHAT MODEL] Connection
const chatModel = new ChatOpenAI({
  model: process.env.MODEL_RUNNER_LLM_CHAT || `ai/qwen2.5:latest`,
  apiKey: "",
  configuration: {
    baseURL: process.env.MODEL_RUNNER_BASE_URL || `http://localhost:12434/engines/llama.cpp/v1/`,
  },
  temperature: 0.5, // Controls randomness and creativity in responses
  topP: 0.7, // Controls diversity by limiting token selection

});

let exit = false;
// CHAT LOOP:
while (!exit) {
  const { userQuestion } = await prompts({
    type: "text",
    name: "userQuestion",
    message: "🤖 Your question: ",
    validate: (value) => (value ? true : "😡 Question cannot be empty"),
  });

  if (userQuestion == "/bye") {
    console.log("👋 See you later!");
    exit = true;
  } else {

    // MESSAGES:
    let messages = [
        ["user", userQuestion]
    ]

    // COMPLETION:
    const response = await chatModel.invoke(messages)
    console.log(`Answer: ${response.content}`)
    
    console.log("\n");
  }
}
