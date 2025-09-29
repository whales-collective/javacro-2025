import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings} from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'

import { readTextFilesRecursively } from './helpers.js'
import { MemoryVectorStore } from "langchain/vectorstores/memory";


import prompts from "prompts";
import fs from 'fs';

import { z } from "zod"
import { tool } from "@langchain/core/tools"


const llm = new ChatOpenAI({
  model: process.env.MODEL_RUNNER_LLM_CHAT || `hf.co/menlo/jan-nano-gguf:q4_k_m`,
  apiKey: "",
  configuration: {
    baseURL: process.env.MODEL_RUNNER_BASE_URL || "http://localhost:12434/engines/llama.cpp/v1/",
  },
  temperature: parseFloat(process.env.OPTION_TEMPERATURE) || 0.0,
  repeat_last_n: parseInt(process.env.OPTION_REPEAT_LAST_N) || 2,
  repeat_penalty: parseFloat(process.env.OPTION_REPEAT_PENALTY) || 2.2,
  top_k: parseInt(process.env.OPTION_TOP_K) || 10,
  top_p: parseFloat(process.env.OPTION_TOP_P) || 0.5,
});

const llmEmbeddings = new OpenAIEmbeddings({
    model: process.env.MODEL_RUNNER_LLM_EMBEDDING || "ai/granite-embedding-multilingual:latest",
    configuration: {
    baseURL: process.env.MODEL_RUNNER_BASE_URL || "http://localhost:12434/engines/llama.cpp/v1/",
        apiKey: ""
    }
})


// ---[BEGIN][Create the embeddings]-------

//! ----------------------------------------------------------------
//!  Create the embeddings
//! ----------------------------------------------------------------
console.log("========================================================")
console.log("🦜 Embeddings model:", llmEmbeddings.model)
console.log("📝 Creating embeddings...")
let contentPath = process.env.CONTENT_PATH || "./data"

// Create a "text splitter" to break the documents into smaller chunks
const splitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
  chunkSize: 512,
  chunkOverlap: 128,
})

// Read the text files recursively from the content path
let contentFromFiles = readTextFilesRecursively(contentPath, [".md"])

// Initialize the vector store
const vectorStore = new MemoryVectorStore(llmEmbeddings)

// Create the embeddings and add them to the vector store
const chunks = await splitter.createDocuments(contentFromFiles);
console.log("📝 Number of chunks created:", chunks.length);
await vectorStore.addDocuments(chunks);


console.log("========================================================")

// ---[END][Create the embeddings]-------


// ---[START][Tool calling]-------

let pizzeriaAddressesSchema = z.object({
  city: z.string().describe("name of the city")
})


//! ----------------------------------------------------------------
//!  This a tool that retrieves pizzeria addresses for a given city
//! ----------------------------------------------------------------
const retrievePizzeriaAddressesTool = tool(
  async ({ city }) => {
    switch (city.toLowerCase()) {
      case "paris":
        return {
          "name": "Pink Flamingo",
          "address": "67 Rue Bichat, 75010 Paris",
          "website": "https://www.pinkflamingopizza.fr",
          "phone": "+33 1 42 02 31 70",
          "specialty": "La Bjork (pineapple, ham, mozzarella)",
          "description": "Known for creative and unusual pizzas, Pink Flamingo offers a hip atmosphere and their famous Hawaiian-style pizza with fresh pineapple."
        }
      case "roma":
        return {
          "name": "Pizzeria Ai Marmi",
          "address": "Via dei Marmi, 53, 00153 Roma RM",
          "website": "https://www.pizzeriaimarmi.com",
          "phone": "+39 06 580 0919",
          "specialty": "Pizza Tropicale (pineapple, ham, mozzarella)",
          "description": "Known as 'L'Obitorio' (The Morgue) by locals due to its marble tables, this classic Roman pizzeria serves thin, crispy pizzas including a special Hawaiian version for international visitors."
        }
      default:
        return "I only know Paris and Roma"
    }
  },
  {
    name: "retrievePizzeriaAddresses",
    description: "Retrieve pizzeria addresses for a given city",
    schema: pizzeriaAddressesSchema,
  }
)

