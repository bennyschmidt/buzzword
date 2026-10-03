import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
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

  constructor ({ agentPath = 'agent.glyph' } = {}) {
    super('Buzzword');

    this.agentPath = agentPath;

    this.lib = {
      VectorStore,
      RetrievalModel,
      Agent
    };

    this.onLoad();
  }

  async onLoad () {
    try {
      this.info(`Loading glyph from ${this.agentPath}...`);

      const rawGlyphic = await fs.readFile(this.agentPath, 'utf-8');

      const cleanedGlyphic = this.compileTools(rawGlyphic);

      const agent = new Agent({
        agentPath: this.agentPath,
        memoryConfig: cleanedGlyphic
      });

      const config = await agent.readConfig();

      this.namespace = config.namespace;
      this.version = "1.0.0";
      this.agent = agent;
    } catch (err) {
      this.error(`Failed to initialize: ${err.message}`);
    }
  }

  compileTools (rawGlyphic) {
    let outputGlyphic = rawGlyphic;

    const toolRegex = /<tool\s+"([^"]+)"\s+\[([^\]]+)\]>([\s\S]*?)<\/tool>/g;

    let match;

    while ((match = toolRegex.exec(rawGlyphic)) !== null) {
      const [fullToolBlock, toolName, rawArgs, toolBody] = match;

      this.info(`Compiling inline tool: "${toolName}"...`);

      try {
        const compiledFn = this.compile(toolName, rawArgs, toolBody);

        System.TOOLS[toolName] = compiledFn;

        outputGlyphic = outputGlyphic.replace(fullToolBlock, `<${toolName} />`);
      } catch (compileErr) {
        this.error(`Failed to compile tool "${toolName}": ${compileErr.message}`);
      }
    }

    return outputGlyphic;
  }

  compile (toolName, rawArgs, toolBody) {
    const args = rawArgs.split(',').map(s => s.trim());
    const lines = toolBody.split('\n');

    const translatedLines = lines.map(line => {
      let cleanLine = line.trim();

      if (!cleanLine || cleanLine.startsWith('//')) {
        return line;
      }

      if (cleanLine.startsWith('[')) {
        const shelfMatch = cleanLine.match(/^\[([^\]]+)\]\s*:\s*([\s\S]+)$/);

        if (shelfMatch) {
          const varName = shelfMatch[1].trim();

          let expr = shelfMatch[2].trim();

          expr = this.transformExpression(expr);

          return `  varName = ${expr};`;
        }
      }

      return `  ${this.transformExpression(cleanLine)}`;
    });

    const jsFunctionBody = `
      const fs = await import('node:fs/promises');

      const path = await import('node:path');

      const { exec } = await import('node:child_process');

      const Logger = (await import('../../lib/Logger/index.js')).default;

      const log = new Logger("${toolName}");

      const shell = (cmd) => new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
          if (error) reject(error || stderr);

          else resolve(stdout);
        });
      });

      const [agent, files, taskList, task, query, currentSolution] = [
        arguments[0],
        arguments[1]?.files || [],
        arguments[1]?.taskList || [],
        arguments[1]?.task || '',
        arguments[1]?.query || '',
        arguments[1]?.currentSolution || ''
      ];

      // Extended Array helper for files list

      files.first = function () { return this[0] || ''; };

      // String prototype adjustments for clean mappings

      if (!String.prototype.strip) {
        String.prototype.strip = function(char) {
          return this.split(char).join('');
        };
      }

      if (!String.prototype.slug) {
        String.prototype.slug = function() {
          return this.toLowerCase().replace(/[\\s]+/g, '-').replace(/[^a-z0-9\\-]/g, '');
        };
      }

      try {
        ${translatedLines.join('\n')}
      } catch(err) {
        log.error("Runtime error in compiled tool: " + err.message);

        return "";
      }
    `;

    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

    return new AsyncFunction(jsFunctionBody);
  }

  transformExpression (expr) {
    let cleanExpr = expr;

    if (cleanExpr.includes('/') && !/https?:\/\//.test(cleanExpr)) {
      const parts = cleanExpr.split(/\s*\/\s*/);

      if (parts.length > 1) {
        cleanExpr = `path.resolve(${parts.join(', ')})`;
      }
    }

    cleanExpr = cleanExpr.replace(/{#now}/g, '${Date.now()}');
    cleanExpr = cleanExpr.replace(/([^\\])\$(\w+)/g, '$1${$2}');
    cleanExpr = cleanExpr.replace(/\\\$/g, '$');

    if (cleanExpr.includes('"""')) {
      cleanExpr = cleanExpr.replace(/"""/g, '`');
    }

    if (cleanExpr.includes('→')) {
      const segments = cleanExpr.split(/\s*→\s*/);

      let core = segments[0];

      for (let i = 1; i < segments.length; i++) {
        let rhs = segments[i].trim();

        if (rhs.startsWith('catch') || rhs.startsWith('fail')) {
          const inlineBody = rhs.replace(/^(catch|fail)/, '').trim();
          const nestedExpression = this.transformExpression(inlineBody);

          core = `await (async () => { try { return ${core}; } catch(err) { ${nestedExpression}; } })()`;

          continue;
        }

        if (rhs === 'terminate') {
          core = `process.exit(1)`;

          continue;
        }

        if (rhs.startsWith('.')) {
          core = `(await (${core}))${rhs}`;
        }

        else if (rhs.startsWith('(') && rhs.endsWith(')')) {
          const fnName = rhs.slice(1, -1).trim();

          core = `await ${fnName}(${core})`;
        } else {
          const openParenIndex = rhs.indexOf('(');
          if (openParenIndex !== -1) {
            const baseFn = rhs.substring(0, openParenIndex);
            const innerArgs = rhs.substring(openParenIndex + 1, rhs.length - 1);
            const argsList = innerArgs ? `${innerArgs}, ${core}` : core;

            core = `await ${baseFn}(${argsList})`;
          } else {
            core = `await ${rhs}(${core})`;
          }
        }
      }

      cleanExpr = core;
    }

    if (cleanExpr.startsWith('file.write')) {
      cleanExpr = cleanExpr.replace('file.write', 'await fs.writeFile');
    }

    return cleanExpr;
  }
}

new System({
  agentPath: 'agent.glyph'
});
