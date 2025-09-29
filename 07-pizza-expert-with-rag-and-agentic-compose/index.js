import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings} from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'

import { readTextFilesRecursively } from './helpers.js'
import { MemoryVectorStore } from "langchain/vectorstores/memory";


import prompts from "prompts";
import fs from 'fs';


const llm = new ChatOpenAI({
  model: process.env.MODEL_RUNNER_LLM_CHAT || `ai/qwen2.5:latest`,
  apiKey: "",
  configuration: {
    baseURL: process.env.MODEL_RUNNER_BASE_URL || "http://localhost:12434/engines/llama.cpp/v1/",
  },
  temperature: parseFloat(process.env.OPTION_TEMPERATURE) || 0.0,
  repeat_last_n: parseInt(process.env.OPTION_REPEAT_LAST_N) || 2,
  //repeat_penalty: parseFloat(process.env.OPTION_REPEAT_PENALTY) || 2.2,
  //top_k: parseInt(process.env.OPTION_TOP_K) || 10,
  top_p: parseFloat(process.env.OPTION_TOP_P) || 0.5,
});

const llmEmbeddings = new OpenAIEmbeddings({
    model: process.env.MODEL_RUNNER_LLM_EMBEDDING || "ai/granite-embedding-multilingual:latest",
    configuration: {
    baseURL: process.env.MODEL_RUNNER_BASE_URL || "http://localhost:12434/engines/llama.cpp/v1/",
        apiKey: ""
    }
})


// ---[BEGIN:][Create the embeddings]-------

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

// ---[END:][Create the embeddings]-------

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
  } else if (userMessage == "/messages") {
    displayMessages("default-session-id");
  } else {

    const history = getConversationHistory("default-session-id")

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


    let messages = [
        ...history,
        ["system", systemInstructions],
        ["system", knowledgeBase],
        ["user", userMessage]
    ]
    
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

// Helper function to display conversation messages
function displayMessages(sessionId) {
  const history = getConversationHistory(sessionId)
  if (history.length === 0) {
    console.log("📝 No messages in conversation history.");
    return;
  }

  console.log("========================================================");
  console.log("📋 Conversation History:");
  console.log("========================================================");

  for (let i = 0; i < history.length; i++) {
    const [role, content] = history[i];
    const emoji = role === "user" ? "👤" : "🤖";
    console.log(`${emoji} ${role.toUpperCase()}: ${content}`);
    console.log("────────────────────────────────────────────────────────");
  }
  console.log();
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