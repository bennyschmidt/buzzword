const RetrievalAugmentedGeneration = async (agent, input, currentSolution = '') => {
  const queryEmbedding = await agent.embed(`${input}\n\nReturn only the most relevant file(s).`);

  const documents = agent.store.search(queryEmbedding);

  return `Context:\n${documents.join('\n---\n')}\n\nQuery: ${input}`;
};

export default RetrievalAugmentedGeneration;
