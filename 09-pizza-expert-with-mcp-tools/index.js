import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings} from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'

import { readTextFilesRecursively } from './helpers.js'
import { MemoryVectorStore } from "langchain/vectorstores/memory";

import prompts from "prompts";
import fs from 'fs';

// MCP helpers
import { fetchTools, transformToLangchainTools } from "./mcp.helpers.js"
//! MCP
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";


// ---[BEGIN:][MCP]-------
// Set up the StreamableHTTP client transport
const bearerToken = process.env.BEARER_TOKEN;

// Set up the StreamableHTTP client transport (with auth headers)
const transport = new StreamableHTTPClientTransport(new URL(`${process.env.MCP_SERVER_BASE_URL}/mcp`), {
  authProvider: {
    tokens: async () => {
      return {
        access_token: bearerToken,
      };
    }
  },
});

// Create the [MCP] Client
const mcpClient = new Client(
  {
    name: "mcp-http-client",
    version: "1.0.0",
    auth: {
      type: "bearer",
      token: bearerToken,
    },
  },
  {
    capabilities: {
      prompts: {},
      resources: {},
      tools: {},
      logging: {},
    },
  }
);

await mcpClient.connect(transport);
console.log("🟢✅ Connected to MCP Server!");

// Fetch [TOOLS] from the [MCP] server
let mcpTools = await fetchTools(mcpClient);

// display the fetched tools
if (mcpTools && mcpTools.tools) {
  console.log("🟢✅ Fetched tools:");
  mcpTools.tools.forEach((tool) => {
    console.log("  🔨 tool:", tool.name);
    console.log("  🔨 schema:", tool.inputSchema);
  });
} else {
  console.log("❌ No tools fetched or invalid format.");
}

console.log("🛠️ Transforming MCP tools to Langchain tools...");

// Transform [MCP] [TOOLS] to [LangChain] tools
let langchainTools = transformToLangchainTools(mcpTools);

// ---[END:][MCP]-------

// Define [CHAT MODEL] Connection with [TOOLS] support
const chatModelWithToolsSupport = new ChatOpenAI({
  model: process.env.MODEL_RUNNER_LLM_CHAT || `hf.co/menlo/jan-nano-gguf:q4_k_m`,
  apiKey: "",
  configuration: {
    baseURL: process.env.MODEL_RUNNER_BASE_URL || "http://localhost:12434/engines/llama.cpp/v1/",
  },
  temperature: parseFloat(process.env.OPTION_TEMPERATURE) || 0.0,
  top_k: parseInt(process.env.OPTION_TOP_K) || 10,
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
  chunkSize: 512,
  chunkOverlap: 128,
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


// Create the [CHAT MODEL] Runner Client for [TOOLS]
const runner = chatModelWithToolsSupport.bindTools(langchainTools)

// SYSTEM INSTRUCTIONS:
// Load the system instructions from a file
let systemInstructions = fs.readFileSync(process.env.SYSTEM_INSTRUCTIONS_PATH || "./docs/system-instructions.md", 'utf8')

// ----------------------------------------------------------------
// Initialize a Map to store conversations by session
// ----------------------------------------------------------------
// HISTORY:
const conversationMemory = new Map()
// Get conversation history for this session

let exit = false;
// CHAT LOOP:
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

    // HISTORY: Get the conversation history for this session
    const history = getConversationHistory("default-session-id")

    // -------------------------------------------------
    // [TOOL CALLS]
    // -------------------------------------------------
    
    // Invoke the runner for [TOOL CALLS DETECTION]
    let output = await runner.invoke(userMessage,{
      parallel_tool_calls: true
    })

    // Parse tools and Invoke the tools
    let toolCallsResults = ""
    //console.log("🟢 Tool calls detection...")
    for (let toolCall of output.tool_calls) {
        console.log("- 🛠️ Tool:", toolCall.name, "Args:", toolCall.args)

        toolCallsResults += `### ${toolCall.name} ${toolCall.args}:\n`

        // [TOOL CALL RESULT]
        let result = await mcpClient.callTool({
          name: toolCall.name,
          arguments: toolCall.args,
        });
        toolCallsResults += `\n${JSON.stringify(result)}\n` 

        console.log("✅ Result:", result)
    }

    // Construct messages array with:
    // system instructions, 
    // context, history, and new message
    // MESSAGES: + HISTORY:
    let messages = [
        ...history,
        ["system", systemInstructions],
    ]

    if (toolCallsResults.length > 0) {
      console.log("🟢 Tools calling...")
      // MESSAGES:
      messages.push(["system", toolCallsResults])
    } else { // Regular chat without tools
      console.log("🔵 Regular chat")
    }
    
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
    messages.push(["system", knowledgeBase])
    messages.push(["user", userMessage])

    let assistantResponse = ''
    const stream = await chatModelWithToolsSupport.stream(messages);
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