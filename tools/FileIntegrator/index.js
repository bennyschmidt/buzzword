import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { exec } from 'node:child_process';

const FileIntegrator = async (agent, { files, task, currentSolution = '' }) => {
  console.log('Writing to file...');

  const { gitPath: gitDir } = await agent.readConfig();

  const gitPath = path.resolve('bucket', gitDir);
  const targetFilePath = path.join(gitPath, `Article-${Date.now()}.html`);

  const solutionContent = currentSolution.replace(/```(?:[\w-]*\n)?([\s\S]*?)```/g, (match) =>
    match.replace(/```[\w-]*\n?|```/g, '')
  );

  console.log('Writing solution to file...');

  try {
    await fs.writeFile(targetFilePath, solutionContent);
  } catch (err) {
    console.error(`\n× Failed to write to ${targetFilePath}:`, err.message);

    return '';
  }

  console.log('Done.');

  return `File saved.`;
};

export default FileIntegrator;
