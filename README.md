## Agentic Automation

LLMs can produce virtually any kind of writing: Code, documentation, articles, comments, email replies, and so-on. But "one-shot" prompting an LLM often leaves much to be desired.

<img width="1280" height="700" alt="one-shot-fail" src="https://github.com/user-attachments/assets/8180bbaf-33be-4421-af9b-126386ea94bc" />

###### Above: Popular chat models are read-only with limited access to the Internet.

Instead of hoping it works the first time, or arguing back-and-forth with the LLM like a maniac, you can greatly improve the quality of automated results and the size of the workload by setting up an iterative prompt pipeline that repeatedly uses the LLM with pre-defined functionality while you're away.

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

The use of these declarative pipelines - or "tools" - is what turns a mere read-only LLM into a powerful "agent" that can read and create files, integrate them with other files and services, evaluate them for quality and correctness, and even flush the context of a previous task and load up another one - repeatedly.

## Tool Chaining

Any function that returns a string can be a tool. After the initial prompt and response from a model's `chat` method, instead of just returning the answer, a "toolchain" (a declarative list of functions) is invoked to augment and iteratively use the LLM - where a tool's response is passed to the subsequent tool along with contextual information about the task and query, down a "chain" or pipeline of functions that result in a final response or action.

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

For example, the first tool in a chain might fetch time-sensitive content at the moment of invocation and produce a written report, saving it to the hard drive. Another tool might take that report and produce an HTML page from it, before passing it to a tool that pushes it to a git repo to be deployed. Another may add interactive widgets and graphics, and then open a PR for review. Tools can be chained for as long as there is iterative work to be done on a task.

```javascript

const PirateStyler = (_, { currentSolution = '' }) => `SOLUTION: ${currentSolution}\n\nQUERY:Transform the solution into pirate-speak and output the entire solution only. Don't include any other details in your response.`;

export default PirateStyler;
```

###### Above: A simple tool that would transform the answer into pirate-speak.

A tool can be as simple or as comprehensive as you want, but typically single-purpose tooling works best and makes for a more robust and modular tool library.

#### Toolchain Manipulation

For large tasks with many different areas of focus, entire toolchains might be ran in succession or in parallel to tackle the different aspects of work related to the overall goal. This can be accomplished by defining toolchains up-front and then creating specialty tools that swap them in, add/remove tools, restart the chain, and so-on, based on some state or event, like user (or network) input, time elapsed, the result of some prior tool in the chain, etc.

```html
  <!-- A toolchain for creating Wiki style HTML pages -->

  toolchain "WikiArticleWriter" {
    <ResearchCreator />
    <WikiArticleIntegrator />
    <FileIntegrator />
  }
```

Being able to dynamically manipulate the toolchain opens up a new tier of automation where the agent is no longer just producing text, but observing the results of its work along the way and deciding the appropriate course of action given the tools available. The more useful tools the agent has, the more useful work it can do.

## Retrieval Augmented Generation (RAG)

The `Agent` class exposes a built-in `store` (instance of `VectorStore`), embedding all the files in `bucket`. This allows users to perform queries against their own files for highly accurate writing and code. The built-in `RetrievalAugmentedGeneration` tool (which performs a basic RAG query against the default bucket), relies on this vector store.

#### File Chunking

In the built-in vector store, files are split by `<!NEW FILE>` and `<!END OF FILE>` tags, respectively. These tags must be added to files in the bucket in order to be included in the vector store by default. Decoration around these tags is not very strict, but may add small amounts of unwanted noise in retrieval (e.g. both `<!-- <!NEW FILE> -->` and `/* <!NEW FILE> */`, and other forms of comment syntax will still work). If iterating on a code repo, it's recommend to create tool(s) that either preserve or add these tags to files when done editing them, so that the next agent can reference them in the store.

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

`agent.glyph` is a file that defines agentic work to be done. The two main sections needed in the `agent.glyph`:

• The `Toolchain`

`toolchain` elements are definition blocks. Think of them like imports - they don't run the code in the `<tool />` immediately, they only define which should run (and in which order). If the file is manipulated in JavaScript during run-time, the changes will be picked up by Buzzword before the next tool invocation. If there are multiple `toolchain` blocks, they will each run the same tasks in parallel. To run in order from top-to-bottom they must be inside a parent `toolchain`. Nesting `toolchain` will effectively append the tools therein to the parent.

• The `Tasklist`

`tasklist` elements, and each `<task />` therein, will run just by being present in the file. If the file is manipulated in JavaScript during run-time, the changes will be picked up by Buzzword before the next task starts. If there are multiple `tasklist` blocks, they will run in parallel. To run in order from top-to-bottom they must be inside a parent `tasklist`. Nesting `tasklist` will effectively append the tasks therein to the parent.

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

> [!NOTE]
> Whatever is added to the .glyph file text is executed, even during run-time, just like an HTML web page.

## (Meta) Contributing

Buzzword can be used to contribute to itself. Have a feature you want to add or change in Buzzword? Add this repo to the bucket directory with `<!NEW FILE>`/`<!END OF FILE>` tags around relevant files, and define your task(s) and tool(s). Your agent will work tirelessly until its tasks are complete!
