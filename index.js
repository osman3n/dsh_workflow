/**
 * Workflow Kit — reusable `dsh.workflow` v1 capsules for DeepSeek Harness.
 *
 * This plugin does not replace the native workflow runtime. It adds the layer
 * above it that makes workflows a library instead of a one-shot script:
 *
 *   • versioned capsules (manifest + JavaScript body) on disk
 *   • a registry with builtin → project → personal search order
 *   • durable run records: run.json, events.jsonl, provenance, result.json
 *   • four model tools: workflow_list / workflow_show / workflow_save / workflow_run
 *   • a read-only /workflows command for the human side
 *
 * Execution itself always goes through `ctx.workflowEngine` (service provided
 * by @deepseek-ai/dsh-workflow-ptc through @deepseek-ai/dsh-tool-workflow), so
 * sandboxing, concurrency limits and cancellation stay native.
 */

import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createWorkflowPanelService, PANEL_MANIFEST } from './lib/panel.js';
import { Registry } from './lib/registry.js';
import { RunStore } from './lib/runs.js';
import { createRunTracker } from './lib/tracker.js';
import { createWorkflowTools } from './lib/tools.js';
import { describeInputs, serviceOf } from './lib/spec.js';

export const name = 'workflow-kit';
export const inject = ['tools'];

const BUILTIN_DIR = fileURLToPath(new URL('./workflows/', import.meta.url));

const DEFAULTS = Object.freeze({
  runHistoryLimit: 25,
  maxResultChars: 40000,
  maxScriptChars: 20000,
  maxEventsPerRun: 5000,
  enableRunInBackground: true,
  commandName: 'workflows',
  commandEnabled: true,
  extraDirs: [],
  builtinsDir: BUILTIN_DIR
});

const HELP = [
  'Workflow Kit — reusable dsh.workflow v1 capsules',
  '',
  '  /workflows list              capsules visible from this workspace',
  '  /workflows show <name>       contract, inputs and paths of one capsule',
  '  /workflows runs [n]          recent durable run records (default 10)',
  '  /workflows dirs              search directories and whether they exist',
  '  /workflows prune [keep]      delete old run records (default from config)',
  '  /workflows help              this text',
  '',
  'Search order: builtin → project (<cwd>/.dsh/workflows) → personal ($DSH_HOME/workflows).',
  'Runs are recorded under <cwd>/.dsh/workflow-runs/<runId>/.',
  'Run a capsule through the workflow_run tool (or ask the model to run it).'
].join('\n');

export function apply(ctx, config) {
  const settings = normalizeConfig(config);
  const homeDir = resolveHome();
  const log = createLog(ctx);

  const registry = new Registry({
    builtinsDir: settings.builtinsDir,
    homeDir,
    extraDirs: settings.extraDirs,
    log
  });
  const runs = new RunStore({ homeDir, limit: settings.runHistoryLimit, log });
  const tracker = createRunTracker({ ctx, runs, log, maxEventsPerRun: settings.maxEventsPerRun });
  const resolveCwd = (agent) => resolveSessionCwd(ctx, agent);
  const tools = createWorkflowTools({ ctx, config: settings, registry, runs, tracker, resolveCwd, log });

  for (const definition of tools.all) {
    ctx.tools.register(definition);
  }

  if (typeof ctx.effect === 'function') {
    ctx.effect(() => () => tracker.dispose());
  }

  if (settings.commandEnabled) {
    registerCommand(ctx, { settings, registry, runs, resolveCwd, log });
  }

  installPanel(ctx, { registry, log });
}

/**
 * The client panel reaches this service through the Typert gateway
 * (`ctx.remote.workflows`), which resolves the service from the Host root
 * Context. `ctx.provide` therefore has to run on the plugin Context itself:
 * a service donated inside `ctx.inject`'s child Context stays scoped to the
 * plugin and is invisible to the gateway. `typert` is optional in headless
 * profiles, so only the manifest registration waits for it.
 */
