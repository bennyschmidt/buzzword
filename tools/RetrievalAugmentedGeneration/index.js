const RetrievalAugmentedGeneration = async (agent, { query }) => {
  const queryEmbedding = await agent.embed(
    `${query}\n\nReturn only the most relevant file(s).`
  );

  const documents = agent.store.search(queryEmbedding);

  return `CONTEXT:\n${documents.join('\n---\n')}\n\nQUERY: ${query}\n`;
};

export default RetrievalAugmentedGeneration;
