## Agentic Automation

LLMs can produce virtually any kind of writing: Code, documentation, articles, comments, email replies, and so-on. But "one-shot" prompting an LLM often leaves much to be desired.

<img width="1280" height="700" alt="one-shot-fail" src="https://github.com/user-attachments/assets/8180bbaf-33be-4421-af9b-126386ea94bc" />

###### Above: Popular chat models are read-only with limited access to the Internet.

Instead of having to be there, you can set up an iterative prompt pipeline that repeatedly uses the LLM while you're away.

```javascript

...

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

...

```

###### Above: The `Agent` class passes the prompt through a toolchain.

The use of these pipelines - or "tools" - is what turns a mere read-only LLM into a powerful "agent" that can read and create files, and integrate them with other services.

## Tool Chaining

Any function that returns a string can be a tool. After the initial prompt and response from a model's `chat` method, instead of only returning the answer, a "toolchain" (a declarative list of functions) is invoked - each tool's response is passed to the subsequent tool along with contextual information about the task and query, down a chain of functions that result in a final response or action.

```javascript

...

  const branchName = `${agent.MODEL}/${task
    .toLowerCase()
    .replace(/[\s]+/g, '-')
    .substring(0, 50)
    .replace(/\"/g, '')}-${Date.now()}`;

  console.comment('Creating a new branch in git...');

  const commitMessage = (await agent.chat([
    {
      role: 'user',
      content: `Generate a concise commit message for the following task: ${task}.\n\nDon't include any other details in your response.`,
    },
  ])).replace(/^"|"$/g, '');

  console.comment('Committing and pushing to git...');

...

```

###### Above: The built-in tool `GitPullRequestIntegrator` pushes a solution to a git branch.

```javascript

const PirateStyler = (_, { currentSolution = '' }) => `SOLUTION: ${currentSolution}\n\nQUERY:Transform the solution into pirate-speak and output the entire solution only. Don't include any other details in your response.`;

export default PirateStyler;
```

###### Above: A simple tool that would transform the answer into pirate-speak.

A tool can be as simple or as comprehensive as you want, but typically single-purpose tooling works best and makes for a more robust and modular tool library.

#### Toolchain Manipulation

For large tasks with many different areas of focus, entire toolchains might be ran in parallel. Define toolchains up-front and then create specialty tools that swap them in, add/remove tools, restart the chain, and so-on, based on some state or event.

```html
  <!-- A toolchain for creating Wiki style HTML pages -->

  toolchain "WikiArticleWriter" {
    <ResearchCreator />
    <WikiArticleIntegrator />
    <FileIntegrator />
  }
```

###### Above: `agent.glyph` is written in Glyphic (similar to JavaScript with JSX).

Being able to dynamically manipulate the toolchain opens up a new tier of automation where the agent is no longer just producing text, but observing the results of its work along the way and deciding the appropriate course of action given the tools available. The more useful tools the agent has, the more useful work it can do.

## Retrieval Augmented Generation (RAG)

The `Agent` class exposes a built-in `store` (instance of `VectorStore`), embedding all the files in `bucket`. This allows users to perform queries against their own files for highly accurate writing and code. The built-in `RetrievalAugmentedGeneration` tool (which performs a basic RAG query against the default bucket), relies on this vector store.

#### File Chunking

In the built-in vector store, files are split by `<!NEW FILE>` and `<!END OF FILE>` tags, respectively. These tags are added to all files in the bucket (except those listed in a .buzzignore present in the bucket directory) to be included in the vector store by default. 

## Declarative Tasking

```html
  <!-- A simple task list -->

  tasklist "Solar System Wiki" {
    <task completed "Create a wiki article about: The Sun" />
    <task completed "Create a wiki article about: Mercury" />
    <task completed "Create a wiki article about: Venus">
      "Write this one in Spanish."
    </task>
    <task active "Create a wiki article about: Earth" />
    <task "Create a wiki article about: Mars" />
    <task "Create a wiki article about: Jupiter" />
    <task "Create a wiki article about: Saturn" />
    <task "Create a wiki article about: Uranus" />
    <task "Create a wiki article about: Neptune" />
    // <task "Create a wiki article about: Pluto" />
  }
```

## agent.glyph

`agent.glyph` is a file that defines work to be done. The two main sections needed in the `agent.glyph`:

• The `Toolchain`

`toolchain` elements are definition blocks. Think of them like imports.

• The `Tasklist`

`tasklist` elements, and each `<task />` therein, will run just by being present in the file. If the tasks change during run-time, the changes will be picked up by Buzzword before the next task starts. 

```javascript
agent "Star Trek Wiki Site Creator" {
  [model]  : "coder-14"
  [embedModel] : "nomic-embed-text"
  [bucket] : "solar-system-wiki"
  [git]    : "solar-system-wiki"

  toolchain "WikiArticleWriter" {
    <ResearchCreator />
    <WikiArticleIntegrator />
    <FileIntegrator />

    <tool "GitBranchIntegrator" [agent, files, task, solution]>
      [log]       : Logger("GitBranchIntegrator")
      [config]    : agent.readConfig()
      [gitPath]   : "bucket" / config.gitPath
      [fileRef]   : files.first()
      [content]   : agent.store.texts.find("NAME: \$fileRef")
      [filePath]  : content.match(/FILE_PATH:\s*([^\s\*]+)/)?.trim()
      [target]    : gitPath / filePath
      [branch]    : "\${config.model || 'coder-14'}"
      [cleanSolution] : solution.strip('```')
      [commitMessage] : agent.chat("Generate concise commit message for: $task")

      log.comment("Writing solution to file...")
      file.write(target, cleanSolution)

      log.comment("Committing and pushing to git...")
      shell("cd $gitPath && git pull && git add $target && git commit -m '$commitMessage' && git checkout -b $branch && git push")

      log.comment("Resetting git...")
      shell("cd $gitPath && git reset && git stash && git checkout master && git reset --hard HEAD")

      return "Saved to $target, committed, and pushed to a new branch \"$branch\"."
    </tool>
  }

  tasklist "Solar System Wiki" {
    <task completed "Create a wiki article about: The Sun" />
    <task completed "Create a wiki article about: Mercury" />
    <task completed "Create a wiki article about: Venus">
      "Write this one in Spanish."
    </task>
    <task active "Create a wiki article about: Earth" />
    <task "Create a wiki article about: Mars" />
    <task "Create a wiki article about: Jupiter" />
    <task "Create a wiki article about: Saturn" />
    <task "Create a wiki article about: Uranus" />
    <task "Create a wiki article about: Neptune" />
    // <task "Create a wiki article about: Pluto" />
  }
}
```

###### Above: Custom tools can be written in Glyphic or Node.js (to which they are compiled). 

##### Glyphic 

###### Glyphic is a scripting language that natively mixes logic with markup (similar to JavaScript & JSX) to enforce a more intent-driven, component-oriented, state-based paradigm that is optimized for the agentic lifecycle.

## (Meta) Contributing

Buzzword can be used to contribute to itself. Have a feature you want to add or change in Buzzword? Add this repo to your bucket and define your tasks in `agent.glyph`!

-----

Looking for the web API & UI for Buzzword? Try [Buzzsaw](https://github.com/bennyschmidt/buzzsaw) 

Learn more about the Glyphic language: [Glyphic](https://github.com/bennyschmidt/glyphic)
