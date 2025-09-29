import { ChatOpenAI } from "@langchain/openai";
import prompts from "prompts";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const llm = new ChatOpenAI({
  model: process.env.MODEL_RUNNER_LLM_CHAT || `ai/qwen2.5:latest`,
  apiKey: "",
  configuration: {
    baseURL: process.env.MODEL_RUNNER_BASE_URL,
  },
  temperature: 0.5,
  repeatPenalty: 2.2,
});

let systemInstructions = fs.readFileSync(process.env.SYSTEM_INSTRUCTIONS_PATH || "./docs/system-instructions.md", 'utf8')

let contentPath = process.env.CONTENT_PATH || "./data"
let knowledgeDocument = fs.readFileSync(contentPath + "/hawaiian-pizza-knowledge-base.md", 'utf8')
let popularQuestionsDocument = fs.readFileSync(contentPath + "/popular-questions-and-answers.md", 'utf8')

let knowledgeBase = `KNOWLEDGE BASE: 
${knowledgeDocument}

POPULAR QUESTIONS AND ANSWERS:
${popularQuestionsDocument}
`

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
  } else if (userQuestion == "/messages") {
    console.log("📝 Message history:");
    messages.forEach((message, index) => {
      const [role, content] = message;
      console.log(`${index + 1}. [${role}] ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
    });
    console.log("\n");
  } else {

    messages.push(["user", userQuestion]);

    let answer = "";
    const stream = await llm.stream(messages);
    for await (const chunk of stream) {
      process.stdout.write(chunk.content);
      answer += chunk.content;
    }
    console.log("\n");
    
    messages.push(["assistant", answer]);

    console.log("\n");
  }
}
