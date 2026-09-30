## Agentic Automation

LLMs can automate virtually any writing: Code, documentation, articles, comments, email replies, and so-on. But "one-shot" prompting an LLM often leaves much to be desired.

[one-shot-prompt.png] 

Instead of hoping it works the first time, or arguing back-and-forth with the LLM like a maniac, you can greatly improve the quality of automated results and the size of the workload by setting up a *prompt pipeline* that iteratively prompts the LLM with pre-defined functionality while you're away.

The use of these declarative pipelines - or "tools" - is what turns a mere read-only LLM into a powerful "agent" that can read and create files, integrate them with other files and services, evaluate them for quality and correctness, and even flush the context of a previous task and load up another one - repeatedly.

## Tool Chaining

Any function that returns a string can be a tool. After the initial prompt and response from a model's `chat` method, instead of just returning the answer, a "toolchain" (a declarative list of functions) is invoked to augment and iteratively use the LLM - where a tool's response is passed to the subsequent tool along with contextual information about the task and query, down a "chain" or pipeline of functions that result in a final response or action.

[buzzword-tool.png] 

For example, the first tool in a chain might fetch time-sensitive content at the moment of invocation and produce a written report, saving it to the hard drive. Another tool might take that report and produce an HTML page from it, before passing it to a tool that pushes it to a git repo to be deployed. Another may add interactive widgets and graphics, and then open a PR for review. Tools can be chained for as long as there is iterative work to be done on a task. 

[buzzword-simple-tool.png] 

A tool can be as simple or as comprehensive as you want, but typically single-purpose tooling works best and makes for a more robust and modular tool library. 

#### Toolchain Manipulation

For large tasks with many different areas of focus, entire toolchains might be ran in succession or in parallel to tackle the different aspects of work related to the overall goal. This can be accomplished by defining toolchains up-front and then creating specialty tools that swap them in, add/remove tools, restart the chain, and so-on, based on some state or event, like user (or network) input, time elapsed, the result of some prior tool in the chain, etc. 

[toolchain-markup.png] 

Being able to dynamically manipulate the toolchain opens up a new tier of automation where the agent is no longer just producing text, but observing the results of its work along the way and deciding the appropriate course of action given the tools available. The more useful tools the agent has, the more useful work it can do. 

## Declarative Tooling

```html
  <!-- A toolchain for JavaScript coding tasks -->

  <toolchain name="JSDeveloper">
    <tool name="JSCodeFileCreator" />
    <tool name="CodeFileIntegrator" />
    <tool name="VariableEvaluator" />
    <tool name="CodeCompletenessEvaluator" />
    <tool name="CorrectnessEvaluator" />
    <tool name="CodeResponseEvaluator" />
    <tool name="CodeFileDecorationCreator" />
    <tool name="GitPullRequestIntegrator" />
  </toolchain>

  <!-- A toolchain for creating Wiki style HTML pages -->

  <toolchain name="WikiArticleWriter">
    <tool name="ResearchCreator" />
    <tool name="WikiArticleIntegrator" />
    <tool name="FileIntegrator" />
  </toolchain>
``` 

WIP 

## Retrieval Augmented Generation (RAG)

The `Agent` class exposes a built-in `store` (instance of `VectorStore`), embedding all the files in `bucket`. This allows users to perform queries against their own files for highly accurate writing and code. The built-in `RetrievalAugmentedGeneration` tool (which performs a basic RAG query against the default bucket), relies on this vector store. 

#### File Chunking 

In the built-in vector store, files are split by `<!NEW FILE>` and `<!END OF FILE>` tags, respectively. These tags must be added to files in the bucket in order to be included in the vector store by default. Decoration around these tags is not very strict, but may add small amounts of unwanted noise in retrieval (e.g. both `<!-- <!NEW FILE> -->` and `/* <!NEW FILE> */`, and other forms of comment syntax will still work). If iterating on a code repo, it's recommend to create tool(s) that either preserve or add these tags to files when done editing them, so that the next agent can reference them in the store. 

## Tasks & Reference

`buzz.json` 

```json
{
  "gitPath": "",
  "paths": [],
  "tasks": []
}
```

WIP

## Agent Hooks

API endpoints that invoke toolchains upon request. 

WIP 

## Declarative Tasking

