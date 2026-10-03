import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import VectorStore from '../VectorStore/index.js';
import Logger from '../Logger/index.js';

const console = new Logger('RetrievalModel');
const __dirname = dirname(fileURLToPath(import.meta.url));

export default class RetrievalModel {
  constructor(config = {}) {
    this.agentPath = config.agentPath || 'config.html';
    this.MODEL_BASE_URL = config.MODEL_BASE_URL || 'http://localhost:11434/api';
    this.MODEL_EMBED_URL = `${this.MODEL_BASE_URL}/embed`;
    this.MODEL_CHAT_URL = `${this.MODEL_BASE_URL}/chat`;

    // Fallback values handled dynamically during config loading phase
    this.MODEL = config.MODEL || 'coder-14';
    this.EMBEDDING_MODEL = config.EMBEDDING_MODEL || 'nomic-embed-text';
  }

  async embed(text, model = this.EMBEDDING_MODEL) {
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

  async createVectorStore(files, priorityMultiplier = 1) {
    const store = new VectorStore();
    const rawTexts = await this.readFiles(files);

    for (const fullText of rawTexts) {
      if (!fullText || !fullText.trim()) continue;
      const fileSections = fullText.split(/(<!NEW FILE>|<!END OF FILE>)/g);
      let currentChunk = [];

      for (const section of fileSections) {
        if (section.trim() === '<!NEW FILE>' || section.trim() === '<!END OF FILE>') {
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

  async loadFilesFromPaths(dirPath) {
    const config = await this.readConfig();

    return config.paths.map(filePath => path.join(dirPath, filePath));
  }

  async readFiles(files) {
    return Promise.all(
      files.map(async file => {
        try {
          return await fs.readFile(file, 'utf-8');
        } catch (err) {
          console.warn(`× Failed to read ${file}: ${err.message}`);
          return '';
        }
      })
    );
  }

  async chat(messages, model = this.MODEL) {
    console.comment('MODEL INPUT:\n\n', messages[messages.length - 1]?.content);

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

    console.comment('MODEL OUTPUT:\n\n');

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
        } catch (e) {}
      }
    }

    process.stdout.write('\n');
    return content;
  }
}
