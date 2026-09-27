import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { exec } from 'node:child_process';
import dotenv from 'dotenv';

dotenv.config();

import CodeCreator from './tools/CodeCreator/index.js';
import CodeFileIntegrator from './tools/CodeFileIntegrator/index.js';
import CodeIntegrator from './tools/CodeIntegrator/index.js';
import CompletenessEvaluator from './tools/CompletenessEvaluator/index.js';
import EndResponseEvaluator from './tools/EndResponseEvaluator/index.js';
import JSCodeCreator from './tools/JSCodeCreator/index.js';
import JSCodeFileCreator from './tools/JSCodeFileCreator/index.js';
import NoDeviationEvaluator from './tools/NoDeviationEvaluator/index.js';
import NoFileDeviationEvaluator from './tools/NoFileDeviationEvaluator/index.js';
import RetrievalAugmentedGeneration from './tools/RetrievalAugmentedGeneration/index.js';
import VariableEvaluator from './tools/VariableEvaluator/index.js';
import WeatherStamp from './tools/WeatherStamp/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const {
  DEFAULT_MODEL = 'codestral-cool',
  DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text',
} = process.env;

/**
 * Default toolkit.
 *
 * A variety of tools for dynamic augmentation
 * and iterative enrichment.
 */

const DEFAULT_TOOLS = {
  RetrievalAugmentedGeneration,
  CodeCreator,
  CodeFileIntegrator,
  CodeIntegrator,
  CompletenessEvaluator,
  EndResponseEvaluator,
  JSCodeCreator,
  JSCodeFileCreator,
  NoDeviationEvaluator,
  NoFileDeviationEvaluator,
  VariableEvaluator,
  WeatherStamp
};

/**
 * Default toolchain.
 *
 * Setup for local JavaScript development.
 */

const DEFAULT_TOOL_CHAIN = [
  'JSCodeFileCreator',
  'CodeFileIntegrator',
  'VariableEvaluator',
  'CompletenessEvaluator',
  'EndResponseEvaluator'
];

/**
 * VectorStore
 *
 * A text vector store with built-in search.
 */

class VectorStore {
  static getCosineSimilarity (a, b) {
    let dot = 0, magA = 0, magB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }

    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  constructor () {
    this.embeddings = [];
    this.texts = [];
    this.multipliers = [];
  }

  add (text, embedding, priorityMultiplier = 1) {
    this.embeddings.push(embedding);
    this.texts.push(text);
    this.multipliers.push(priorityMultiplier);
  }

  search (queryEmbedding, topK = 3) {
    const similarities = this.embeddings.map((embedding, i) => {
      const rawSimilarity = VectorStore.getCosineSimilarity(queryEmbedding, embedding);

      return { i, similarity: rawSimilarity * this.multipliers[i] };
    });

    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities.slice(0, topK).map(({ i }) => this.texts[i]);
  }
}

/**
 * RetrievalModel
 *
 * A model wrapper with file utilities and a
 * vector store designed for retrieval-augmented
 * generation (RAG).
 */

class RetrievalModel {
  constructor (config = {}) {
    this.MODEL_BASE_URL = config.MODEL_BASE_URL || 'http://localhost:11434/api';
    this.MODEL_EMBED_URL = `${this.MODEL_BASE_URL}/embed`;
    this.MODEL_CHAT_URL = `${this.MODEL_BASE_URL}/chat`;
    this.MODEL = config.MODEL || DEFAULT_MODEL;
    this.EMBEDDING_MODEL = config.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  }

