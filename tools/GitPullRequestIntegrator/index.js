import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';

const GitPullRequestIntegrator = async (agent, { files, task, currentSolution = '' }) => {
  console.log('Reading relevant file(s)...');

  const { gitPath: gitDir } = await agent.readConfig();

  const gitPath = path.resolve(__dirname, 'bucket', gitDir);
  const [fileReference] = files;
  const fileContent = agent.store.texts.find(text => text.match(`NAME: ${fileReference}`));

  if (!fileContent) {
    console.warn(`\n× Failed to retrieve stored text for file "${fileReference}".\n`);

    return '';
  }

  const filePath = fileContent.match(/FILE_PATH:\s*([^\s\*]+)/)?.[1]?.trim();

  if (!filePath) {
    console.warn(`\n× Failed to extract FILE_PATH from file: "${fileReference}".\n`);

    return '';
  }

  const targetFilePath = path.join(gitPath, filePath);

  const solutionContent = currentSolution.replace(/```(?:[\w-]*\n)?([\s\S]*?)```/g, (match) =>
    match.replace(/```[\w-]*\n?|```/g, '')
  );

  console.log('Writing solution to file...');

  try {
    await fs.writeFile(targetFilePath, solutionContent);

    console.log(`Done.\nUpdated ${targetFilePath}.`);
  } catch (err) {
    console.error(`\n× Failed to write to ${targetFilePath}:`, err.message);

    return '';
  }

  const branchName = `${agent.MODEL || 'coder-14'}/${task
    .toLowerCase()
    .replace(/[\s]+/g, '-')
    .substring(0, 50)
    .replace(/\"/g, '')}-${Date.now()}`;

  console.log('Creating a new branch in git...');

  const commitMessage = (await agent.chat([
    {
      role: 'user',
      content: `Generate a concise commit message for the following task: ${task}.\n\nDon't include any other details in your response.`,
    },
  ])).replace(/^"|"$/g, '');

  console.log('Committing and pushing to git...');

  await new Promise((resolve, reject) => {
    exec(
      `cd ${gitPath} && git pull && git add ${targetFilePath} && git commit -m '${commitMessage}' && git checkout -b ${branchName} && git push`,
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Error pushing to git: ${stderr}`);
          reject(error);
        } else {
          console.log(`Successfully pushed to git: ${stdout}`);
          resolve();
        }
      }
    );
  });

  console.log('Done.\nResetting git for the next task...');

  await new Promise((resolve, reject) => {
    exec(`cd ${gitPath} && git reset && git stash && git checkout master && git reset --hard HEAD`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error during git reset: ${error.message}`);
        reject(error);
      } else {
        console.log(`Git reset: ${stdout}`);
        resolve();
      }
    });
  });

  console.log('Done.');

  return `Saved to ${targetFilePath}, committed, and pushed to a new branch "${branchName}".`;
};

export default GitPullRequestIntegrator;
