import fs from 'node:fs/promises';
import path from 'node:path';

import Logger from '../../lib/Logger/index.js';

const console = new Logger('ResearchCreator');

const ResearchCreator = async (agent, { query }) => {
  console.comment('Reading file(s)...');

  const { gitPath: gitDir } = await agent.readConfig();

  const gitPath = path.resolve('bucket', gitDir);
  const targetFilePath = path.join(gitPath, 'information.txt');

  const fileText = await fs.readFile(targetFilePath, 'utf-8');

  return `SUMMARY: ${fileText}\n\nQUERY: ${query}`;
};

export default ResearchCreator;
