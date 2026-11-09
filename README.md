# Workflow Kit (`@osman3n/dsh-workflow-kit`)

Reusable workflow capsules for DeepSeek Harness **0.2.2-rc.1**.

The harness already ships a workflow runtime: the `workflow` tool plus the
`workflowEngine` service (`@deepseek-ai/dsh-tool-workflow` +
`@deepseek-ai/dsh-workflow-ptc`). That runtime takes a script and runs it once.
Workflow Kit is the **library layer on top of it** — the part that turns a
workflow from a one-shot script into something you can name, find, review, re-run
and audit afterwards:

| Layer | Provides |
| --- | --- |
| Native runtime (already installed) | sandboxed execution, subagents, concurrency limits, cancellation, `workflow` tool |
| **Workflow Kit (this plugin)** | versioned capsules, registry with scopes, declared inputs, durable run records, `/workflows` |

It deliberately does **not** re-implement orchestration, and it registers no
tool named `workflow`: execution always goes through
`ctx.workflowEngine.start(...)`, so sandboxing and budget behaviour stay native.

## Install

```powershell
# from a DeepSeek Harness session
plugin_manager install_bundle "C:\Users\osman_lam\Projects\Basic\plugins\workflow-kit"
```

The bundle patch inserts one plugin row (`workflow-kit`). Reload the app after
installing if the tools do not appear immediately.

## Capsules: `dsh.workflow` v1

A capsule is a small JSON manifest plus a JavaScript body:

```json
{
  "kind": "dsh.workflow",
  "version": 1,
  "name": "explain-module",
  "intent": "Explain what a module does and where its edges are.",
  "whenToUse": "A reader needs an orientation to one file or package.",
  "inputs": [
    { "name": "target", "type": "string", "required": true, "description": "Path or module name." },
    { "name": "depth", "type": "integer", "default": 2 }
  ],
  "phases": [{ "title": "Read", "detail": "Skim the module and its neighbours." }],
  "tags": ["explain"],
  "scriptFile": "./explain-module.workflow.js"
}
```

The body is a **function body**, not a module — no `import`, no `export`:

```js
const target = String(args.target ?? '').trim();
if (target === '') throw new Error('explain-module needs a "target" arg');

phase('Read');
const notes = await agent(`Read ${target} and summarise it.`, { label: 'read', phase: 'Read' });

return { target, notes };
```

Available inside the body (native hooks): `args`, `agent()`, `parallel()`,
`pipeline()`, `phase()`, `log()`, and `agent()` accepts `{ label, phase, schema }`.
The body must end with `return <value>`; that value is persisted as
`result.json` and returned to the calling model.

`script` may also be inline instead of `scriptFile`. A capsule is rejected (with
a readable error) when the name, intent, inputs, phases, or script shape is
wrong — validation happens before anything runs.

### Inputs

`inputs[]` declares `name`, `type` (`string · number · integer · boolean · array ·
object`), `required`, `description`, and an optional `default`. At call time the
values are type-checked, defaults are filled, and a missing required input fails
the call before the run starts.

## Where capsules live

Search order, low priority to high priority:

1. **builtin** — `workflows/` inside this plugin (`parallel-investigation`, `scoped-review`)
2. **project** — `<workspace>/.dsh/workflows`
3. **personal** — `$DSH_HOME/workflows` (default `~/.dsh/workflows`)
4. **extra** — `extraDirs` from config

A later scope wins when two capsules share a name, so a personal capsule can
override a builtin without editing the bundle. Every capsule is saved as a pair:

```
<dir>/<name>.workflow.json   manifest (readable, diffable, no huge escaped string)
<dir>/<name>.workflow.js     the body
```

## Tools

| Tool | Purpose |
| --- | --- |
| `workflow_list` | capsules visible from this workspace (scope, path, inputs, shadowing) + recent runs + search dirs + invalid capsules |
| `workflow_show` | one capsule: intent, when-to-use, inputs and defaults, phases, last run, script body (clipped) |
| `workflow_save` | author a capsule from `name`, `intent`, `script`, `inputs`, `defaults`, `phases`, `tags`, `scope`, `overwrite` |
| `workflow_run` | execute a capsule by name with `args`; `run_in_background` for long fan-outs |

