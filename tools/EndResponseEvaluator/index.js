const EndResponseEvaluator = (agent, input, currentSolution = '') => `Query: ${input}\n\nSolution: ${currentSolution}\n\nDoes the solution satisfy the original query? If not, make the necessary changes to satisfy the requirement. In either case, output only the entire changed file(s). Don't include any other details in your response.`;

export default EndResponseEvaluator;
