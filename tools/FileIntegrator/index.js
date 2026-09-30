import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { exec } from 'node:child_process';

import Logger from '../../lib/Logger/index.js';

const console = new Logger('FileIntegrator');

const FileIntegrator = async (agent, { files, task, currentSolution = '' }) => {
  console.comment('Writing to file...');

  const { gitPath: gitDir } = await agent.readConfig();

  const gitPath = path.resolve('bucket', gitDir);
  const targetFilePath = path.join(gitPath, `Article-${Date.now()}.html`);

  const solutionContent = currentSolution.replace(/```(?:[\w-]*\n)?([\s\S]*?)```/g, (match) =>
    match.replace(/```[\w-]*\n?|```/g, '')
  );

  console.comment('Writing solution to file...');

  try {
    await fs.writeFile(targetFilePath, solutionContent);
  } catch (err) {
    console.error(`× Failed to write to ${targetFilePath}:`, err.message);

    return '';
  }

  console.success('Done.');

  return `File saved.`;
};

export default FileIntegrator;
