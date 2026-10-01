import fs from 'node:fs/promises';
import Logger from './lib/Logger/index.js';
import Agent from './lib/Agent/index.js';
import RetrievalModel from './lib/RetrievalModel/index.js';
import VectorStore from './lib/VectorStore/index.js';

import CodeCompletenessEvaluator from './tools/CodeCompletenessEvaluator/index.js';
import CodeCreator from './tools/CodeCreator/index.js';
import CodeFileDecorationCreator from './tools/CodeFileDecorationCreator/index.js';
import CodeFileIntegrator from './tools/CodeFileIntegrator/index.js';
import CodeIntegrator from './tools/CodeIntegrator/index.js';
import CodeResponseEvaluator from './tools/CodeResponseEvaluator/index.js';
import CorrectnessEvaluator from './tools/CorrectnessEvaluator/index.js';
import FileIntegrator from './tools/FileIntegrator/index.js';
import GitPullRequestIntegrator from './tools/GitPullRequestIntegrator/index.js';
import JSCodeCreator from './tools/JSCodeCreator/index.js';
import JSCodeFileCreator from './tools/JSCodeFileCreator/index.js';
import NoDeviationEvaluator from './tools/NoDeviationEvaluator/index.js';
import NoFileDeviationEvaluator from './tools/NoFileDeviationEvaluator/index.js';
import ResearchCreator from './tools/ResearchCreator/index.js';
import RetrievalAugmentedGeneration from './tools/RetrievalAugmentedGeneration/index.js';
import VariableEvaluator from './tools/VariableEvaluator/index.js';
import WeatherStamp from './tools/WeatherStamp/index.js';
import WikiArticleIntegrator from './tools/WikiArticleIntegrator/index.js';

export default class System extends Logger {
  static TOOLS = {
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
    WeatherStamp,
    ResearchCreator,
    WikiArticleIntegrator,
    FileIntegrator
  };

  constructor({ configPath = 'config.html' } = {}) {
    super('System');
    this.configPath = configPath;

    this.lib = {
      VectorStore,
      RetrievalModel,
      Agent
    };

    this.onLoad();
  }

  async onLoad() {
    try {
      const agent = new Agent({ configPath: this.configPath });
      const config = await agent.readConfig();

      this.namespace = config.namespace;
      this.version = "1.0.0";
      this.agent = agent;
    } catch (err) {
      this.error(`Initialization failure: ${err.message}`);
    }
  }
}

new System({
  configPath: 'agent.html'
});
