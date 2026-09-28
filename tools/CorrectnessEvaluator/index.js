const CorrectnessEvaluator = (_, { query, currentSolution }) => `QUERY: ${query}\n\nSOLUTION: ${currentSolution}\n\nDoes the solution satisfy the original query? If not, make the necessary changes to satisfy the requirement.`;

export default CorrectnessEvaluator;
