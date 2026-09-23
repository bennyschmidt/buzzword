import CodeIntegrator from '../CodeIntegrator/index.js';

const CodeFileIntegrator = async (agent, input, currentSolution = '') => {
  const queryEmbedding = await agent.embed(`Find and return the code file mentioned in the following input: ${input}.`);

  const documents = agent.store.search(queryEmbedding);

  const toolResult = CodeIntegrator(agent, input, currentSolution);

  return `Source: ${documents.join('\n---\n')}\n\nSolution: ${currentSolution}\n\nInstruction: ${toolResult}`;
};

export default CodeFileIntegrator;
