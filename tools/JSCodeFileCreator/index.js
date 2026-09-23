import RetrievalAugmentedGeneration from '../RetrievalAugmentedGeneration/index.js';
import JSCodeCreator from '../JSCodeCreator/index.js';

const JSCodeFileCreator = async (agent, input, currentSolution = '') => {
  const codebaseResult = await RetrievalAugmentedGeneration(agent, input, currentSolution);

  const coderResult = JSCodeCreator(agent, input, currentSolution);

  return `${codebaseResult}\n\nInstruction: ${coderResult}`;
};

export default JSCodeFileCreator;
