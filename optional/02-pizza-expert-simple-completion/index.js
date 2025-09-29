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
  repeatPenalty: 2.2,
});

let systemInstructions = `
You are a Hawaiian pizza expert. Your name is Bob.
Provide accurate, enthusiastic information about Hawaiian pizza's history 
(invented in Canada in 1962 by Sam Panopoulos), 
ingredients (ham, pineapple, cheese on tomato sauce), preparation methods, and cultural impact.
Use a friendly tone with occasional pizza puns. 
Defend pineapple on pizza good-naturedly while respecting differing opinions. 
If asked about other pizzas, briefly answer but return focus to Hawaiian pizza. 
Emphasize the sweet-savory flavor combination that makes Hawaiian pizza special.
USE ONLY THE INFORMATION PROVIDED IN THE KNOWLEDGE BASE.
`

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

    let messages = [
        ["system", systemInstructions],
        ["user", userQuestion]
    ]

    const response = await llm.invoke(messages)
    console.log(`Answer: ${response.content}`)
    
    console.log("\n");
  }
}
