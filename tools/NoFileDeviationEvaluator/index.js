import NoDeviationEvaluator from '../NoDeviationEvaluator/index.js';

const NoFileDeviationEvaluator = async (agent, input, currentSolution = '') => {
  const queryEmbedding = await agent.embed(`Return only the most relevant file to the code mentioned in the following input: ${input}.`);

  const documents = agent.store.search(queryEmbedding);

  const toolResult = NoDeviationEvaluator(agent, input, currentSolution);

  return `Source: ${documents.join('\n---\n')}\n\nSolution: ${currentSolution}\n\nInstruction: ${toolResult}`;
};

export default NoFileDeviationEvaluator;
