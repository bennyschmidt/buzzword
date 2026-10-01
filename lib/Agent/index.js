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
  constructor(config = {}) {
    super(config);
    this.configPath = path.resolve(config.configPath || 'config.html');
    this.toolchain = [];
    this.loadAndExec();
  }

  async readConfig() {
    try {
      const html = await fs.readFile(this.configPath, 'utf-8');

      const namespace = html.match(/<namespace>([\s\S]*?)<\/namespace>/)?.[1]?.trim() || '';
      const model = html.match(/<model[^>]*name="([^"]+)"/)?.[1] || 'coder-14';

      const bucketMatch = html.match(/<bucket[^>]*model="([^"]+)"/);
      const embeddingModel = bucketMatch ? bucketMatch[1] : 'nomic-embed-text';

      const gitPath = html.match(/<git[^>]*path="([^"]+)"/)?.[1] || '';

      const paths = [];
      const fileRegex = /<file[^>]*path="([^"]+)"[^>]*\/>/g;
      let fileMatch;
      while ((fileMatch = fileRegex.exec(html)) !== null) {
        paths.push(fileMatch[1]);
      }

      const toolchain = [];
      const toolchainBlock = html.match(/<toolchain[^>]*>([\s\S]*?)<\/toolchain>/)?.[1] || '';
      const toolRegex = /<tool[^>]*name="([^"]+)"[^>]*\/>/g;
      let toolMatch;

      while ((toolMatch = toolRegex.exec(toolchainBlock)) !== null) {
        toolchain.push(toolMatch[1]);
      }

      const tasks = [];
      const taskRegex = /<task\s+([\s\S]*?)(?:\/>|>([\s\S]*?)<\/task>)/g;

      let taskBlockMatch;

      while ((taskBlockMatch = taskRegex.exec(html))) {
        if (!taskBlockMatch) continue;

        const [raw = '', attrs = '', innerText = ''] = taskBlockMatch;
        const name = attrs.match(/name="([^"]+)"/)?.[1] || '';
        const query = `${name} ${innerText.trim()}`;
        const filesAttr = attrs.match(/files="([^"]+)"/)?.[1] || '';
        const completed = /\bcompleted\b/.test(attrs);
        const active = /\bactive\b/.test(attrs);

        tasks.push({
          raw,
          attrs,
          name,
          query,
          files: filesAttr.split(',').map(f => f.trim()).filter(Boolean),
          completed,
          active
        });
      }

      this.MODEL = model;
      this.EMBEDDING_MODEL = embeddingModel;
      this.toolchain = toolchain;

      return { namespace, model, embeddingModel, paths, gitPath, tasks, toolchain };
    } catch (err) {
      console.error(`Error reading/parsing markup configuration: ${err.message}`);
      process.exit(1);
    }
  }

  async syncTaskState(targetTaskName, status) {
    try {
      const html = await fs.readFile(this.configPath, 'utf-8');

      // Re-parses both tag styles seamlessly during updates to maintain complete formatting integrity
      const taskRegex = /<task\s+([\s\S]*?)(?:\/>|>([\s\S]*?)<\/task>)/g;
      let updatedHtml = html.replace(taskRegex, (fullMatch, attrs, innerText) => {
        const nameAttr = attrs.match(/name="([^"]+)"/)?.[1];
        if (nameAttr !== targetTaskName) return fullMatch;

        let cleanAttrs = attrs.replace(/\s+active\b/g, '').replace(/\s+completed\b/g, '').trim();

        if (status === 'active') cleanAttrs += ' active';
        if (status === 'completed') cleanAttrs += ' completed';

        if (fullMatch.endsWith('/>')) {
          return `<task ${cleanAttrs} />`;
        } else {
          return `<task ${cleanAttrs}>${innerText ? innerText : ''}</task>`;
        }
      });

      await fs.writeFile(this.configPath, updatedHtml, 'utf-8');
    } catch (err) {
      console.error(`Failed synchronization to configuration file: ${err.message}`);
    }
  }

  async task({ files, taskList, task, query, currentSolution = '' }) {
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
      console.comment(`AGENT: Marking task complete in markup configuration...`);

      await this.syncTaskState(task, 'completed');

      await this.exec(currentSolution);
    } catch (err) {
      console.error(`Uncaught core agent exception: ${err.message}`);
      process.exit(1);
    }
  }

  async query({ files, taskList, task, query, currentSolution = '' }) {
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

  async exec(previousSolution = '') {
    const config = await this.readConfig();
    const tasks = config.tasks || [];

    const nextTask = tasks.find(t => !t.completed);

    if (!nextTask) {
      console.success('All tasks in markup configurations completed!');
      process.exit(0);
    }

    await this.syncTaskState(nextTask.name, 'active');

    console.log(`Starting a new task from configuration state: ${nextTask.name}...`);

    return this.task({
      files: nextTask.files,
      taskList: tasks,
      task: nextTask.name,
      query: nextTask.query, // Now maps directly to the compiled metadata with inner text strings built-in
      currentSolution: previousSolution
    });
  }

  async load() {
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