`workflow_run` returns `runId`, `agentsStarted`, `stopReason`, the serialized
result (clipped to `maxResultChars`) and the paths of the run directory and
`result.json`.

## Slash command

```
/workflows                list capsules (alias: list)
/workflows show <name>    contract, inputs, paths, last run
/workflows runs [n]       recent run records
/workflows dirs           search directories, with existence
/workflows prune [keep]   delete old run records
/workflows help
```

The command is read-only on purpose: running a workflow is a model tool call,
so the model can pass declared args and see the result.

## Panel UI

The plugin adds a **Workflows** icon to the sidebar rail (next to the other
panel icons). It opens a page that reviews the capsules visible from the current
workspace — name, scope, inputs, phases, tags, path and shadowing — plus invalid
capsule files and the search directories.

**New workflow** opens an authoring form (name, intent, when-to-use, body,
overwrite). Saving goes through the host registry, so the new capsule is
validated exactly like `workflow_save`; the panel writes to the personal scope
(`$DSH_HOME/workflows`) because a global panel has no session workspace.

The page talks to a Host service through the Typert remote gateway
(`ctx.remote.workflows`); the same service is available to code as
`ctx.workflows` while the panel is installed.

## Run records

Every run writes one directory:

```
<workspace>/.dsh/workflow-runs/<runId>/
  run.json                status, start/finish, stop reason, agents, args, capsule path
  events.jsonl            run-start / phase / log / agent-start / agent-end / run-end stream
  workflow.workflow.json  the exact manifest and body that ran (provenance)
  result.json             the value the script returned
```

Records are written best-effort: a failed record write is logged and never
fails the workflow. The newest `runHistoryLimit` records are kept; older ones are
pruned when a run finishes (or via `/workflows prune`).

For background runs, phases and agent lifecycle lines are also mirrored into the
job's output ring, so the run is visible in the job list.

## Configuration

Patch config (all optional):

```yaml
- insert:
    - id: workflow-kit
      name: '@osman3n/dsh-workflow-kit'
      config:
        runHistoryLimit: 25
        maxResultChars: 40000
        maxScriptChars: 20000
        maxEventsPerRun: 5000
        enableRunInBackground: true
        commandName: workflows
        commandEnabled: true
        extraDirs: []
        builtinsDir: ''   # defaults to the bundle's own workflows/
```

## Built-in patterns

**`parallel-investigation`** — fan-out / synthesize. One researcher per angle
(default: docs, implementation, examples, risks) through `pipeline`, then one
synthesizer writes a cited brief. Inputs: `question` (required), `angles`,
`brief`.

**`scoped-review`** — fan-out / verdict. One reviewer per focus aspect (default:
correctness, security, maintainability) through `parallel`, each returning
severity-graded findings with evidence, then a verdict agent decides
`approve` / `request-changes` / `reject`. Inputs: `target` (required), `focus`,
`max_findings`.

## Requirements and failure modes

- The workflow runtime must be enabled (`workflowEngine` service). Without it,
  `workflow_list` / `workflow_show` / `workflow_save` still work and
  `workflow_run` fails with an explicit message.
- Host services are resolved through every path Cordis offers: property access,
  `ctx.get`, `ctx.root`, and finally the reflective service store. That last
  path matters because an agent preset may isolate `workflowEngine` into its own
  realm, where a profile-level bundle cannot see it by name alone. `workflow_list`
  reports which path answered under `Runtime:`, and prints a one-line `Context:`
  diagnostic (declared services, root flag, fiber state) when a runtime is
  missing.
- Background runs need the `jobs` service; otherwise pass
  `run_in_background: false`.
- Capsules are data: a broken capsule never breaks the plugin, it shows up under
  "invalid capsules" in `workflow_list` and `/workflows list`.