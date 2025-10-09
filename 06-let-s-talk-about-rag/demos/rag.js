import { randomUUID } from 'crypto';

// Cosine similarity calculation functions
function dotProduct(v1, v2) {
  let sum = 0.0;
  for (let i = 0; i < v1.length; i++) {
    sum += v1[i] * v2[i];
  }
  return sum;
}

function cosineSimilarity(v1, v2) {
  const product = dotProduct(v1, v2);
  
  const norm1 = Math.sqrt(dotProduct(v1, v1));
  const norm2 = Math.sqrt(dotProduct(v2, v2));
  
  if (norm1 <= 0.0 || norm2 <= 0.0) {
    return 0.0;
  }
  
  return product / (norm1 * norm2);
}

// Vector Record class
class VectorRecord {
  constructor(id = '', prompt = '', embedding = [], cosineSimilarity = 0) {
    this.id = id || randomUUID();
    this.prompt = prompt;
    this.embedding = embedding;
    this.cosineSimilarity = cosineSimilarity;
  }
}

// Memory Vector Store class
class MemoryVectorStore {
  constructor() {
    this.records = new Map();
  }

  getAll() {
    return Array.from(this.records.values());
  }

  save(vectorRecord) {
    if (!vectorRecord.id) {
      vectorRecord.id = randomUUID();
    }
    this.records.set(vectorRecord.id, vectorRecord);
    return vectorRecord;
  }

  searchSimilarities(embeddingFromQuestion, limit) {
    const results = [];
    
    for (const record of this.records.values()) {
      const distance = cosineSimilarity(embeddingFromQuestion.embedding, record.embedding);
      if (distance >= limit) {
        const resultRecord = { ...record };
        resultRecord.cosineSimilarity = distance;
        results.push(resultRecord);
      }
    }
    
    return results;
  }

  searchTopNSimilarities(embeddingFromQuestion, limit, max) {
    const records = this.searchSimilarities(embeddingFromQuestion, limit);
    return this.getTopNVectorRecords(records, max);
  }

  getTopNVectorRecords(records, max) {
    // Sort records in descending order by cosine similarity
    records.sort((a, b) => b.cosineSimilarity - a.cosineSimilarity);
    
    // Return the first max records or all if less than max
    if (records.length < max) {
      return records;
    }
    return records.slice(0, max);
  }
}

export { dotProduct, cosineSimilarity, VectorRecord, MemoryVectorStore };