import CodeIntegrator from '../CodeIntegrator/index.js';

const CodeFileIntegrator = async (agent, { query, currentSolution = '' }) => {
  const queryEmbedding = await agent.embed(
    `Find and return the code file mentioned in the following input: ${query}.`
  );

  const documents = agent.store.search(queryEmbedding);

  const toolResult = CodeIntegrator(agent, query, currentSolution);

  return `Source: ${documents.join('\n---\n')}\n\nSolution: ${currentSolution}\n\nInstruction: ${toolResult}`;
};

export default CodeFileIntegrator;
