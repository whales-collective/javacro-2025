import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings} from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'

import { readTextFilesRecursively } from './helpers.js'
import { MemoryVectorStore } from "langchain/vectorstores/memory";

import prompts from "prompts";
import fs from 'fs';

import { z } from "zod"
import { tool } from "@langchain/core/tools"

// MCP helpers
import { fetchTools, transformToLangchainTools } from "./mcp.helpers.js"
//! MCP
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";


// ---[BEGIN][Model Context Protocol]-------

//! ----------------------------------------------------------------
//! Create the MCP Client
//! ----------------------------------------------------------------
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

// Create the MCP Client
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

//! Fetch tools
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

let langchainTools = transformToLangchainTools(mcpTools);

// ---[END][Model Context Protocol]-------

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

// Create the Model Runner Client for Tools
const llmWithTools = llm.bindTools(langchainTools)

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

    //? Detected tools and Invoke the tools
    let toolCallsResults = ""
    //console.log("🟢 Tool calls detection...")
    for (let toolCall of llmOutput.tool_calls) {
        console.log("- 🛠️ Tool:", toolCall.name, "Args:", toolCall.args)

        toolCallsResults += `### ${toolCall.name} ${toolCall.args}:\n`

        let result = await mcpClient.callTool({
          name: toolCall.name,
          arguments: toolCall.args,
        });
        toolCallsResults += `\n${JSON.stringify(result)}\n` 

        console.log("✅ Result:", result)
    }

    //? Construct messages array with:
    // system instructions, 
    // context, history, and new message
    let messages = [
        ...history,
        ["system", systemInstructions],
        //["system", knowledgeBase],
        //["user", userMessage]
    ]

    if (toolCallsResults.length > 0) {
      console.log("🟢 Tools calling...")
      messages.push(["system", toolCallsResults])
    } else { // Regular chat without tools
      console.log("🔵 Regular chat")

    }
    
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

    messages.push(["system", knowledgeBase])
    messages.push(["user", userMessage])

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