  async embed (text, model = this.EMBEDDING_MODEL) {
    try {
      const response = await fetch(this.MODEL_EMBED_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: text }),
      });

      const data = await response.json();

      if (!data || !data.embeddings || !data.embeddings[0]) {
        console.warn(`The model did not return valid vectors. Ensure model "${model}" is downloaded.`);

        return null;
      }

      return data.embeddings[0];
    } catch (err) {
      console.warn(`Network error during embedding: ${err.message}`);

      return null;
    }
  }

  async createVectorStore (files, priorityMultiplier = 1) {
    const store = new VectorStore();

    const rawTexts = await this.readFiles(files);

    for (const fullText of rawTexts) {
      if (!fullText || !fullText.trim()) continue;

      const fileSections = fullText.split(/(<!NEW FILE>|<!END OF FILE>)/g);

      let currentChunk = [];

      for (const section of fileSections) {
        if (section.trim() === '<!NEW FILE>') {
          if (currentChunk.length > 0) {
            const chunk = currentChunk.join('\n').trim();

            if (chunk) {
              const embedding = await this.embed(chunk);

              if (embedding && Array.isArray(embedding)) {
                store.add(chunk, embedding, priorityMultiplier);
              }
            }

            currentChunk = [];
          }
        } else if (section.trim() === '<!END OF FILE>') {
          if (currentChunk.length > 0) {
            const chunk = currentChunk.join('\n').trim();

            if (chunk) {
              const embedding = await this.embed(chunk);

              if (embedding && Array.isArray(embedding)) {
                store.add(chunk, embedding, priorityMultiplier);
              }
            }

            currentChunk = [];
          }
        } else {
          currentChunk.push(section);
        }
      }

      if (currentChunk.length > 0) {
        const chunk = currentChunk.join('\n').trim();

        if (chunk) {
          const embedding = await this.embed(chunk);

          if (embedding && Array.isArray(embedding)) {
            store.add(chunk, embedding, priorityMultiplier);
          }
        }
      }
    }

    return store;
  }

  async loadFilesFromPaths (dirPath) {
    const pathsFile = path.join(dirPath, 'paths.txt');

    try {
      const pathsContent = await fs.readFile(pathsFile, 'utf-8');

      const filePaths = pathsContent
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => path.join(dirPath, line.trim()));

      return filePaths;
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.warn(`No paths.txt found in ${dirPath}. Skipping.`);

        return [];
      } else {
        console.error(`Error reading paths.txt in ${dirPath}:`, err.message);

        return [];
      }
    }
  }

  async readFiles (files) {
    return Promise.all(
      files.map(async file => {
        try {
          return await fs.readFile(file, 'utf-8');
        } catch (err) {
          console.warn(`Failed to read ${file}: ${err.message}`);

          return '';
        }
      })
    );
  }

  async chat (messages, model = this.MODEL) {
    console.log('\n\nMODEL INPUT:\n\n', messages[messages.length - 1]?.content);

    const response = await fetch(this.MODEL_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: { temperature: 0 }
      })
    });

    if (!response.body) {
      throw new Error('Failed to read streaming body from model server.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let content = '';

    process.stdout.write('\n\nMODEL OUTPUT:\n\n');

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunkText = decoder.decode(value, { stream: true });
      const lines = chunkText.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const parsed = JSON.parse(line);

          if (parsed.message?.content) {
            const token = parsed.message.content;

            content += token;
            process.stdout.write(token);
          }
        } catch (e) { /* Ignore parsing errors */ }
      }
    }

    process.stdout.write('\n');

    return content;
  }
}

/**
 * Agent
 *
 * A retrieval model with tool support for more
 * control over the query lifecycle.
 *
 * Agent automatically reads tasks from "tasks.txt",
 * processes them one by one, and commits solutions
 * to git.
 */

class Agent extends RetrievalModel {
  static tools = {
    ...DEFAULT_TOOLS
  };

  constructor (config = {}) {
    super(config);

    this.tools = { ...Agent.tools, ...(config.tools || {}) };
    this.chain = config.chain || DEFAULT_TOOL_CHAIN;

    this.loadAndExec();
  }

  async load () {
    console.log('Loading vector stores...');

    const gitPath = await this.getGitPath();

    const lowPriorityFiles = await this.loadFilesFromPaths(path.join(__dirname, 'buckets/background'));

    const highPriorityFiles = await this.loadFilesFromPaths(path.join(__dirname, 'buckets/focus'));

    const lowPriorityStore = await this.createVectorStore(lowPriorityFiles, 1);

    const highPriorityStore = await this.createVectorStore(highPriorityFiles, 2);

    this.store = new VectorStore();
    this.store.embeddings = [...lowPriorityStore.embeddings, ...highPriorityStore.embeddings];
    this.store.texts = [...lowPriorityStore.texts, ...highPriorityStore.texts];
    this.store.multipliers = [...lowPriorityStore.multipliers, ...highPriorityStore.multipliers];

    this.bucket = {
      background: lowPriorityFiles,
      focus: highPriorityFiles
    };

    console.log('Done.');
  }

  async getGitPath () {
    const gitPathFile = path.join(__dirname, 'buckets/focus/gitpath.txt');

    const gitPath = await fs.readFile(gitPathFile, 'utf-8');

    return path.resolve(__dirname, 'buckets/focus', gitPath.trim());
  }

