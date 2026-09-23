const VariableEvaluator = (agent, input, currentSolution = '') => `Solution: ${currentSolution}\n\nEnsure there are no undefined or out-of-scope variables in the solution. If any referenced variable is not accounted for as a native utility, import, or variable in scope it should be defined at the top of the file with a default value.\nIf any variable that might be null or undefined is not safely referenced, use the optional chaining operator and/or || to set default values where appropriate.`;

export default VariableEvaluator;