function installPanel(ctx, { registry, log }) {
  const resolveCwd = () => {
    try {
      const sessions = serviceOf(ctx, 'sessions');
      const live = sessions && typeof sessions.list === 'function' ? sessions.list() : [];
      for (let index = live.length - 1; index >= 0; index -= 1) {
        const cwd = candidatePath(live[index]?.header?.cwd);
        if (cwd !== undefined) return cwd;
      }
    } catch {
      // Sessions may be unavailable in headless profiles.
    }
    return undefined;
  };

  const service = createWorkflowPanelService({ registry, log, resolveCwd });
  try {
    ctx.provide('workflows', service);
  } catch (error) {
    log(
      `workflow-kit: cannot provide the workflow panel service: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }

  const registerManifest = (typertCtx) => {
    try {
      const typert = typertCtx.typert ?? (typeof typertCtx.get === 'function' ? typertCtx.get('typert') : undefined);
      if (typert === undefined) return;
      // The Typert registry is application-global and outlives one plugin
      // instance; a reload after editing must not re-register the same face.
      if (typeof typert.getPackage === 'function' && typert.getPackage(PANEL_MANIFEST.package, 'host')) return;
      typert.register(PANEL_MANIFEST);
    } catch (error) {
      log(
        `workflow-kit: cannot register the workflow panel manifest: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  if (typeof ctx.inject !== 'function') {
    log('workflow-kit: ctx.inject is unavailable; the workflow panel stays offline');
    return;
  }
  try {
    ctx.inject(['typert'], registerManifest);
  } catch (error) {
    log(`workflow-kit: cannot install the workflow panel: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function normalizeConfig(config) {
  const merged = { ...DEFAULTS };
  if (config && typeof config === 'object') {
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined && value !== null) merged[key] = value;
    }
  }

  for (const key of ['runHistoryLimit', 'maxResultChars', 'maxScriptChars', 'maxEventsPerRun']) {
    const value = Number(merged[key]);
    merged[key] = Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULTS[key];
  }

  merged.enableRunInBackground = merged.enableRunInBackground !== false;
  merged.commandEnabled = merged.commandEnabled !== false;
  merged.commandName =
    typeof merged.commandName === 'string' && merged.commandName.trim() !== ''
      ? merged.commandName.trim().replace(/^\/+/, '')
      : DEFAULTS.commandName;
  merged.extraDirs = Array.isArray(merged.extraDirs)
    ? merged.extraDirs.filter((entry) => typeof entry === 'string' && entry.trim() !== '')
    : [];
  merged.builtinsDir =
    typeof merged.builtinsDir === 'string' && merged.builtinsDir.trim() !== ''
      ? merged.builtinsDir.trim()
      : BUILTIN_DIR;

  return merged;
}

function resolveHome() {
  const configured = process.env.DSH_HOME;
  if (typeof configured === 'string' && configured.trim() !== '') return configured.trim();
  return join(homedir(), '.dsh');
}

function createLog(ctx) {
  return (message) => {
    const text = String(message ?? '');
    if (text === '') return;
    try {
      const logger = ctx.logger;
      if (logger && typeof logger.info === 'function') {
        logger.info(text);
        return;
      }
    } catch {
      // Fall through to the console.
    }
    try {
      console.warn(text);
    } catch {
      // Logging must never break the plugin.
    }
  };
}

function resolveSessionCwd(ctx, agent) {
  const direct = candidatePath(agent?.session?.header?.cwd) ?? candidatePath(agent?.header?.cwd);
  if (direct !== undefined) return direct;

  try {
    const sessions = serviceOf(ctx, 'sessions');
    const session = sessions && typeof sessions.get === 'function' ? sessions.get(agent?.id) : undefined;
    const fromSession = candidatePath(session?.header?.cwd);
    if (fromSession !== undefined) return fromSession;
  } catch {
    // Sessions may be unavailable in headless profiles.
  }
  return undefined;
}

function candidatePath(value) {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text !== '' && isAbsolute(text) ? text : undefined;
}

function registerCommand(ctx, { settings, registry, runs, resolveCwd, log }) {
  let commands;
  try {
    commands = serviceOf(ctx, 'commands');
  } catch {
    commands = undefined;
  }
  if (!commands || typeof commands.register !== 'function') {
    log('workflow-kit: the commands service is unavailable; /workflows was not registered');
    return;
  }

  const ok = (text) => ({ kind: 'success', text });
  const fail = (text) => ({ kind: 'error', text });

  try {
    commands.register({
      name: settings.commandName,
      description: 'List, inspect and prune reusable workflow capsules (dsh.workflow v1).',
      input: { hint: '[list | show <name> | runs [n] | dirs | prune [keep] | help]' },
      async handler(invocation) {
        const cwd = resolveCwd(invocation?.agent);
        const words = String(invocation?.rawInput ?? '')
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        const verb = (words[0] ?? 'list').toLowerCase();
        const rest = words.slice(1);

        try {
          switch (verb) {
            case 'list':
            case 'ls':
              return ok(await renderList(registry, runs, cwd));
            case 'show':
              return await renderShow(registry, runs, cwd, rest[0]);
            case 'runs':
              return ok(await renderRuns(runs, cwd, rest[0]));
            case 'dirs':
              return ok(renderDirs(registry, cwd));
            case 'prune':
              return ok(await renderPrune(runs, cwd, rest[0], settings.runHistoryLimit));
            case 'help':
            case '?':
              return ok(HELP);
            default:
              return fail(`unknown subcommand "${verb}"\n\n${HELP}`);
          }
        } catch (error) {
          return fail(error instanceof Error ? error.message : String(error));
        }
      }
    });
  } catch (error) {
    log(`workflow-kit: cannot register /${settings.commandName}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function renderList(registry, runs, cwd) {
  const listing = await registry.list(cwd);
  const lines = [];

  lines.push(cwd === undefined ? 'Workflow capsules (no workspace):' : `Workflow capsules for ${cwd}:`);
  if (listing.workflows.length === 0) {
    lines.push('  (none — save one with the workflow_save tool)');
  }
  for (const workflow of listing.workflows) {
    lines.push(`  • ${workflow.name}  [${workflow.scope}]  ${workflow.intent}`);
    lines.push(`      inputs: ${describeInputs(workflow.inputs)}`);
    if (workflow.alsoIn !== '') lines.push(`      shadowing: ${workflow.alsoIn}`);
  }

  for (const problem of listing.problems) {
    lines.push(`  ! invalid: ${problem.path} — ${problem.error}`);
  }

  const recent = await runs.list(cwd, 5);
  if (recent.length > 0) {
    lines.push('', 'Recent runs:');
    for (const record of recent) {
      lines.push(`  ${record.id}  ${record.status}  ${record.name}  agents=${record.agentsStarted ?? 0}`);
    }
  }
  return lines.join('\n');
}

async function renderShow(registry, runs, cwd, name) {
  const wanted = String(name ?? '').trim();
  if (wanted === '') return { kind: 'error', text: `usage: /workflows show <name>\n\n${HELP}` };

  let capsule;
  try {
    capsule = await registry.load(wanted, cwd);
  } catch (error) {
    return { kind: 'error', text: error instanceof Error ? error.message : String(error) };
  }

  const lines = [
    `${capsule.name}  [${capsule.scope}]`,
    `  intent: ${capsule.intent}`,
    capsule.whenToUse === '' ? undefined : `  when:   ${capsule.whenToUse}`,
    `  inputs: ${describeInputs(capsule.inputs)}`,
    `  capsule: ${capsule.sourcePath}`
  ].filter(Boolean);

  for (const phase of capsule.phases) {
    lines.push(`  phase:  ${phase.title}${phase.detail === '' ? '' : ` — ${phase.detail}`}`);
  }
  if (capsule.tags.length > 0) lines.push(`  tags:   ${capsule.tags.join(', ')}`);
  for (const warning of capsule.warnings ?? []) lines.push(`  warning: ${warning}`);

  const record = await runs.lastRun(cwd, capsule.name);
  if (record) lines.push(`  last run: ${record.id} ${record.status} ${record.startedAt} (${record.dir})`);

  return { kind: 'success', text: lines.join('\n') };
}

async function renderRuns(runs, cwd, countText) {
  const requested = Number.parseInt(String(countText ?? ''), 10);
  const limit = Number.isFinite(requested) && requested > 0 ? requested : 10;
  const records = await runs.list(cwd, limit);
  if (records.length === 0) return 'No run records yet.';
  const lines = [`Run records (${records.length}):`];
  for (const record of records) {
    lines.push(`  ${record.id}  ${record.status}  ${record.name}  agents=${record.agentsStarted ?? 0}  ${record.startedAt ?? ''}`);
    lines.push(`      ${record.dir}`);
  }
  return lines.join('\n');
}

function renderDirs(registry, cwd) {
  const dirs = registry.resolveDirs(cwd);
  const lines = ['Workflow search directories (low to high priority):'];
  for (const entry of dirs) {
    lines.push(`  ${entry.scope.padEnd(8)} ${entry.exists ? 'ok     ' : 'missing'} ${entry.dir}`);
  }
  return lines.join('\n');
}

async function renderPrune(runs, cwd, keepText, fallback) {
  const requested = Number.parseInt(String(keepText ?? ''), 10);
  const keep = Number.isFinite(requested) && requested > 0 ? requested : fallback;
  const removed = await runs.prune(cwd, keep);
  if (removed.length === 0) return `Nothing to prune; keeping the newest ${keep} run record(s).`;
  return [`Pruned ${removed.length} run record(s); keeping the newest ${keep}.`, ...removed.map((dir) => `  - ${dir}`)].join(
    '\n'
  );
}