/**
 * VectorStore
 *
 * A text vector store with built-in search.
 */

export default class VectorStore {
  static getCosineSimilarity (a, b) {
    let dot = 0, magA = 0, magB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }

    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  constructor () {
    this.embeddings = [];
    this.texts = [];
    this.multipliers = [];
  }

  add (text, embedding, priorityMultiplier = 1) {
    this.embeddings.push(embedding);
    this.texts.push(text);
    this.multipliers.push(priorityMultiplier);
  }

  search (queryEmbedding, topK = 1) {
    const similarities = this.embeddings.map((embedding, i) => {
      const rawSimilarity = VectorStore.getCosineSimilarity(queryEmbedding, embedding);

      return { i, similarity: rawSimilarity * this.multipliers[i] };
    });

    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities.slice(0, topK).map(({ i }) => this.texts[i]);
  }
}
