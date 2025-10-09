---
marp: true
html: true
theme: default
paginate: true
---
<style>
.dodgerblue {
  color: dodgerblue;
}
</style>
###### Similarity search & Chat completion
<div class="mermaid">
%%{init: {'theme':'base', 'themeVariables': { 'actorBkg':'#e1f5fe', 'actorBorder':'#01579b', 'actorTextColor':'#000', 'actorLineColor':'#01579b', 'signalColor':'#000', 'signalTextColor':'#000', 'labelBoxBkgColor':'#f3e5f5', 'labelBoxBorderColor':'#4a148c', 'labelTextColor':'#000', 'loopTextColor':'#000', 'noteBorderColor':'#e65100', 'noteBkgColor':'#fff3e0', 'noteTextColor':'#000', 'activationBorderColor':'#1b5e20', 'activationBkgColor':'#e8f5e8', 'sequenceNumberColor':'#fff'}}}%%
sequenceDiagram
    participant User
    participant Embedding as Embedding Model
    participant VectorDB as Vector Database
    participant LLM as Language Model

    User->>Embedding: User question
    activate Embedding
    Embedding->>Embedding: Create vector representation
    deactivate Embedding
    Embedding->>VectorDB: Search similar vectors
    activate VectorDB
    VectorDB->>VectorDB: Retrieve relevant documents
    deactivate VectorDB
    VectorDB->>LLM: Documents as context
    activate LLM
    LLM->>LLM: Generate answer with context
    deactivate LLM
    LLM->>User: Answer

</div>
