const CodeFileDecorationCreator = async (agent, { files, currentSolution }) => {
  const queryEmbedding = await agent.embed(
    `Find and return this code file: ${files[0]}`
  );

  const [codeResult = ''] = agent.store.search(queryEmbedding);

  return `SOURCE: ${codeResult}\n\nSOLUTION:${currentSolution}\n\nIf the <!NEW FILE> and <!END OF FILE> comment blocks are not present in the solution, restore them to the solution.\n\nThe format is like this:\n\n
  /**\n
   * <!NEW FILE>\n
   * NAME: FileName\n
   * TYPE: Component\n
   * PURPOSE: A simple React component.\n
   * FILE_PATH: src/components/FileName/index.js\n
   * DEPENDENCIES: useAuth\n
   * ENVIRONMENT: React (JSX)\n
   * NOTES: Requires auth to view.\n
   */\n
   \n
   ... the code ...\n
   \n
   /**\n
    * <!END OF FILE>\n
    */\n\n
   Output the entire solution:\n\n${currentSolution}\n\nwith these beginning and ending comment blocks. Don't include any other details in your response.`
};

export default CodeFileDecorationCreator;
