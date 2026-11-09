/**
 * Host side of the workflow-kit panel.
 *
 * A plain service object exposed through the Typert gateway so the client
 * panel can list capsules and save a new one without going through the model.
 * The manifest mirrors the descriptors the client mounts with
 * `ctx.remote.$mount(...)`; both sides must agree exactly.
 */

import { normalizeCapsule } from './spec.js';

export const PACKAGE_NAME = '@osman3n/dsh-workflow-kit';

const identity = (value) => value;
const strictSchema = { parse: identity };
const codec = (typeSymbol) => ({ mode: 'strict', typeSymbol, create: () => strictSchema });

const listPayload = { name: 'payload', wire: 'payload', source: 'json', acceptsUndefined: true, codec: codec(`${PACKAGE_NAME}#workflows/list/payload`) };
const saveRequest = { name: 'request', wire: 'request', source: 'json', acceptsUndefined: true, codec: codec(`${PACKAGE_NAME}#workflows/save/request`) };

export const PANEL_INVOCATIONS = Object.freeze([
  {
    id: `${PACKAGE_NAME}#workflows/list`,
    service: 'workflows',
    namespace: 'workflows',
    method: 'list',
    invocation: { kind: 'direct' },
    parameters: [listPayload],
    result: codec(`${PACKAGE_NAME}#workflows/list/result`)
  },
  {
    id: `${PACKAGE_NAME}#workflows/save`,
    service: 'workflows',
    namespace: 'workflows',
    method: 'save',
    invocation: { kind: 'direct' },
    parameters: [saveRequest],
    result: codec(`${PACKAGE_NAME}#workflows/save/result`)
  }
]);

export const PANEL_MANIFEST = Object.freeze({
  package: PACKAGE_NAME,
  face: 'host',
  schemas: [],
  invocations: PANEL_INVOCATIONS,
  model: { services: [], events: [], objects: [] }
});

/** Trim, then require a non-empty string. */
function requiredText(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '') throw new Error(`${label} is required.`);
  return text;
}

/** A panel-scoped service; capsules saved here always live in the personal scope. */
export class WorkflowPanelService {
  #registry;
  #log;
  #resolveCwd;

  constructor({ registry, log = () => {}, resolveCwd = () => undefined }) {
    this.#registry = registry;
    this.#log = log;
    this.#resolveCwd = resolveCwd;
    this.typertRemote = Object.freeze({ service: this, serviceKey: 'workflows', namespace: 'workflows' });
  }

  /** Everything the review page renders: capsules, broken files and search dirs. */
  async list(payload = {}) {
    const requested = typeof payload?.cwd === 'string' ? payload.cwd.trim() : '';
    const fallback = requested === '' ? this.#resolveCwd() : undefined;
    const cwd = requested !== '' ? requested : typeof fallback === 'string' && fallback !== '' ? fallback : undefined;
    const listing = await this.#registry.list(cwd);
    return {
      cwd: cwd ?? '',
      dirs: listing.dirs.map((entry) => ({ scope: entry.scope, dir: entry.dir, exists: entry.exists === true })),
      problems: listing.problems.map((problem) => ({
        name: problem.name,
        scope: problem.scope,
        path: problem.path,
        error: problem.error
      })),
      workflows: listing.workflows.map((workflow) => ({
        name: workflow.name,
        intent: workflow.intent,
        whenToUse: workflow.whenToUse ?? '',
        inputs: Array.isArray(workflow.inputs) ? workflow.inputs : [],
        phases: Array.isArray(workflow.phases) ? workflow.phases : [],
        tags: Array.isArray(workflow.tags) ? workflow.tags : [],
        scope: workflow.scope,
        path: workflow.path,
        alsoIn: workflow.alsoIn ?? ''
      }))
    };
  }

  /** Validate and persist one capsule authored in the panel. */
  async save(request = {}) {
    const name = requiredText(request?.name, 'A workflow name');
    const intent = requiredText(request?.intent, 'A one-line intent');
    const script = typeof request?.script === 'string' ? request.script : '';
    if (script.trim() === '') throw new Error('The workflow body is required.');

    const raw = {
      name,
      intent,
      whenToUse: typeof request?.whenToUse === 'string' ? request.whenToUse : '',
      inputs: Array.isArray(request?.inputs) ? request.inputs : [],
      phases: [],
      tags: [],
      script
    };

    const normalized = normalizeCapsule(raw, { scope: 'personal', path: `${name}.workflow.json` });
    if (normalized.errors.length > 0) {
      throw new Error(`The capsule was rejected:\n- ${normalized.errors.join('\n- ')}`);
    }

    const overwrite = request?.overwrite === true;
    const saved = await this.#registry.save(normalized.capsule, { scope: 'personal', overwrite });
    this.#log(`workflow-kit: panel saved ${normalized.capsule.name} to ${saved.capsulePath}`);

    return {
      name: normalized.capsule.name,
      scope: 'personal',
      capsulePath: saved.capsulePath,
      scriptPath: saved.scriptPath,
      bytes: Buffer.byteLength(normalized.capsule.script, 'utf8'),
      overwritten: overwrite,
      warnings: normalized.warnings
    };
  }
}

export function createWorkflowPanelService({ registry, log, resolveCwd }) {
  return new WorkflowPanelService({ registry, log, resolveCwd });
}
