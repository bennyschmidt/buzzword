import RetrievalAugmentedGeneration from '../RetrievalAugmentedGeneration/index.js';
import JSCodeCreator from '../JSCodeCreator/index.js';

const JSCodeFileCreator = async (agent, { query, currentSolution = '' }) => {
  const codebaseResult = await RetrievalAugmentedGeneration(agent, { query });

  const coderResult = JSCodeCreator(agent, { query, currentSolution });

  return `${codebaseResult}\n\nINSTRUCTION: ${coderResult}`;
};

export default JSCodeFileCreator;
