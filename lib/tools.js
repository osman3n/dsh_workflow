/**
 * Model-facing tools.
 *
 * Four tools, all thin wrappers over the registry, the run store and the
 * native workflow engine:
 *
 *   workflow_list — discover capsules and recent runs
 *   workflow_show — inspect one capsule's contract and script
 *   workflow_save — author a capsule from a name, intent and script body
 *   workflow_run  — execute a capsule by name (foreground or background)
 *
 * Definitions are raw ToolDefinition objects (no `@deepseek-ai/dsh-tools`
 * import), because plugins in this profile cannot resolve harness packages.
 */

import { join } from 'node:path';

import {
  applyInputs,
  clip,
  describeInputs,
  errorMessage,
  isPlainObject,
  normalizeCapsule,
  resolveService,
  serviceOf,
  stringifyJson,
  toWorkflowMeta
} from './spec.js';

const TEXT = (text) => [{ type: 'text', text }];

const INPUT_ITEM = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', description: 'Identifier used as the property name in args, e.g. "question".' },
    type: { type: 'string', enum: ['string', 'number', 'integer', 'boolean', 'array', 'object'] },
    required: { type: 'boolean' },
    description: { type: 'string' }
  },
  required: ['name']
};

const PHASE_ITEM = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    detail: { type: 'string' }
  },
  required: ['title']
};

const LIST_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    cwd: { type: 'string' },
    workflows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          intent: { type: 'string' },
          whenToUse: { type: 'string' },
          inputs: { type: 'string' },
          scope: { type: 'string' },
          path: { type: 'string' },
          alsoIn: { type: 'string' },
          warnings: { type: 'string' }
        },
        required: ['name', 'intent', 'whenToUse', 'inputs', 'scope', 'path', 'alsoIn', 'warnings']
      }
    },
    problems: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          scope: { type: 'string' },
          path: { type: 'string' },
          error: { type: 'string' }
        },
        required: ['name', 'scope', 'path', 'error']
      }
    },
    runs: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          status: { type: 'string' },
          startedAt: { type: 'string' },
          agentsStarted: { type: 'integer' },
          dir: { type: 'string' }
        },
        required: ['id', 'name', 'status', 'startedAt', 'agentsStarted', 'dir']
      }
    },
    dirs: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          scope: { type: 'string' },
          dir: { type: 'string' },
          exists: { type: 'boolean' }
        },
        required: ['scope', 'dir', 'exists']
      }
    },
    runtime: {
      type: 'object',
      additionalProperties: false,
      properties: {
        engine: { type: 'string' },
        jobs: { type: 'string' },
        sessions: { type: 'string' },
        commands: { type: 'string' },
        diag: { type: 'string' }
      },
      required: ['engine', 'jobs', 'sessions', 'commands', 'diag']
    }
  },
  required: ['cwd', 'workflows', 'problems', 'runs', 'dirs', 'runtime']
};

const SHOW_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    intent: { type: 'string' },
    whenToUse: { type: 'string' },
    scope: { type: 'string' },
    path: { type: 'string' },
    script: { type: 'string' },
    scriptChars: { type: 'integer' },
    truncated: { type: 'boolean' },
    tags: { type: 'array', items: { type: 'string' } },
    inputs: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          type: { type: 'string' },
          required: { type: 'boolean' },
          description: { type: 'string' },
          defaultText: { type: 'string' }
        },
        required: ['name', 'type', 'required', 'description', 'defaultText']
      }
    },
    phases: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' }
        },
        required: ['title', 'detail']
      }
    },
    lastRunId: { type: 'string' },
    lastRunStatus: { type: 'string' },
    lastRunAt: { type: 'string' },
    runDir: { type: 'string' }
  },
  required: [
    'name', 'intent', 'whenToUse', 'scope', 'path', 'script', 'scriptChars', 'truncated',
    'tags', 'inputs', 'phases', 'lastRunId', 'lastRunStatus', 'lastRunAt', 'runDir'
  ]
};

const SAVE_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    scope: { type: 'string' },
    capsulePath: { type: 'string' },
    scriptPath: { type: 'string' },
    bytes: { type: 'integer' },
    overwritten: { type: 'boolean' },
    note: { type: 'string' }
  },
  required: ['name', 'scope', 'capsulePath', 'scriptPath', 'bytes', 'overwritten', 'note']
};