  async readTopTask () {
    try {
      const tasksContent = await fs.readFile(path.join(__dirname, 'tasks.txt'), 'utf-8');

      const tasks = tasksContent.split('\n').filter(task => task.trim() !== '');

      if (tasks.length === 0) {
        console.log('All tasks complete!');
        process.exit(0);
      }

      const topTask = tasks[0];

      await fs.writeFile(path.join(__dirname, 'task.txt'), topTask);

      return { topTask, tasks };
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.error('Error: The file "tasks.txt" could not be found in the project root directory.');
      } else {
        console.error('Error reading tasks file:', err.message);
      }

      process.exit(1);
    }
  }

  async removeCompletedTask (tasks) {
    const updatedTasks = tasks.slice(1).join('\n\n');

    await fs.writeFile(path.join(__dirname, 'tasks.txt'), updatedTasks);

    await fs.writeFile(path.join(__dirname, 'task.txt'), '');
  }

  async extractFilesAndTask (topTask) {
    const filesMatch = topTask.match(/\[FILES:\s*([^\]]+)\]/i);
    const taskMatch = topTask.match(/\[TASK:\s*([^\]]+)\]/i);

    if (!filesMatch || !taskMatch) {
      console.warn(`No files or task found in task: ${topTask}`);

      return {
        files: ['Unknown'],
        task: 'Unknown',
        fullTask: topTask
      };
    }

    const files = filesMatch[1].split(',').map(file => file.trim().replace(/["']/g, ''));
    const task = taskMatch[1].trim();
    const fullTask = topTask.replace(/^.*\[TASK:\s*[^\]]+\]\s*/i, '').trim();

    return { files, task, fullTask };
  }

  async branchAndCommit (files, task, currentSolution) {
    const gitPath = await this.getGitPath();

    const [fileReference] = files;
    const fileContent = this.store.texts.find(text => text.match(`NAME: ${fileReference}`));

    if (!fileContent) {
      console.warn(`Failed to retrieve stored text for file "${fileReference}".`);

      return;
    }

    const filePath = fileContent.match(/FILE_PATH:\s*([^\s\*]+)/)?.[1]?.trim();

    if (!filePath) {
      console.warn(`Failed to extract FILE_PATH from file "${fileReference}".`);

      return;
    }

    const targetFilePath = path.join(gitPath, filePath);

    const solutionContent = currentSolution.replace(/```(?:[\w-]*\n)?([\s\S]*?)```/g, (match) =>
      match.replace(/```[\w-]*\n?|```/g, '')
    );

    try {
      await fs.writeFile(targetFilePath, solutionContent);

      console.log(`Solution written to ${targetFilePath}.`);
    } catch (err) {
      console.error(`Failed to write to ${targetFilePath}:`, err.message);

      return;
    }

    const branchName = `${DEFAULT_MODEL}/${task
      .toLowerCase()
      .replace(/[\s]+/g, '-')
      .substring(0, 50)
      .replace(/\"/g, '')}`;

    const commitMessage = (await this.chat([
      {
        role: 'user',
        content: `Generate a concise commit message for the following task: ${task}.\n\nDon't include any other details in your response.`,
      },
    ])).replace(/^"|"$/g, '');

    return new Promise((resolve, reject) => {
      exec(
        `cd ${gitPath} && git pull && git add ${targetFilePath} && git commit -m '${commitMessage}' && git checkout -b ${branchName} && git push`,
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Git error: ${stderr}`);
            reject(error);
          } else {
            console.log(`Git operations completed: ${stdout}`);
            resolve();
          }
        }
      );
    });
  }

  async gitReady () {
    const gitPath = await this.getGitPath();

    return new Promise((resolve, reject) => {
      exec(`cd ${gitPath} && git stash && git checkout master && git pull`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error during git reset: ${error.message}`);
          reject(error);
        } else {
          console.log(`Git state reset: ${stdout}`);
          resolve();
        }
      });
    });
  }

  async exec () {
    const { topTask, tasks } = await this.readTopTask();

    const { files, task, fullTask } = await this.extractFilesAndTask(topTask);

    console.log(`Starting a new task ${task}...`);

    try {
      console.log('Handling query:', fullTask);

      const response = await this.query(fullTask);

      console.log('\nAGENT RESPONSE:', response, '\n');

      const matches = response.match(/```(?:[\w-]*\n)?([\s\S]*?)```/g);
      const currentSolution = matches?.length ? matches.join('\n') : response;

      await this.branchAndCommit(files, task, currentSolution);

      console.log(`Done with task ${task}.`);

      await this.removeCompletedTask(tasks);

      await this.gitReady();

      console.log('Task complete!');

      await this.exec();
    } catch (err) {
      console.error('Error during query execution:', err.message);
      process.exit(1);
    }
  }

  async query (input) {
    let currentSolution = '';
    let lastResponse = '';

    const messages = [];

    for (let i = 0; i < this.chain.length; i++) {
      const toolName = this.chain[i];
      const tool = this.tools[toolName];

      if (!tool) {
        console.warn(`Tool "${toolName}" not found. Skipping.`);

        continue;
      }

      console.log(`Using tool: "${toolName}"...`);

      const toolPrompt = await tool(this, input, currentSolution);

      if (!toolPrompt) continue;

      messages.push({
        role: 'user',
        content: toolPrompt
      });

      lastResponse = await this.chat(messages);

      const matches = lastResponse.match(/```(?:[\w-]*\n)?([\s\S]*?)```/g);

      if (matches?.length) {
        currentSolution = matches.join('\n');
      }

      console.log(`Done using tool: "${toolName}".`);
    }

    return lastResponse;
  }

  async loadAndExec () {
    await this.load();

    await this.exec();
  }
}

// Application

async function main () {
  new Agent();
}

main().catch(console.error);
