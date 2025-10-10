import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings} from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'

import { readTextFilesRecursively } from './helpers.js'
import { MemoryVectorStore } from "langchain/vectorstores/memory";

import prompts from "prompts";
import fs from 'fs';

// Define [CHAT MODEL] Connection
const chatModel = new ChatOpenAI({
  model: process.env.MODEL_RUNNER_LLM_CHAT || `ai/qwen2.5:latest`,
  apiKey: "",
  configuration: {
    baseURL: process.env.MODEL_RUNNER_BASE_URL || "http://localhost:12434/engines/llama.cpp/v1/",
  },
  temperature: parseFloat(process.env.OPTION_TEMPERATURE) || 0.0,
  top_p: parseFloat(process.env.OPTION_TOP_P) || 0.5,
});

// Define [EMBEDDINGS MODEL] Connection
const embeddingsModel = new OpenAIEmbeddings({
    model: process.env.MODEL_RUNNER_LLM_EMBEDDING || "ai/granite-embedding-multilingual:latest",
    configuration: {
    baseURL: process.env.MODEL_RUNNER_BASE_URL || "http://localhost:12434/engines/llama.cpp/v1/",
        apiKey: ""
    }
})

const maxSimilarities = parseInt(process.env.MAX_SIMILARITIES) || 3

// ---[BEGIN:][CHUNKS & EMBEDDINGS]-------
// ----------------------------------------------------------------
//  Create the embeddings
// ----------------------------------------------------------------
console.log("========================================================")
console.log("🦜 Embeddings model:", embeddingsModel.model)
console.log("📝 Creating embeddings...")
let contentPath = process.env.CONTENT_PATH || "./data"

// Create a [TEXT SPLITTER] to break the documents into smaller [CHUNKS]
const splitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
  chunkSize: parseInt(process.env.CHUNK_SIZE) || 768,
  chunkOverlap: parseInt(process.env.CHUNK_OVERLAP) || 256,
})

// Read the text files recursively from the content path
let contentFromFiles = readTextFilesRecursively(contentPath, [".md"])

// Initialize the [VECTOR STORE]
const vectorStore = new MemoryVectorStore(embeddingsModel)

// Create the [EMBEDDINGS] and add them to the [VECTOR STORE]
const chunks = await splitter.createDocuments(contentFromFiles);
console.log("📝 Number of chunks created:", chunks.length);
await vectorStore.addDocuments(chunks);

console.log("========================================================")

// ---[END:][CHUNKS & EMBEDDINGS]-------

// SYSTEM INSTRUCTIONS: 
// Load the system instructions from a file
let systemInstructions = fs.readFileSync(process.env.SYSTEM_INSTRUCTIONS_PATH || "./docs/system-instructions.md", 'utf8')

// ----------------------------------------------------------------
// HISTORY: Initialize a Map to store conversations by session
// ----------------------------------------------------------------
const conversationMemory = new Map()
// Get conversation history for this session

let exit = false;
// CHAT LOOP:
while (!exit) {
  const { userMessage } = await prompts({
    type: "text",
    name: "userMessage",
    message: `🤖 Your question (${chatModel.model}): `,
    validate: (value) => (value ? true : "😡 Question cannot be empty"),
  });

  if (userMessage == "/bye") {
    console.log("👋 See you later!");
    exit = true;
  } else if (userMessage == "/messages") {
    displayMessages("default-session-id");
  } else {

    // HISTORY: Get the conversation history for this session
    const history = getConversationHistory("default-session-id")

    // ----------------------------------------------------------------
    // SIMILARITY SEARCH:
    // ----------------------------------------------------------------
    const similaritySearchResults = await vectorStore.similaritySearch(userMessage, maxSimilarities)

    // Create the [KNOWLEDGE BASE] from the [SIMILARITY SEARCH RESULTS]
    let knowledgeBase = `KNOWLEDGE BASE:\n`
    for (const doc of similaritySearchResults) {
      console.log("📝",`* ${doc.pageContent} [${JSON.stringify(doc.metadata, null)}]`);
      knowledgeBase += `${doc.pageContent}\n`
    }

    console.log("========================================================")
    console.log()

    // MESSAGES:
    let messages = [
        ...history,
        ["system", systemInstructions],
        ["system", knowledgeBase],
        ["user", userMessage]
    ]
    
    let assistantResponse = ''
    // STREAMING COMPLETION:
    const stream = await chatModel.stream(messages);
    for await (const chunk of stream) {
      assistantResponse += chunk.content
      process.stdout.write(chunk.content);
    }
    console.log("\n");

    // HISTORY: Add both user message and assistant response to history
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