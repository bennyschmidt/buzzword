# Buzzword

Define a list of tasks, add files for reference, run it with your favorite models on a capable machine.

[buzzword-demo.mp4] 

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

## Declarative Markup 

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

WIP

## Tasks & Reference

TODO: `buzz.json` 

WIP

## (Meta) Contributing 

Buzzword can even be used to contribute to itself. Have a feature you want to add or change in Buzzword? Drop this entire repo into the bucket directory and define your task(s) and tool(s). You can even use a tool to handle the forking and open the PR. 