const RUN_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: { type: 'string', enum: ['foreground', 'background'] },
    runId: { type: 'string' },
    name: { type: 'string' },
    jobId: { type: 'string' },
    agentsStarted: { type: 'integer' },
    stopReason: { type: 'string' },
    resultText: { type: 'string' },
    resultPath: { type: 'string' },
    runDir: { type: 'string' }
  },
  required: ['kind', 'runId', 'name', 'jobId', 'agentsStarted', 'stopReason', 'resultText', 'resultPath', 'runDir']
};

export function createWorkflowTools({ ctx, config, registry, runs, tracker, resolveCwd, log = () => {} }) {
  // Which cordis resolution path finds each optional harness service. Exposed
  // through workflow_list so a missing runtime is diagnosable without logs.
  const runtimeOf = () => ({
    engine: resolveService(ctx, 'workflowEngine').via,
    jobs: resolveService(ctx, 'jobs').via,
    sessions: resolveService(ctx, 'sessions').via,
    commands: resolveService(ctx, 'commands').via,
    diag: diagOf()
  });

  // Where this plugin's cordis context sits relative to the harness services.
  // Nothing here is required for execution; it only explains a missing engine.
  const diagOf = () => {
    const parts = [];
    try {
      const props = Object.keys(ctx.reflect?.props ?? {});
      const watch = ['tools', 'jobs', 'sessions', 'commands', 'workflowEngine', 'agents', 'llm', 'subagents', 'loader', 'profileContext'];
      parts.push(`declared(${props.length})=${watch.filter((name) => props.includes(name)).join(',')}`);
      const interesting = props.filter((name) => /workflow|engine|subagent|agent|llm|ptc/i.test(name)).sort();
      if (interesting.length > 0) parts.push(`runtimeServices=${interesting.join(',')}`);
    } catch (error) {
      parts.push(`declared=error:${error?.message ?? String(error)}`);
    }
    try {
      parts.push(`root=${ctx.root === ctx}`);
    } catch {
      parts.push('root=?');
    }
    try {
      parts.push(`fiberState=${ctx.fiber?.state ?? '?'}`);
    } catch {
      parts.push('fiberState=?');
    }
    return parts.join(' | ');
  };

  const listTool = {
    name: 'workflow_list',
    description:
      'List reusable workflow capsules (dsh.workflow v1) visible from this workspace, plus recent durable run records. Capsules are searched in builtin, project (<cwd>/.dsh/workflows) and personal ($DSH_HOME/workflows) scopes; later scopes shadow earlier ones by name. Call this before workflow_run when you do not already know the exact capsule name and its declared inputs.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        runs: { type: 'boolean', description: 'Include recent run records. Defaults to true.' },
        limit: { type: 'integer', description: 'Maximum run records to list. Defaults to 10.' }
      }
    },
    output: {
      schema: LIST_OUTPUT,
      render(request, value) {
        const lines = [];
        lines.push(
          value.workflows.length === 0
            ? 'No workflow capsules found.'
            : `Workflow capsules (${value.workflows.length})${value.cwd === '' ? '' : ` for ${value.cwd}`}:`
        );
        for (const workflow of value.workflows) {
          lines.push(`  • ${workflow.name} [${workflow.scope}] — ${workflow.intent}`);
          lines.push(`      inputs: ${workflow.inputs}`);
          if (workflow.whenToUse !== '') lines.push(`      when: ${workflow.whenToUse}`);
          if (workflow.alsoIn !== '') lines.push(`      also defined in: ${workflow.alsoIn}`);
          if (workflow.warnings !== '') lines.push(`      warning: ${workflow.warnings}`);
        }

        if (value.problems.length > 0) {
          lines.push('', `Invalid capsules (${value.problems.length}):`);
          for (const problem of value.problems) {
            lines.push(`  ! ${problem.scope}:${problem.path} — ${problem.error}`);
          }
        }

        if (value.runs.length > 0) {
          lines.push('', `Recent runs (${value.runs.length}):`);
          for (const run of value.runs) {
            lines.push(`  ${run.id}  ${run.status}  ${run.name}  agents=${run.agentsStarted}  ${run.startedAt}`);
          }
        }

        if (value.dirs.length > 0) {
          lines.push(
            '',
            `Search dirs: ${value.dirs.map((entry) => `${entry.scope}:${entry.dir}${entry.exists ? '' : ' (missing)'}`).join('; ')}`
          );
        }

        const runtime = value.runtime;
        const modes = ['engine', 'jobs', 'sessions', 'commands'].map((key) => `${key}=${runtime[key]}`);
        const unresolved = ['engine', 'jobs', 'sessions', 'commands'].filter((key) => runtime[key] === 'missing');
        lines.push(
          '',
          `Runtime: ${modes.join(' ')}` + (unresolved.length === 0 ? '' : `  (unresolved: ${unresolved.join(', ')})`)
        );
        if (runtime.diag !== '') lines.push(`Context: ${runtime.diag}`);
        return TEXT(lines.join('\n'));
      }
    },
    async execute(args = {}, exec) {
      const cwd = resolveCwd(exec?.agent);
      const listing = await registry.list(cwd);
      const includeRuns = args.runs !== false;
      const limit = Number.isFinite(args.limit) ? Math.max(0, Math.floor(args.limit)) : 10;
      const records = includeRuns ? await runs.list(cwd, limit) : [];

      return {
        cwd: cwd ?? '',
        workflows: listing.workflows.map((workflow) => ({
          name: workflow.name,
          intent: workflow.intent,
          whenToUse: workflow.whenToUse,
          inputs: describeInputs(workflow.inputs),
          scope: workflow.scope,
          path: workflow.path,
          alsoIn: workflow.alsoIn,
          warnings: Array.isArray(workflow.capsule.warnings) ? workflow.capsule.warnings.join(' ') : ''
        })),
        problems: listing.problems.map((problem) => ({
          name: problem.name,
          scope: problem.scope,
          path: problem.path,
          error: problem.error
        })),
        runs: records.map((record) => ({
          id: String(record.id ?? ''),
          name: String(record.name ?? ''),
          status: String(record.status ?? ''),
          startedAt: String(record.startedAt ?? ''),
          agentsStarted: Number.isFinite(Number(record.agentsStarted)) ? Math.floor(Number(record.agentsStarted)) : 0,
          dir: String(record.dir ?? '')
        })),
        dirs: listing.dirs.map((entry) => ({ scope: entry.scope, dir: entry.dir, exists: entry.exists === true })),
        runtime: runtimeOf()
      };
    }
  };

  const showTool = {
    name: 'workflow_show',
    description:
      'Show one workflow capsule by name: intent, declared inputs and defaults, phases, source path, the JavaScript body it runs, and its most recent run record. Use this to check a capsule contract before workflow_run, or to review a workflow before editing it.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', description: 'Capsule name, as returned by workflow_list.' },
        include_script: { type: 'boolean', description: 'Include the script body. Defaults to true.' }
      },
      required: ['name']
    },
    output: {
      schema: SHOW_OUTPUT,
      render(request, value) {
        const lines = [`${value.name} [${value.scope}]`, `  intent: ${value.intent}`];
        if (value.whenToUse !== '') lines.push(`  when: ${value.whenToUse}`);
        if (value.tags.length > 0) lines.push(`  tags: ${value.tags.join(', ')}`);
        lines.push(`  capsule: ${value.path}`);
        lines.push(`  inputs: ${describeInputs(value.inputs.map((input) => ({
          name: input.name,
          type: input.type,
          required: input.required,
          default: input.defaultText === '' ? undefined : safeParse(input.defaultText)
        })))}`);
        if (value.phases.length > 0) {
          lines.push(`  phases: ${value.phases.map((phase) => phase.title).join(' → ')}`);
        }
        if (value.lastRunId !== '') {
          lines.push(`  last run: ${value.lastRunId} ${value.lastRunStatus} ${value.lastRunAt}`);
        }
        if (value.script !== '') {
          lines.push('', value.truncated ? `script (${value.scriptChars} chars, truncated):` : `script (${value.scriptChars} chars):`);
          lines.push(value.script);
        }
        return TEXT(lines.join('\n'));
      }
    },
    async execute(args = {}, exec) {
      const name = String(args.name ?? '').trim();
      if (name === '') throw new Error('workflow_show needs a capsule name');

      const cwd = resolveCwd(exec?.agent);
      const capsule = await registry.load(name, cwd);
      const input = capsule.script ?? '';
      const maxChars = config.maxScriptChars;
      const includeScript = args.include_script !== false;
      const record = await runs.lastRun(cwd, capsule.name);

      return {
        name: capsule.name,
        intent: capsule.intent,
        whenToUse: capsule.whenToUse ?? '',
        scope: capsule.scope ?? '',
        path: capsule.sourcePath ?? '',
        script: includeScript ? clip(input, maxChars) : '',
        scriptChars: input.length,
        truncated: includeScript && input.length > maxChars,
        tags: Array.isArray(capsule.tags) ? capsule.tags : [],
        inputs: capsule.inputs.map((entry) => ({
          name: entry.name,
          type: entry.type,
          required: entry.required === true,
          description: entry.description ?? '',
          defaultText: entry.default === undefined ? '' : stringifyJson(entry.default, 0)
        })),
        phases: capsule.phases.map((phase) => ({ title: phase.title, detail: phase.detail ?? '' })),
        lastRunId: String(record?.id ?? ''),
        lastRunStatus: String(record?.status ?? ''),
        lastRunAt: String(record?.startedAt ?? ''),
        runDir: String(record?.dir ?? '')
      };
    }
  };

  const saveTool = {
    name: 'workflow_save',
    description:
      'Save a reusable workflow capsule (dsh.workflow v1) so it can be listed and run by name later. Provide a one-line intent, the declared inputs, and a JavaScript body that uses the native workflow engine hooks (args, agent, parallel, pipeline, phase, log) and ends with `return <value>`. The body runs in the harness workflow engine, not in Node: no imports, no filesystem, no timers. Writes <name>.workflow.json (manifest) plus <name>.workflow.js (body) into the project or personal scope.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', description: 'Kebab-case capsule name, unique within its scope.' },
        intent: { type: 'string', description: 'One line describing what the workflow achieves.' },
        script: {
          type: 'string',
          description: 'Plain JavaScript function body using the workflow hooks; must end with `return <value>`.'
        },
        whenToUse: { type: 'string', description: 'Optional routing hint: when should the model pick this workflow?' },
        inputs: { type: 'array', items: INPUT_ITEM, description: 'Declared inputs (name, type, required, description).' },
        defaults: {
          type: 'object',
          additionalProperties: true,
          description: 'Optional default value per input name, e.g. {"depth": 3}.'
        },
        phases: { type: 'array', items: PHASE_ITEM, description: 'Optional phase titles so the run shows progress.' },
        tags: { type: 'array', items: { type: 'string' } },
        scope: {
          type: 'string',
          enum: ['auto', 'project', 'personal'],
          description: 'Where to write the capsule. auto = project when the session has a workspace, else personal.'
        },
        overwrite: { type: 'boolean', description: 'Replace an existing capsule with the same name. Defaults to false.' }
      },
      required: ['name', 'intent', 'script']
    },
    output: {
      schema: SAVE_OUTPUT,
      render(request, value) {
        const lines = [
          `Saved workflow ${value.name} (${value.scope} scope, ${value.bytes} bytes).`,
          `  capsule: ${value.capsulePath}`,
          `  script:  ${value.scriptPath}`
        ];
        if (value.note !== '') lines.push(`  note: ${value.note}`);
        return TEXT(lines.join('\n'));
      }
    },
    async execute(args = {}, exec) {
      const name = String(args.name ?? '').trim();
      if (name === '') throw new Error('workflow_save needs a capsule name');
      const intent = String(args.intent ?? '').trim();
      if (intent === '') throw new Error('workflow_save needs a one-line intent');
      const script = typeof args.script === 'string' ? args.script : '';
      if (script.trim() === '') throw new Error('workflow_save needs a script body');

      const cwd = resolveCwd(exec?.agent);
      const requested = String(args.scope ?? 'auto');
      const scope = requested === 'personal' ? 'personal' : requested === 'project' ? 'project' : cwd ? 'project' : 'personal';

      const declared = Array.isArray(args.inputs) ? args.inputs : [];
      const defaults = isPlainObject(args.defaults) ? args.defaults : {};
      const inputs = declared.map((entry) => {
        if (!isPlainObject(entry)) return entry;
        const input = { ...entry };
        if (input.default === undefined && Object.prototype.hasOwnProperty.call(defaults, input.name)) {
          input.default = defaults[input.name];
        }
        return input;
      });
      for (const [key, value] of Object.entries(defaults)) {
        if (!inputs.some((entry) => isPlainObject(entry) && entry.name === key)) {
          log(`workflow-kit: default for "${key}" ignored because no input declares it`);
        }
      }

      const raw = {
        name,
        intent,
        whenToUse: args.whenToUse,
        inputs,
        phases: args.phases,
        tags: args.tags,
        script
      };
      const normalized = normalizeCapsule(raw, { scope, path: `${name}.workflow.json` });
      if (normalized.errors.length > 0) {
        throw new Error(`workflow_save rejected the capsule:\n- ${normalized.errors.join('\n- ')}`);
      }

      const capsule = normalized.capsule;
      const overwrite = args.overwrite === true;
      const saved = await registry.save(capsule, { scope, cwd, overwrite });

      let note = normalized.warnings.join(' ');
      const listing = await registry.list(cwd).catch(() => ({ workflows: [] }));
      const winner = (listing.workflows ?? []).find((entry) => entry.name === capsule.name);
      if (winner && winner.path !== saved.capsulePath) {
        note = [note, `another scope already defines "${capsule.name}" (${winner.path}); that definition wins at run time`]
          .filter(Boolean)
          .join(' ');
      }

      return {
        name: capsule.name,
        scope,
        capsulePath: saved.capsulePath,
        scriptPath: saved.scriptPath,
        bytes: Buffer.byteLength(capsule.script, 'utf8'),
        overwritten: overwrite,
        note
      };
    }
  };

  const runTool = {
    name: 'workflow_run',
    description:
      'Run a saved workflow capsule by name through the harness workflow engine, streaming phases and agents, and persist a durable run record under <cwd>/.dsh/workflow-runs/<runId>/ (run.json, events.jsonl, the exact capsule that ran, result.json). Declared inputs are type-checked and defaults filled. Use run_in_background for long fan-outs. Prefer this over the inline `workflow` tool when the workflow should be reusable, reviewed, or re-run with different args.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', description: 'Capsule name, as returned by workflow_list.' },
        args: {
          type: 'object',
          additionalProperties: true,
          description: 'Input values for the capsule, keyed by declared input name.'
        },
        run_in_background: {
          type: 'boolean',
          description: 'Run as a background job and return immediately. Defaults to false.'
        }
      },
      required: ['name']
    },
    output: {
      schema: RUN_OUTPUT,
      render(request, value) {
        if (value.kind === 'background') {
          return TEXT(
            `Workflow ${value.name} started in the background.\n  job:  ${value.jobId}\n  run:  ${value.runId}\n  dir:  ${value.runDir}`
          );
        }
        const lines = [
          `Workflow ${value.name} ${value.stopReason === 'completed' ? 'completed' : value.stopReason} — ${value.agentsStarted} agent(s).`,
          value.runDir === '' ? '' : `  run dir: ${value.runDir}`,
          value.resultPath === '' ? '' : `  result:  ${value.resultPath}`,
          '',
          value.resultText
        ].filter((line) => line !== '');
        return TEXT(lines.join('\n'));
      }
    },
    async execute(args = {}, exec) {
      const name = String(args.name ?? '').trim();
      if (name === '') throw new Error('workflow_run needs a capsule name');

      const engine = serviceOf(ctx, 'workflowEngine');
      if (!engine || typeof engine.start !== 'function') {
        throw new Error(
          'the native workflow engine is not available in this profile (service "workflowEngine"); enable the workflow runtime bundle (@deepseek-ai/dsh-tool-workflow + @deepseek-ai/dsh-workflow-ptc)'
        );
      }

      const cwd = resolveCwd(exec?.agent);
      const capsule = await registry.load(name, cwd);
      const prepared = applyInputs(capsule, args.args);
      if (!prepared.ok) {
        throw new Error(`invalid args for workflow "${capsule.name}":\n- ${prepared.errors.join('\n- ')}`);
      }

      const meta = toWorkflowMeta(capsule);
      const parent = exec?.agent;
      const background = args.run_in_background === true && config.enableRunInBackground;

      if (background) {
        const jobs = serviceOf(ctx, 'jobs');
        if (!jobs || typeof jobs.start !== 'function') {
          throw new Error('background runs need the harness jobs service, which is not available; retry with run_in_background=false');
        }

        let run;
        const jobId = jobs.start({
          kind: 'workflow',
          label: `workflow: ${capsule.name}`,
          owner: parent?.id,
          toolCall: { callId: exec.callId, rootCallId: exec.rootCallId ?? exec.callId },
          run: (job) => {
            run = engine.start({ script: capsule.script, meta, args: prepared.args, parent });

            const recording = tracker
              .begin({ runId: run.id, name: capsule.name, capsule, args: prepared.args, cwd })
              .then((record) => {
                tracker.attachJob(run.id, job);
                job.append(`run ${run.id} → ${record.dir}`, { channel: 'log' });
                return record;
              })
              .catch((error) => {
                log(`workflow-kit: cannot record run ${run.id}: ${errorMessage(error)}`);
                return undefined;
              });

            return {
              cancel(reason) {
                try {
                  run.cancel(typeof reason === 'string' && reason !== '' ? reason : 'cancelled from job');
                } catch (error) {
                  log(`workflow-kit: cancel failed for run ${run.id}: ${errorMessage(error)}`);
                }
              },
              done: run.result.then(async (result) => {
                try {
                  await run.dispose();
                } catch (error) {
                  log(`workflow-kit: dispose failed for run ${run.id}: ${errorMessage(error)}`);
                }
                await recording;
                await tracker.finish(run.id, result);
                const status =
                  result.stopReason === 'completed' ? 'completed' : result.stopReason === 'cancelled' ? 'killed' : 'failed';
                return {
                  status,
                  detail: clip(stringifyJson(result.value, 0), 2000),
                  result: `run ${run.id} ${result.stopReason} (${result.agentsStarted} agent(s))`
                };
              })
            };
          }
        });

        const backgroundRunId = String(run?.id ?? '');
        const backgroundDir = backgroundRunId === '' ? '' : join(runs.rootDir(cwd), backgroundRunId);

        return {
          kind: 'background',
          runId: backgroundRunId,
          name: capsule.name,
          jobId: String(jobId ?? ''),
          agentsStarted: 0,
          stopReason: '',
          resultText: '',
          resultPath: backgroundDir === '' ? '' : join(backgroundDir, 'result.json'),
          runDir: backgroundDir
        };
      }

      const run = engine.start({
        script: capsule.script,
        meta,
        args: prepared.args,
        parent,
        signal: exec?.signal
      });
      const record = await tracker.begin({
        runId: run.id,
        name: capsule.name,
        capsule,
        args: prepared.args,
        cwd
      });

      let result;
      try {
        result = await run.result;
      } finally {
        try {
          await run.dispose();
        } catch (error) {
          log(`workflow-kit: dispose failed for run ${run.id}: ${errorMessage(error)}`);
        }
        if (result === undefined) {
          result = { stopReason: 'error', error: 'run settled without a result', agentsStarted: 0, value: undefined };
        }
        await tracker.finish(run.id, result);
      }

      if (result.stopReason !== 'completed') {
        const reason =
          result.stopReason === 'cancelled'
            ? `workflow run ${run.id} was cancelled`
            : `workflow run ${run.id} failed: ${result.error ?? 'unknown error'}`;
        throw new Error(reason);
      }

      return {
        kind: 'foreground',
        runId: String(run.id),
        name: capsule.name,
        jobId: '',
        agentsStarted: Number.isFinite(Number(result.agentsStarted)) ? Math.floor(Number(result.agentsStarted)) : 0,
        stopReason: String(result.stopReason),
        resultText: clip(stringifyJson(result.value ?? null), config.maxResultChars),
        resultPath: join(record.dir, 'result.json'),
        runDir: record.dir
      };
    }
  };

  return { listTool, showTool, saveTool, runTool, all: [listTool, showTool, saveTool, runTool] };
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}