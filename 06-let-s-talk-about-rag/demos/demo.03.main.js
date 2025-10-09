import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai';
import { VectorRecord, MemoryVectorStore } from './rag.js';

const chunks = [
  `# Orcs
	Orcs are savage, brutish humanoids with dark green skin and prominent tusks. 
	These fierce warriors inhabit dense forests where they hunt in packs, 
	using crude but effective weapons forged from scavenged metal and bone. 
	Their tribal society revolves around strength and combat prowess, 
	making them formidable opponents for any adventurer brave enough to enter their woodland domain.`,

  `# Dragons
	Dragons are magnificent and ancient creatures of immense power, soaring through the skies on massive wings. 
	These intelligent beings possess scales that shimmer like precious metals and breathe devastating elemental attacks. 
	Known for their vast hoards of treasure and centuries of accumulated knowledge, 
	dragons command both fear and respect throughout the realm. 
	Their aerial dominance makes them nearly untouchable in their celestial domain.`,

  `# Goblins
	Goblins are small, cunning creatures with mottled green skin and sharp, pointed ears. 
	Despite their diminutive size, they are surprisingly agile swimmers who have adapted to life around ponds and marshlands. 
	These mischievous beings are known for their quick wit and tendency to play pranks on unwary travelers. 
	They build elaborate underwater lairs connected by hidden tunnels beneath the murky pond waters.`,

  `# Krakens
	Krakens are colossal sea monsters with massive tentacles that can crush entire ships with ease. 
	These legendary creatures dwell in the deepest ocean trenches, surfacing only to hunt or when disturbed. 
	Their intelligence rivals that of the wisest sages, and their tentacles can stretch for hundreds of feet. 
	Sailors speak in hushed tones of these maritime titans, whose very presence can create devastating whirlpools 
	and tidal waves that reshape entire coastlines.`
];


async function main() {

  const baseURL = process.env.MODEL_RUNNER_BASE_URL || "http://localhost:12434/engines/llama.cpp/v1/";
  //const baseURL = process.env.MODEL_RUNNER_BASE_URL || "http://model-runner.docker.internal/engines/llama.cpp/v1";
  const embeddingsModel = process.env.MODEL_RUNNER_EMBEDDING || "ai/mxbai-embed-large";

  const chatModel = process.env.MODEL_RUNNER_LLM_CHAT || "ai/qwen2.5:0.5B-F16";

  const embeddings = new OpenAIEmbeddings({
    model: embeddingsModel,
    openAIApiKey: "tada",
    configuration: {
      baseURL: baseURL
    }
  });

  const chat = new ChatOpenAI({
    model: chatModel,
    openAIApiKey: "tada",
    temperature: 0.8,
    configuration: {
      baseURL: baseURL
    },
    streaming: true
  });

  // -------------------------------------------------
  // Create a vector store
  // -------------------------------------------------
  const store = new MemoryVectorStore();

  // -------------------------------------------------
  // STEP 1: Create and save the embeddings from the chunks
  // -------------------------------------------------
  console.log("⏳ Creating the embeddings...");

  for (const chunk of chunks) {
    try {
      // EMBEDDING COMPLETION:
      const chunkEmbedding = await embeddings.embedQuery(chunk);

      //console.log("✅ Chunk embedded:", chunkEmbedding);
      
      const vectorRecord = new VectorRecord('', chunk, chunkEmbedding);
      store.save(vectorRecord);
      
    } catch (error) {
      console.error(`Error processing chunk:`, error);
    }
  }

  console.log("✋ Embeddings created, total of records", store.records.size);
  console.log();

  // -------------------------------------------------
  // Search for similarities
  // -------------------------------------------------

  // USER MESSAGE:
  const userQuestion = "Tell me something about the dragons";

  console.log(`⏳ Searching for similarities with "${userQuestion}"...`);

  try {
    // -------------------------------------------------
    // STEP 2: EMBEDDING COMPLETION:
    // Create embedding from the user question
    // -------------------------------------------------
    const userQuestionEmbedding = await embeddings.embedQuery(userQuestion);

    // -------------------------------------------------
    // STEP 3: SIMILARITY SEARCH: use the vector store to find similar chunks
    // -------------------------------------------------
    // Create a vector record from the user embedding
    const embeddingFromUserQuestion = new VectorRecord('', '', userQuestionEmbedding);

    const similarities = store.searchTopNSimilarities(embeddingFromUserQuestion, 0.6, 2);

    let documentsContent = "Documents:\n";

    for (const similarity of similarities) {
      console.log("✅ CosineSimilarity:", similarity.cosineSimilarity, "Chunk:", similarity.prompt);
      documentsContent += similarity.prompt;
    }
    documentsContent += "\n";
    console.log("\n✋ Similarities found, total of records", similarities.length);
    console.log();

    // -------------------------------------------------
    // STEP 4: Generate CHAT COMPLETION:
    // -------------------------------------------------
    const systemMessage1 = `
			You are a useful AI agent and RPG expert. 
			Use only the following documents, 
			like a dungeon master, 
			create an history to answer the user question:
		`;

    const messages = [
      { role: 'system', content: systemMessage1 },
      { role: 'system', content: documentsContent },
      { role: 'user', content: userQuestion }
    ];

    // Stream the response
    const stream = await chat.stream(messages);
    
    for await (const chunk of stream) {
      process.stdout.write(chunk.content);
    }

    console.log();

  } catch (error) {
    console.error("😡:", error);
  }
}

main().catch(console.error);