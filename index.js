import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { exec } from 'node:child_process';
import dotenv from 'dotenv';

dotenv.config();

import CodeCompletenessEvaluator from './tools/CodeCompletenessEvaluator/index.js';
import CodeCreator from './tools/CodeCreator/index.js';
import CodeFileIntegrator from './tools/CodeFileIntegrator/index.js';
import CodeIntegrator from './tools/CodeIntegrator/index.js';
import CodeResponseEvaluator from './tools/CodeResponseEvaluator/index.js';
import CorrectnessEvaluator from './tools/CorrectnessEvaluator/index.js';
import GitPullRequestIntegrator from './tools/GitPullRequestIntegrator/index.js';
import JSCodeCreator from './tools/JSCodeCreator/index.js';
import JSCodeFileCreator from './tools/JSCodeFileCreator/index.js';
import NoDeviationEvaluator from './tools/NoDeviationEvaluator/index.js';
import NoFileDeviationEvaluator from './tools/NoFileDeviationEvaluator/index.js';
import CodeFileDecorationCreator from './tools/CodeFileDecorationCreator/index.js';
import RetrievalAugmentedGeneration from './tools/RetrievalAugmentedGeneration/index.js';
import VariableEvaluator from './tools/VariableEvaluator/index.js';
import WeatherStamp from './tools/WeatherStamp/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const {
  DEFAULT_MODEL = 'coder-14',
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
  CodeCompletenessEvaluator,
  CodeCreator,
  CodeFileDecorationCreator,
  CodeFileIntegrator,
  CodeIntegrator,
  CodeResponseEvaluator,
  CorrectnessEvaluator,
  GitPullRequestIntegrator,
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
  'CodeCompletenessEvaluator',
  'CorrectnessEvaluator',
  'CodeResponseEvaluator',
  'CodeFileDecorationCreator',
  'GitPullRequestIntegrator'
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

  search (queryEmbedding, topK = 1) {
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
        body: JSON.stringify({
          model,
          input: text
        }),
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
    const buzzPath = path.join(__dirname, 'buzz.json');

    try {
      const buzzConfig = JSON.parse(
        await fs.readFile(buzzPath, 'utf-8')
      );

      const { paths } = buzzConfig;

      return paths.map(filePath => path.join(dirPath, filePath));
    } catch (err) {
      console.error(`Error reading buzz.json: ${err.message}`);

      return [];
    }
  }

  async readFiles (files) {
    return Promise.all(
      files.map(async file => {
        try {
          return await fs.readFile(file, 'utf-8');
        } catch (err) {
          console.warn(`\n× Failed to read ${file}: ${err.message}\n`);

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
      throw new Error('\n× Failed to read streaming body from model server.\n');
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
 * Agent automatically reads tasks from "buzz.json",
 * processes them one by one, and commits solutions
 * to git.
 */

class Agent extends RetrievalModel {
  static tools = {
    ...DEFAULT_TOOLS
  };

  constructor (config = {}) {
    super(config);

    this.tools = {
      ...Agent.tools,
      ...(config.tools || {})
    };

    this.chain = config.chain || DEFAULT_TOOL_CHAIN;

    this.loadAndExec();
  }

  async readConfig () {
    try {
      const buzzPath = path.join(__dirname, 'buzz.json');

      const buzzConfig = JSON.parse(
        await fs.readFile(buzzPath, 'utf-8')
      );

      const buzzFile = await fs.readFile(buzzPath, 'utf-8');

      return JSON.parse(buzzFile || '{}');
    } catch (err) {
     console.error(`Error reading from buzz.json: ${err.message}`);
     process.exit(1);
   }
  }

  async shiftTasks (taskList) {
    const config = await this.readConfig();

    const removedTask = taskList.shift();

    config.tasks = [
      ...taskList
    ];

    await fs.writeFile(path.join(__dirname, '.task'), '');

    const buzzPath = path.join(__dirname, 'buzz.json');

    await fs.writeFile(buzzPath, JSON.stringify(config, null, 2));

    return removedTask;
  }

  async task ({
    files,
    taskList,
    task,
    query,
    currentSolution = ''
  }) {
    try {
      console.log('\nAGENT TASK:', query, '\n');

      const response = await this.query({
        files,
        taskList,
        task,
        query,
        currentSolution
      });

      console.log('\nAGENT SOLUTION:', response, '\n');

      console.log(`\n✔ Finished task: ${task}.\n\nPruning task log...\n`);

      const completedTask = await this.shiftTasks(taskList);

      if (!completedTask) {
        console.warn('\n× Failed to prune a completed task: ${task}.\n');
      } else {
        console.log('Done.');
      }

      await this.exec(currentSolution);
    } catch (err) {
      console.error('Error during task execution:', err.message);
      process.exit(1);
    }
  }

  async query ({
    files,
    taskList,
    task,
    query,
    currentSolution = ''
  }) {
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

      const toolPrompt = await tool(
        this,
        {
          files,
          taskList,
          task,
          query,
          currentSolution
        }
      );

      if (!toolPrompt) continue;

      messages.push({
        role: 'user',
        content: toolPrompt
      });

      lastResponse = await this.chat(messages);

      const matches = lastResponse.match(/```(?:[\w-]*\n)?([\s\S]*?)```/g);

      currentSolution = matches?.length
        ? matches.join('\n')
        : lastResponse;

      console.log(`Done using tool: "${toolName}".`);
    }

    return currentSolution;
  }

  async exec (previousSolution = '') {
    const { tasks = [] } = await this.readConfig();

    if (!tasks?.length) {
      console.log('No tasks to complete.');
      process.exit(0);
    }

    const [topTask] = tasks;

    await fs.writeFile(path.join(__dirname, '.task'), topTask);

    const filesMatch = topTask.match(/\[FILES:\s*([^\]]+)\]/i);
    const taskMatch = topTask.match(/\[TASK:\s*([^\]]+)\]/i);

    if (!filesMatch) {
      console.warn(`No file(s) found for task: ${topTask}`);
    }

    if (!taskMatch) {
      console.warn(`No task text found for task: ${topTask}`);
    }

    const isBlankTemplate = Boolean(!filesMatch || !taskMatch);

    const files = isBlankTemplate
      ? ['File']
      : filesMatch[1]
          .split(',')
          .map(file => file
            .trim()
            .replace(/["']/g, '')
          );

    const task = isBlankTemplate
      ? ''
      : taskMatch[1].trim();

    const taskText = isBlankTemplate
      ? topTask
      : topTask
          .replace(/^.*\[TASK:\s*[^\]]+\]\s*/i, '')
          .trim();

    console.log(
      `Starting a new task${isBlankTemplate
        ? ' from a blank template'
        : ''}: ${task}...`
    );

    return this.task({
      files,
      taskList: tasks,
      task,
      query: taskText,
      currentSolution: previousSolution
    });
  }

  async load () {
    console.log('Starting...');

    const { gitPath, paths } = await this.readConfig();

    this.gitPath = path.resolve(__dirname, 'bucket', gitPath);

    console.log('Loading files from bucket...');

    const focusFiles = await this.loadFilesFromPaths(path.join(__dirname, 'bucket'));

    console.log('Done.\nCreating vector stores...');

    const focusFileStore = await this.createVectorStore(focusFiles, 2);

    this.store = new VectorStore();
    this.store.embeddings = [...focusFileStore.embeddings];
    this.store.texts = [...focusFileStore.texts];
    this.store.multipliers = [...focusFileStore.multipliers];

    console.log('Done.\nAgent has started.');
  }

  async loadAndExec () {
    await this.load();

    await this.exec();
  }
}

// Application

async function main() {
  new Agent();
}

main().catch(console.error);
