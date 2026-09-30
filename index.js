import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import Agent from './lib/Agent/index.js';
import Logger from './lib/Logger/index.js';
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
import NoFileDeviationEvaluator from './tools/NoFileDeviationEvaluator/index.js'
import ResearchCreator from './tools/ResearchCreator/index.js';
import RetrievalAugmentedGeneration from './tools/RetrievalAugmentedGeneration/index.js';
import VariableEvaluator from './tools/VariableEvaluator/index.js';
import WeatherStamp from './tools/WeatherStamp/index.js';
import WikiArticleIntegrator from './tools/WikiArticleIntegrator/index.js';

const BUZZWORD = 'Buzzword';

/**
 * System
 *
 * The main service class that exposes library exports
 * and the currently running agent.
 */

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
  }

  constructor ({
    namespace = BUZZWORD,
    toolchain = []
  }) {
    super(namespace);

    const onLoad = async () => {
      const { version } = JSON.parse(
        await fs.readFile('package.json', 'utf-8')
      ) || {};

      this.version = version;

      this.agent = new Agent({
        toolchain
      });
    };

    this.lib = {
      VectorStore,
      RetrievalModel,
      Agent
    };

    onLoad();
  }
}

/* ----- */

/**
 * Example Application
 *
 * Defines two flows: JSDeveloper, WikiWriter.
 * Instantiates Buzzword with the WikiWriter agent toolchain.
 */

const JSDeveloper = {
  namespace: 'JS Developer',
  toolchain: [
   'JSCodeFileCreator',
   'CodeFileIntegrator',
   'VariableEvaluator',
   'CodeCompletenessEvaluator',
   'CorrectnessEvaluator',
   'CodeResponseEvaluator',
   'CodeFileDecorationCreator',
   'GitPullRequestIntegrator'
  ]
};

const WikiWriter = {
  namespace: 'WikiWriter',
  toolchain: [
    'ResearchCreator',
    'WikiArticleIntegrator',
    'FileIntegrator'
  ]
};

new System(WikiWriter);
