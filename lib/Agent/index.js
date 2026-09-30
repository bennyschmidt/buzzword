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

/**
 * Agent
 *
 * A retrieval model with tool support for more
 * control over the query lifecycle.
 *
 * Agent automatically reads tasks from "buzz.json",
 * processes them one by one.
 */

export default class Agent extends RetrievalModel {
  constructor (config = {}) {
    super(config);

    this.toolchain = config.toolchain || [];

    this.loadAndExec();
  }

  async readConfig () {
    try {
      const buzzPath = path.join(__dirname, '../../', 'buzz.json');

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

    await fs.writeFile(path.join(__dirname, '../../', '.task'), '');

    const buzzPath = path.join(__dirname, '../../', 'buzz.json');

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
      console.comment(`AGENT: Pruning task log...`);

      const completedTask = await this.shiftTasks(taskList);

      if (!completedTask) {
        console.warn('× Failed to prune a completed task: ${task}.');
      } else {
        console.ok('Done.');
      }

      await this.exec(currentSolution);
    } catch (err) {
      console.error(`Uncaught error: ${err.message}`);
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

    for (let i = 0; i < this.toolchain.length; i++) {
      const toolName = this.toolchain[i];
      const tool = System.TOOLS[toolName];

      if (!tool) {
        console.warn(`Tool "${toolName}" not found. Skipping.`);

        continue;
      }

      console.info(`Using tool: "${toolName}"...`);

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

      console.info(`Done using tool: "${toolName}".`);
    }

    return currentSolution;
  }

  async exec (previousSolution = '') {
    const { tasks = [] } = await this.readConfig();

    if (!tasks?.length) {
      console.success('No tasks to complete.');
      process.exit(0);
    }

    const [topTask] = tasks;

    await fs.writeFile(path.join(__dirname, '../../', '.task'), topTask);

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

  async loadAndExec () {
    await this.load();

    await this.exec();
  }
}
