import { OpenAIEmbeddings } from '@langchain/openai';
import { VectorRecord, MemoryVectorStore } from './rag.js';

const chunks = [
  'Squirrels run in the forest',
  'Birds fly in the sky',
  'Frogs swim in the pond',
  'Fishes swim in the sea'
];

async function main() {
  //const baseURL = process.env.MODEL_RUNNER_BASE_URL || "http://localhost:12434/engines/llama.cpp/v1/";
  const baseURL = process.env.MODEL_RUNNER_BASE_URL || "http://model-runner.docker.internal/engines/llama.cpp/v1";
  const embeddingsModel = process.env.MODEL_RUNNER_EMBEDDING || "ai/mxbai-embed-large";

  const embeddings = new OpenAIEmbeddings({
    model: embeddingsModel,
    openAIApiKey: "tada",
    configuration: {
      baseURL: baseURL
    }
  });

  // -------------------------------------------------
  // Create a vector store
  // -------------------------------------------------
  const store = new MemoryVectorStore();

  // -------------------------------------------------
  // Create and save the embeddings from the chunks
  // -------------------------------------------------
  console.log("⏳ Creating embeddings from chunks...");

  for (const chunk of chunks) {
    try {
      const chunkEmbedding = await embeddings.embedQuery(chunk);
      
      const vectorRecord = new VectorRecord('', chunk, chunkEmbedding);
      store.save(vectorRecord);
      
    } catch (error) {
      console.error(`Error processing chunk "${chunk}":`, error);
    }
  }

  console.log("✋ Embeddings created, total of records", store.records.size);
  console.log();

  // -------------------------------------------------
  // Search for similarities
  // -------------------------------------------------
  // USER MESSAGE:
  // const userQuestion = "Where are the squirrels?";
  const userQuestion = "What can be found in the pond?";
  // const userQuestion = "Which animals swim?";

  console.log(`⏳ Searching for similarities with "${userQuestion}"...`);

  try {
    // -------------------------------------------------
    // Create embedding from the user question
    // -------------------------------------------------
    const userQuestionEmbedding = await embeddings.embedQuery(userQuestion);

    // -------------------------------------------------
    // Create a vector record from the user embedding
    // -------------------------------------------------
    const embeddingFromUserQuestion = new VectorRecord('', '', userQuestionEmbedding);

    const similarities = store.searchTopNSimilarities(embeddingFromUserQuestion, 0.6, 2);
    // if the limit is too near from 1, the risk is to lose the best match

    for (const similarity of similarities) {
      console.log("✅ CosineSimilarity:", similarity.cosineSimilarity, "Chunk:", similarity.prompt);
    }
    console.log("✋ Similarities found, total of records", similarities.length);
    console.log();

  } catch (error) {
    console.error("😡:", error);
  }
}

main().catch(console.error);