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

  search (queryEmbedding, topK = 2) {
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

    const targetChunkSize = 1000;
    const chunkOverlap = 200;

    for (const fullText of rawTexts) {
      if (!fullText || !fullText.trim()) continue;

      const lines = fullText.split('\n');
      const chunks = [];

      let currentChunkLines = [];
      let currentLength = 0;
      let openBrackets = 0;

      for (let index = 0; index < lines.length; index++) {
        const line = lines[index];

        currentChunkLines.push(line);
        currentLength += line.length + 1;

        const opens = (line.match(/[\{\[\(]/g) || []).length;
        const closes = (line.match(/[\}\]\)]/g) || []).length;

        openBrackets += opens - closes;

        if (currentLength >= targetChunkSize && openBrackets <= 0) {
          chunks.push(currentChunkLines.join('\n'));

          const overlapCount = Math.min(currentChunkLines.length, Math.ceil(chunkOverlap / 40));

          currentChunkLines = currentChunkLines.slice(-overlapCount);
          currentLength = currentChunkLines.reduce((acc, l) => acc + l.length + 1, 0);
        }
      }

      if (currentChunkLines.length > 0) {
        chunks.push(currentChunkLines.join('\n'));
      }

      for (const chunk of chunks) {
        const trimmedChunk = chunk.trim();

        if (!trimmedChunk) continue;

        const embedding = await this.embed(trimmedChunk);

        if (embedding && Array.isArray(embedding)) {
          store.add(trimmedChunk, embedding, priorityMultiplier);
        }
      }
    }

    return store;
  }

  async loadDocuments (dirPath) {
    const files = [];

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const nestedFiles = await this.loadDocuments(fullPath);

        files.push(...nestedFiles);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }

    return files;
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
    console.log('\n\nModel Input:\n\n', messages[messages.length - 1]?.content);

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

    process.stdout.write('\n\nModel Output:\n\n');

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
  static tools = { ...DEFAULT_TOOLS };

  constructor (config = {}) {
    super(config);

    this.tools = { ...Agent.tools, ...(config.tools || {}) };
    this.chain = config.chain || DEFAULT_TOOL_CHAIN;

    this.loadAndExec();
  }

  async load () {
    console.log('Loading vector stores...');

    const lowPriorityFiles = await this.loadDocuments(path.join(__dirname, 'buckets/background'));

    const highPriorityFiles = await this.loadDocuments(path.join(__dirname, 'buckets/focus'));

    const lowPriorityStore = await this.createVectorStore(lowPriorityFiles, 1);

    const highPriorityStore = await this.createVectorStore(highPriorityFiles, 2);

    this.store = new VectorStore();
    this.store.embeddings = [...lowPriorityStore.embeddings, ...highPriorityStore.embeddings];
    this.store.texts = [...lowPriorityStore.texts, ...highPriorityStore.texts];
    this.store.multipliers = [...lowPriorityStore.multipliers, ...highPriorityStore.multipliers];

    console.log('Done.');
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
    const filesMatch = topTask.match(/\[Files:\s*([^\]]+)\]/);
    const taskMatch = topTask.match(/\[Task:\s*([^\]]+)\]/);

    if (!filesMatch || !taskMatch) {
      console.warn(`No files or task found in task: ${topTask}`);

      return { files: ['Unknown'], task: 'Unknown' };
    }

    const files = filesMatch[1].split(',').map(file => file.trim().replace(/["']/g, ''));
    const task = taskMatch[1].trim();

    return { files, task };
  }

  async extractFilePathFromContent (fileContent) {
    const pathMatch = fileContent.match(/Path:\s*"([^"]+)"\s*/);

    if (!pathMatch) {
      console.warn('No path found in file content.');

      return null;
    }

    return pathMatch[1].trim();
  }

  async branchAndCommit (files, task, currentSolution) {
    for (const file of files) {
      const filePath = path.join(__dirname, 'buckets/focus', file);

      const fileContent = await fs.readFile(filePath, 'utf-8');

      const extractedPath = await this.extractFilePathFromContent(fileContent);

      if (!extractedPath) {
        console.warn(`No path found in file: ${file}`);

        continue;
      }

      const fullPath = path.join(__dirname, extractedPath);
      const dirPath = path.dirname(fullPath);

      await fs.mkdir(dirPath, { recursive: true });

      const fileExtension = currentSolution.match(/```(?:[\w-]*\n)?([\s\S]*?)```/g)?.length > 1 ? '.md' : '.js';

      const solutionContent = currentSolution.replace(/```(?:[\w-]*\n)?([\s\S]*?)```/g, (match) =>
        match.replace(/```[\w-]*\n?|```/g, '')
      );

      await fs.writeFile(fullPath, solutionContent);
    }

    const branchName = task.toLowerCase().replace(/\s+/g, '-').substring(0, 50);

    const commitMessage = await this.chat([
      {
        role: 'user',
        content: `Generate a concise commit message for the following task: "${task}".\n\nDon't include any other details in your response.`,
      },
    ]);

    return new Promise((resolve, reject) => {
      exec(`git pull && git add . && git commit -m "${commitMessage}" && git checkout -b ${branchName} && git push`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error during git operations: ${error.message}`);
          reject(error);
        } else {
          console.log(`Git operations completed: ${stdout}`);
          resolve();
        }
      });
    });
  }

  async resetGitState () {
    return new Promise((resolve, reject) => {
      exec(`git stash && git checkout master && git pull`, (error, stdout, stderr) => {
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

    const { files, task } = await this.extractFilesAndTask(topTask);

    console.log(`Starting a new task "${task}"...`);

    try {
      console.log('Handling query:', task);

      const response = await this.query(task);

      console.log('\n', response, '\n');

      const matches = response.match(/```(?:[\w-]*\n)?([\s\S]*?)```/g);
      const currentSolution = matches?.length ? matches.join('\n') : response;

      await this.branchAndCommit(files, task, currentSolution);

      console.log(`Done with task "${task}".`);

      await this.removeCompletedTask(tasks);
      await this.resetGitState();

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

      messages.push({ role: 'user', content: toolPrompt });

      lastResponse = await this.chat(messages);

      messages.push({ role: 'assistant', content: lastResponse });

      const matches = lastResponse.match(/```(?:[\w-]*\n)?([\s\S]*?)```/g);

      if (matches?.length) {
        currentSolution = matches.join('\n');
      }

      console.log(`Done using tool: "${toolName}".`);
    }

    return lastResponse;
  }

  async loadAndExec() {
    await this.load();

    await this.exec();
  }
}

// Application

async function main () {
  new Agent();
}

main().catch(console.error);
