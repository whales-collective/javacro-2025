import { ChatOpenAI } from "@langchain/openai";
import prompts from "prompts";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const chatModel = new ChatOpenAI({
  model: process.env.MODEL_RUNNER_LLM_CHAT || `ai/qwen2.5:latest`,
  apiKey: "",
  configuration: {
    baseURL: process.env.MODEL_RUNNER_BASE_URL,
  },
  temperature: parseFloat(process.env.OPTION_TEMPERATURE) || 0.0,
  top_p: parseFloat(process.env.OPTION_TOP_P) || 0.5,
  top_k: parseInt(process.env.OPTION_TOP_K) || 10,
  repeat_penalty: parseFloat(process.env.OPTION_REPEAT_PENALTY) || 2.2,
  presence_penalty: parseFloat(process.env.OPTION_PRESENCE_PENALTY) || 1.5,
  max_tokens: parseInt(process.env.OPTION_MAX_TOKENS) || 350,
  min_p: parseFloat(process.env.OPTION_MIN_P) || 0.05,
  
});

// SYSTEM INSTRUCTIONS: 
let systemInstructions = fs.readFileSync(process.env.SYSTEM_INSTRUCTIONS_PATH || "./docs/system-instructions.md", 'utf8')

let contentPath = process.env.CONTENT_PATH || "./data"
let knowledgeDocument = fs.readFileSync(contentPath + "/hawaiian-pizza-knowledge-base.md", 'utf8')
let popularQuestionsDocument = fs.readFileSync(contentPath + "/popular-questions-and-answers.md", 'utf8')

let knowledgeBase = `KNOWLEDGE BASE: 
  ${knowledgeDocument}

  POPULAR QUESTIONS AND ANSWERS:
  ${popularQuestionsDocument}
`

// MESSAGES:
let messages = [
  ["system", systemInstructions],
  ["system", knowledgeBase],
]

let exit = false;
// CHAT LOOP:
while (!exit) {
  const { userQuestion } = await prompts({
    type: "text",
    name: "userQuestion",
    message: `🤖 Your question (${chatModel.model}): `,
    validate: (value) => (value ? true : "😡 Question cannot be empty"),
  });

  if (userQuestion == "/bye") {
    console.log("👋 See you later!");
    exit = true;
  } else if (userQuestion == "/messages") {
    console.log("📝 Message history:");
    messages.forEach((message, index) => {
      const [role, content] = message;
      console.log(`${index + 1}. [${role}] ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
    });
    console.log("\n");
  } else {

    // MEMORY:
    messages.push(["user", userQuestion]);

    let answer = "";
    const stream = await chatModel.stream(messages);
    for await (const chunk of stream) {
      process.stdout.write(chunk.content);
      answer += chunk.content;
    }
    console.log("\n");
    
    // MEMORY:
    messages.push(["assistant", answer]);

    console.log("\n");
  }
}