```html
  <!-- A simple task list -->

  <tasklist name="finish the about page">
    <task files="AboutPage" name="new heading">
      Add a title with an h1 tag "The Company" with var(--font) and under that a <h3>Meet our team</h3> in sans-serif, size 14px.
    </task>
    <task files="AboutPage" name="add a gallery">
      Add a photo gallery (use some popular npm for it) to navigate through all the images in /images and provide fullscreen previews.
    </task>
    <task files="Navigation" name="add the about page to the nav">
      Add the new AboutPage to the nav. 
    </task>
  </tasklist>
```

WIP 

#### Generative Tasking

Just as tools can manipulate their toolchains, a tasklist can self-implement with a `goal` attribute. Include them in your toolchain to automatically generate and/or audit tasklists.

```html
  <!-- A self-generating tasklist -->
  <tasklist name="finish the about page" goal="add mobile/responsive styles" />
```

> [!NOTE]
> This is accomplished with the built-in `TaskListCreator` and `TaskListEvaluator` tool(s). 

WIP 

## todo.html

A `todo.html` is an HTML file that automatically executes any agentic work defined therein. There are two main sections needed in a `todo.html`:

• The `Toolchain`

`<toolchain />` elements are definition blocks. Think of them like imports - they don't run the code in the `<tool />`, they only define which should run (and in which order). Several `<toolchain />` blocks in a `todo.html` just means you are defining multiple agentic flows (which may or may not be invoked).

• The `Tasklist`

`<tasklist />` elements, and each `<task />` therein, will run just by being present in the file. If the file is manipulated in JavaScript during run-time, the changes will be picked up by Buzzword immediately. If there are multiple `<tasklist />` blocks, they will run in order from top-to-bottom. 

```html
  <!doctype html>
  <html lang="en">
    <toolchain name="WikiArticleWriter">
      <tool name="ResearchCreator" />
      <tool name="WikiArticleIntegrator" />
      <tool name="FileIntegrator" />
    </toolchain>
    <tasklist name="Solar System Wiki">
      <task files="sun-info.txt" name="Create a wiki article about: The Sun" />
      <task files="mercury-info.txt" name="Create a wiki article about: Mercury" />
      <task files="venus-info.txt" name="Create a wiki article about: Venus" />
      <task files="earth-info.txt" name="Create a wiki article about: Earth" />
      <task files="mars-info.txt" name="Create a wiki article about: Mars" />
      <task files="jupiter-info.txt" name="Create a wiki article about: Jupiter" />
      <task files="saturn-info.txt" name="Create a wiki article about: Saturn" />
      <task files="uranus-info.txt" name="Create a wiki article about: Uranus" />
      <task files="neptune-info.txt" name="Create a wiki article about: Neptune" />
      <!-- <task files="pluto-info.txt" name="Create a wiki article about: Pluto" /> -->
    </tasklist>
  </html>
```

> [!NOTE]
> Whatever is added to the HTML text is executed, even during run-time, just like an HTML web page.

WIP

## Agentic Development Is Declarative

If large model ML is the "back-end", and prompt engineering is the "front-end", then this library and framework aims to be like a "React" for agentic development, for projects with dynamic workflows that have complex states and conditions. 

#### Bring Your Own Model 

Since the focus is on workflows, rather than model performance (e.g. training and fine-tuning), Buzzword is entirely BYOM, in the same way that React is BYOB (browser). The only compliance it will even ask of that is the OpenAPI 3.0 spec that most modern LLMs and wrappers use for model requests.

#### Next Logical Step

Until ~1999, browsers didn't have a modern HTML runtime that would update a page dynamically. Though you could link to other pages, the page load was the only event - there was no lifecycle until the advent of DHTML. So, in these early days of LLMs, there is a parallel: The user is largely still driving them manually. But with just a little bit of state and condition management, the read-only, static LLM can be transformed to be dynamic, animated, event-driven, and even self-improving.

## (Meta) Contributing 

Buzzword can be used to contribute to itself. Have a feature you want to add or change in Buzzword? Add the `index.js` file from this repo into the bucket directory with `<!NEW FILE>`/`<!END OF FILE>` tags, and define your task(s) and tool(s). Your agent will work tirelessly until its tasks are complete!

You could even use a tool to handle the forking of the repo, and opening a PR with your changes. 
