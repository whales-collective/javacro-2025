import { OpenAIEmbeddings } from '@langchain/openai';
import { cosineSimilarity } from './rag.js';

const chunks = [
  'Squirrels run in the forest',
  'Birds fly in the sky',
  'Frogs swim in the pond',
  'Fishes swim in the sea'
];

function isGoodCosineSimilarity(similarity) {
  return similarity > 0.65 ? '✅' : '❌';
}

async function main() {
  const baseURL = process.env.MODEL_RUNNER_BASE_URL || "http://localhost:12434/engines/llama.cpp/v1/";
  //const baseURL = process.env.MODEL_RUNNER_BASE_URL || "http://model-runner.docker.internal/engines/llama.cpp/v1";
  const embeddingsModel = process.env.MODEL_RUNNER_EMBEDDING || "ai/mxbai-embed-large";


  console.log(baseURL);
  console.log(embeddingsModel);

  const embeddings = new OpenAIEmbeddings({
    model: embeddingsModel,
    openAIApiKey: "tada",
    configuration: {
      baseURL: baseURL
    }
  });

  // -------------------------------------------------
  // USER MESSAGE: Generate embeddings from user question
  // -------------------------------------------------
  const userQuestion = "Which animals swim?";
  
  console.log("⏳ Creating embeddings from user question...:", userQuestion);

  try {
    const embeddingsFromUserQuestion = await embeddings.embedQuery(userQuestion);

    // -------------------------------------------------
    // Generate embeddings from chunks
    // -------------------------------------------------
    console.log("⏳ Creating embeddings from chunks...");

    for (const chunk of chunks) {
      try {
        const chunkEmbeddings = await embeddings.embedQuery(chunk);
        
        const similarity = cosineSimilarity(chunkEmbeddings, embeddingsFromUserQuestion);
        console.log(`🔗 Cosine similarity with ${chunk} = ${similarity} ${isGoodCosineSimilarity(similarity)}`);
        
      } catch (error) {
        console.error(`Error processing chunk "${chunk}":`, error);
      }
    }
    
  } catch (error) {
    console.error("Error processing user question:", error);
  }
}

main().catch(console.error);