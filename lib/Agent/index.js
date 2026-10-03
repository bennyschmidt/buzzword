import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import Logger from '../Logger/index.js';
import RetrievalModel from '../RetrievalModel/index.js';
import System from '../../index.js';
import VectorStore from '../VectorStore/index.js';

const console = new Logger('Agent');
const __dirname = dirname(fileURLToPath(import.meta.url));

export default class Agent extends RetrievalModel {
  constructor (config = {}) {
    super(config);

    this.agentPath = path.resolve(config.agentPath || 'agent.glyph');
    this.memoryConfig = config.memoryConfig || null;
    this.toolchain = [];

    this.loadAndExec();
  }

  async readConfig () {
    try {
      let glyphicContent = this.memoryConfig;

      if (!glyphicContent) {
        glyphicContent = await fs.readFile(this.agentPath, 'utf-8');
      }

      const namespace = glyphicContent.match(/agent\s+"([^"]+)"/)?.[1]?.trim() || '';
      const model = glyphicContent.match(/\[model\]\s*:\s*"([^"]+)"/)?.[1] || 'coder-14';
      const embeddingModel = glyphicContent.match(/\[embeddingModel\]\s*:\s*"([^"]+)"/)?.[1] || 'nomic-embed-text';
      const gitPath = glyphicContent.match(/\[git\]\s*:\s*"([^"]+)"/)?.[1] || '';

      const toolchain = [];
      const toolchainBlock = glyphicContent.match(/toolchain\s+"[^"]+"\s*{([\s\S]*?)}/)?.[1] || '';
      const toolRegex = /<([^/\s>]+)\s*\/>/g;

      let toolMatch;

      while ((toolMatch = toolRegex.exec(toolchainBlock)) !== null) {
        toolchain.push(toolMatch[1]);
      }

      const tasks = [];
      const tasklistBlock = glyphicContent.match(/tasklist\s+"[^"]+"\s*{([\s\S]*?)}/)?.[1] || '';

      const taskRegex = /<task\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/task>)/g;

      let taskMatch;

      while ((taskMatch = taskRegex.exec(tasklistBlock)) !== null) {
        const [raw = '', attrs = '', innerText = ''] = taskMatch;

        const nameMatch = attrs.match(/"([^"]+)"/);
        const name = nameMatch ? nameMatch[1] : '';

        const cleanInner = innerText.trim().replace(/^"|"\s*\$/g, '');
        const query = `${name} ${cleanInner}`.trim();

        const completed = /\bcompleted\b/.test(attrs);
        const active = /\bactive\b/.test(attrs);

        tasks.push({
          raw,
          attrs,
          name,
          query,
          files: [],
          completed,
          active
        });
      }

      this.MODEL = model;
      this.EMBEDDING_MODEL = embeddingModel;
      this.toolchain = toolchain;

      return {
        namespace,
        model,
        embeddingModel,
        paths: [],
        gitPath,
        tasks,
        toolchain
      };
    } catch (err) {
      console.error(`Error parsing configuration: ${err.message}`);
      process.exit(1);
    }
  }

  async syncTaskState (targetTaskName, status) {
    try {
      const fileContent = await fs.readFile(this.agentPath, 'utf-8');

      const taskRegex = /<task\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/task>)/g;

      let updatedContent = fileContent.replace(taskRegex, (fullMatch, attrs, innerText) => {
        const nameMatch = attrs.match(/"([^"]+)"/);
        const nameAttr = nameMatch ? nameMatch[1] : '';

        if (nameAttr !== targetTaskName) {
          return fullMatch;
        }

        let cleanAttrs = attrs
          .replace(/\bactive\b/g, '')
          .replace(/\bcompleted\b/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (status === 'active') {
          cleanAttrs = `completed ${cleanAttrs}`;
        }

        if (status === 'completed') {
          cleanAttrs = cleanAttrs.replace(/\bcompleted\b/g, '').trim();
          cleanAttrs = `completed ${cleanAttrs}`;
        }

        if (status === 'active') {
          cleanAttrs = cleanAttrs.replace(/\bcompleted\b/g, '').trim();
          cleanAttrs = `active ${cleanAttrs}`;
        }

        if (fullMatch.endsWith('/>')) {
          return `<task ${cleanAttrs} />`;
        } else {
          return `<task ${cleanAttrs}>${innerText ? innerText : ''}</task>`;
        }
      });

      await fs.writeFile(this.agentPath, updatedContent, 'utf-8');

      // Sync our memoryConfig as well so consecutive steps don't reference stale layout versions
      if (this.memoryConfig) {
        this.memoryConfig = this.memoryConfig.replace(taskRegex, (fullMatch, attrs, innerText) => {
          const nameMatch = attrs.match(/"([^"]+)"/);
          const nameAttr = nameMatch ? nameMatch[1] : '';
          if (nameAttr !== targetTaskName) return fullMatch;

          let cleanAttrs = attrs.replace(/\bactive\b/g, '').replace(/\bcompleted\b/g, '').replace(/\s+/g, ' ').trim();
          if (status === 'active') cleanAttrs = `active ${cleanAttrs}`;
          if (status === 'completed') cleanAttrs = `completed ${cleanAttrs}`;

          if (fullMatch.endsWith('/>')) {
            return `<task ${cleanAttrs} />`;
          } else {
            return `<task ${cleanAttrs}>${innerText ? innerText : ''}</task>`;
          }
        });
      }
    } catch (err) {
      console.error(`Failed synchronization to configuration file: ${err.message}`);
    }
  }

  async task ({ files, taskList, task, query, currentSolution = '' }) {
    try {
      console.comment(`AGENT TASK: ${query}`);

      const response = await this.query({
        files,
        taskList,
        task,
        query,
        currentSolution
      });

      console.comment(`AGENT SOLUTION: ${response}`);
      console.success(`✔ Finished task: ${task}.`);
      console.comment(`AGENT: Marking task complete in configuration...`);

      await this.syncTaskState(task, 'completed');

      await this.exec(currentSolution);
    } catch (err) {
      console.error(`Uncaught core agent exception: ${err.message}`);
      process.exit(1);
    }
  }

  async query ({ files, taskList, task, query, currentSolution = '' }) {
    let lastResponse = '';

    const messages = [];

    for (let i = 0; i < this.toolchain.length; i++) {
      const toolName = this.toolchain[i];
      const tool = System.TOOLS[toolName];

      if (!tool) {
        console.warn(`Tool "${toolName}" not found. Skipping.`);

        continue;
      }

      console.info(`Using tool: "${toolName}"...`);

      const toolPrompt = await tool(this, {
        files,
        taskList,
        task,
        query,
        currentSolution
      });

      if (!toolPrompt) continue;

      messages.push({ role: 'user', content: toolPrompt });

      lastResponse = await this.chat(messages);

      const matches = lastResponse.match(/```(?:[\w-]*\n)?([\s\S]*?)```/g);

      currentSolution = matches?.length ? matches.join('\n') : lastResponse;

      console.info(`Done using tool: "${toolName}".`);
    }

    return currentSolution;
  }

  async exec (previousSolution = '') {
    const config = await this.readConfig();

    const tasks = config.tasks || [];
    const nextTask = tasks.find(t => !t.completed);

    if (!nextTask) {
      console.success('Nothing to do.');
      process.exit(0);
    }

    await this.syncTaskState(nextTask.name, 'active');

    console.log(`Starting a new task: ${nextTask.name}...`);

    return this.task({
      files: nextTask.files,
      taskList: tasks,
      task: nextTask.name,
      query: nextTask.query,
      currentSolution: previousSolution
    });
  }

  async load () {
    console.log('Loading files from bucket...');

    const focusFiles = await this.loadFilesFromPaths(path.join(__dirname, '../../', 'bucket'));

    console.ok('Done.');
    console.info('Creating vector stores...');

    const focusFileStore = await this.createVectorStore(focusFiles, 2);

    this.store = new VectorStore();
    this.store.embeddings = [...focusFileStore.embeddings];
    this.store.texts = [...focusFileStore.texts];
    this.store.multipliers = [...focusFileStore.multipliers];

    console.ok('Done.');
  }

  async loadAndExec() {
    await this.load();

    await this.exec();
  }
}
