import fs from 'node:fs/promises';
import path from 'node:path';

const ResearchCreator = async (agent, { query }) => {
  console.log('Reading file(s)...');

  const { gitPath: gitDir } = await agent.readConfig();

  const gitPath = path.resolve('bucket', gitDir);
  const targetFilePath = path.join(gitPath, 'background-information.txt');

  const fileText = await fs.readFile(targetFilePath, 'utf-8');

  return `SUMMARY: ${fileText}\n\nQUERY: ${query}`;
};

export default ResearchCreator;
