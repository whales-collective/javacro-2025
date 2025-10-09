import { ChatOpenAI } from "@langchain/openai";
import prompts from "prompts";
import dotenv from "dotenv";

dotenv.config();

const llm = new ChatOpenAI({
  model: process.env.MODEL_RUNNER_LLM_CHAT || `ai/qwen2.5:latest`,
  apiKey: "",
  configuration: {
    baseURL: process.env.MODEL_RUNNER_BASE_URL,
  },
  temperature: 0.5,
  topP: 0.7,

});

let systemInstructions = process.env.SYSTEM_INSTRUCTIONS || `You are an Hawaiian pizza expert.`;

let knowledgeBase = process.env.KNOWLEDGE_BASE || ``

// MESSAGES:
let messages = [
  ["system", systemInstructions],
  ["system", knowledgeBase],
]

let exit = false;
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
    // MEMORY:
    messages.push(["user", userQuestion]);

    let answer = "";
    // COMPLETION:
    const stream = await llm.stream(messages);
    for await (const chunk of stream) {
      process.stdout.write(chunk.content);
      answer += chunk.content;
    }
    console.log("\n");
    // MEMORY:
    messages.push(["assistant", answer]);
  }
}
