import CodeCreator from '../CodeCreator/index.js';

const JSCodeCreator = (agent, input, currentSolution = '') => {
  const result = CodeCreator(agent, input, currentSolution);

  return `${result}\nImplement the solution in modern ES6+ JavaScript. Use \`fetch\` for HTTP requests. Only use paths and URLs referenced in the code provided above (if any).\nUse async/await and \`for .. of\` instead of \`forEach\` (where applicable).\nUse classNames already used throughout the codebase for look & feel. If new CSS styles are needed (only add them if needed), they should be added inline.`
};

export default JSCodeCreator;
