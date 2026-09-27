const CompletenessEvaluator = () => `Ensure there are no placeholder comments in the solution (e.g., "// the rest of the code" type comments) in lieu of providing complete and full code. If there are any such instances, replace the comment with the full code - either from the source or from the suggested code solution.\nOutput the entire changed file(s).`;

export default CompletenessEvaluator;