// Create the Model Runner Client for Tools
const llmWithTools = llm.bindTools([
  retrievePizzeriaAddressesTool
])

let toolMapping = {
    "retrievePizzeriaAddresses": retrievePizzeriaAddressesTool,
}
// ---[END][Tool calling]-------


// Load the system instructions from a file
let systemInstructions = fs.readFileSync(process.env.SYSTEM_INSTRUCTIONS_PATH || "./docs/system-instructions.md", 'utf8')


//! ----------------------------------------------------------------
// Initialize a Map to store conversations by session
//! ----------------------------------------------------------------
const conversationMemory = new Map()
// Get conversation history for this session


let exit = false;
while (!exit) {
  const { userMessage } = await prompts({
    type: "text",
    name: "userMessage",
    message: "🤖 Your question: ",
    validate: (value) => (value ? true : "😡 Question cannot be empty"),
  });

  if (userMessage == "/bye") {
    console.log("👋 See you later!");
    exit = true;
  } else {

    const history = getConversationHistory("default-session-id")

    //? -------------------------------------------------
    //? Check if there are one or several tool calls
    //? -------------------------------------------------
    let llmOutput = await llmWithTools.invoke(userMessage,{
      parallel_tool_calls: true
    })

    //? Detected tools
    for (let toolCall of llmOutput.tool_calls) {
        console.log("🛠️ Tool:", toolCall.name, "Args:", toolCall.args)
    }

    let toolCallsResults = ""
    // Invoke the tools
    for (let toolCall of llmOutput.tool_calls) {
        let functionToCall = toolMapping[toolCall.name]
        let result = await functionToCall.invoke(toolCall.args)
        console.log("🤖 Result for:", toolCall.name, "with:", toolCall.args, "=", result)
        toolCallsResults += `\n${JSON.stringify(result)}\n` 
    }

    let messages = []
    if (toolCallsResults.length > 0) {
      console.log("🟢 Tools calling...")
      messages = [
        //...history,
        ["system", `Pizzerias addresses:\n${toolCallsResults}`],
        ["user", "Display the above addresses."]
      ]

    } else { // Regular chat without tools
      console.log("🔵 Regular chat")

      //? ----------------------------------------------------------------
      //? Search for similarities
      //? ----------------------------------------------------------------
      const similaritySearchResults = await vectorStore.similaritySearch(userMessage,3)

      //? Create the knowledge base from the similarity search results
      let knowledgeBase = `KNOWLEDGE BASE:\n`
      for (const doc of similaritySearchResults) {
        console.log("📝",`* ${doc.pageContent} [${JSON.stringify(doc.metadata, null)}]`);
        knowledgeBase += `${doc.pageContent}\n`
      }

      console.log("========================================================")
      console.log()

      //? Construct messages array with:
      // system instructions, 
      // context, history, and new message
      messages = [
          ...history,
          ["system", systemInstructions],
          ["system", knowledgeBase],
          ["user", userMessage]
      ]

    }
    
    let assistantResponse = ''
    const stream = await llm.stream(messages);
    for await (const chunk of stream) {
      assistantResponse += chunk.content
      process.stdout.write(chunk.content);
    }
    console.log("\n");

    //? Add both user message and assistant response to history
    addToHistory("default-session-id", "user", userMessage)
    addToHistory("default-session-id", "assistant", assistantResponse)


  }
}

// Helper function to get or create a conversation history
function getConversationHistory(sessionId, maxTurns = parseInt(process.env.HISTORY_MESSAGES)) {
  if (!conversationMemory.has(sessionId)) {
    conversationMemory.set(sessionId, [])
  }
  return conversationMemory.get(sessionId)
}

// Helper function to add a message to the conversation history
function addToHistory(sessionId, role, content) {
  const history = getConversationHistory(sessionId)
  history.push([role, content])
  
  // Keep only the last maxTurns conversations
  const maxTurns = parseInt(process.env.HISTORY_MESSAGES) // Adjust this value based on your needs
  if (history.length > maxTurns * 2) { // *2 because each turn has user & assistant message
    history.splice(0, 2) // Remove oldest turn (user + assistant messages)
  }
}