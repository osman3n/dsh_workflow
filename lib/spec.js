/**
 * `dsh.workflow` v1 capsules.
 *
 * A capsule is a small, versioned JSON manifest plus a plain JavaScript body
 * that the native DeepSeek Harness workflow engine (`workflowEngine`) executes.
 * The capsule only describes the contract around that body:
 *
 *   {
 *     "kind": "dsh.workflow",          // optional, defaults to this value
 *     "version": 1,                    // optional, defaults to 1
 *     "name": "parallel-investigation",
 *     "intent": "one line describing what the workflow achieves",
 *     "whenToUse": "optional routing hint for the model",
 *     "inputs": [{ "name": "question", "type": "string", "required": true }],
 *     "phases": [{ "title": "Investigate", "detail": "..." }],
 *     "tags": ["research"],
 *     "script": "…",                   // inline body, OR
 *     "scriptFile": "./name.workflow.js"
 *   }
 *
 * The body is a function body, not a module: it may use `args`, `agent()`,
 * `parallel()`, `pipeline()`, `phase()` and `log()`, and it must end with
 * `return <value>`.
 */

export const FORMAT_KIND = 'dsh.workflow';
export const FORMAT_VERSION = 1;
export const MAX_SCRIPT_BYTES = 256 * 1024;
export const INPUT_TYPES = Object.freeze(['string', 'number', 'integer', 'boolean', 'array', 'object']);

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const INPUT_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const ESM_STATEMENT = /^[ \t]*(import|export)\s/m;
const RETURN_STATEMENT = /\breturn\b/;

/** True for plain JSON objects (not arrays, not class instances, not null). */
export function isPlainObject(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Error text that survives non-Error throws. */
export function errorMessage(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/** Pretty JSON, safe against undefined and circular values. */
export function stringifyJson(value, space = 2) {
  try {
    const text = JSON.stringify(value === undefined ? null : value, null, space);
    return text === undefined ? 'null' : text;
  } catch (error) {
    return `"<unserializable: ${errorMessage(error)}>"`;
  }
}

/** Clip text to `max` characters, appending a visible truncation note. */
export function clip(text, max) {
  const source = String(text ?? '');
  const limit = Number.isFinite(max) && max > 0 ? Math.floor(max) : 0;
  if (limit === 0 || source.length <= limit) return source;
  return `${source.slice(0, limit)}\n… [truncated: ${source.length - limit} more characters]`;
}

/** Filename/identifier friendly slug. */
export function slugify(value) {
  const slug = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '')
    .slice(0, 64);
  return slug === '' ? 'unnamed-workflow' : slug;
}

/** Base name of a capsule file, without the `.workflow.json` suffix. */
export function capsuleBaseName(file) {
  return String(file ?? '').replace(/\.workflow\.json$/i, '');
}

/** Type check one declared input or default value. */
export function checkValue(value, type) {
  switch (type) {
    case 'string':
      return typeof value === 'string' ? { ok: true, value } : { ok: false, reason: 'must be a string' };
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? { ok: true, value }
        : { ok: false, reason: 'must be a finite number' };
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value)
        ? { ok: true, value }
        : { ok: false, reason: 'must be an integer' };
    case 'boolean':
      return typeof value === 'boolean' ? { ok: true, value } : { ok: false, reason: 'must be a boolean' };
    case 'array':
      return Array.isArray(value) ? { ok: true, value } : { ok: false, reason: 'must be an array' };
    case 'object':
      return isPlainObject(value) ? { ok: true, value } : { ok: false, reason: 'must be a JSON object' };
    default:
      return { ok: false, reason: `has unknown type "${type}"` };
  }
}

/**
 * Validate and normalize a capsule read from disk or authored by a tool call.
 * Returns `{ capsule, errors, warnings }`; `capsule` is only meaningful when
 * `errors` is empty.
 */
export function normalizeCapsule(raw, context = {}) {
  const errors = [];
  const warnings = [];
  const path = typeof context.path === 'string' ? context.path : '';
  const scope = typeof context.scope === 'string' ? context.scope : 'unknown';
  const scriptText = typeof context.scriptText === 'string' ? context.scriptText : undefined;

  if (!isPlainObject(raw)) {
    return { capsule: undefined, errors: ['capsule must be a JSON object'], warnings };
  }

  if (raw.kind !== undefined && raw.kind !== FORMAT_KIND) {
    errors.push(`unsupported kind ${JSON.stringify(raw.kind)}; expected ${JSON.stringify(FORMAT_KIND)}`);
  }
  if (raw.version !== undefined && raw.version !== FORMAT_VERSION) {
    errors.push(`unsupported version ${JSON.stringify(raw.version)}; expected ${FORMAT_VERSION}`);
  }

  const name = asText(raw.name) !== '' ? asText(raw.name) : slugify(capsuleBaseName(path));
  if (!NAME_PATTERN.test(name)) {
    errors.push(
      `name ${JSON.stringify(name)} is not a valid workflow name (letters, digits, ".", "_" or "-"; max 64 characters)`
    );
  }

  const intent = asText(raw.intent) !== '' ? asText(raw.intent) : asText(raw.description);
  if (intent === '') {
    errors.push('intent is required: one line describing what the workflow achieves');
  } else if (intent.length > 400) {
    warnings.push(`intent is ${intent.length} characters; keep it to one line (<= 400)`);
  }

  const whenToUse = asText(raw.whenToUse);
  if (whenToUse.length > 800) warnings.push('whenToUse is very long; keep it to a short routing hint');

  const inputs = [];
  if (raw.inputs !== undefined && raw.inputs !== null) {
    if (!Array.isArray(raw.inputs)) {
      errors.push('inputs must be an array of {name, type, required, default} objects');
    } else {
      for (let index = 0; index < raw.inputs.length; index += 1) {
        const item = raw.inputs[index];
        if (!isPlainObject(item)) {
          errors.push(`inputs[${index}] must be an object`);
          continue;
        }
        const inputName = asText(item.name);
        if (!INPUT_NAME_PATTERN.test(inputName)) {
          errors.push(`inputs[${index}].name ${JSON.stringify(inputName)} is not a valid identifier`);
          continue;
        }
        if (inputs.some((entry) => entry.name === inputName)) {
          errors.push(`inputs[${index}] duplicates the name "${inputName}"`);
          continue;
        }
        const type = asText(item.type) !== '' ? asText(item.type) : 'string';
        if (!INPUT_TYPES.includes(type)) {
          errors.push(`inputs[${index}].type ${JSON.stringify(type)} must be one of ${INPUT_TYPES.join(', ')}`);
          continue;
        }
        const input = {
          name: inputName,
          type,
          required: item.required === true,
          description: asText(item.description)
        };
        if (item.default !== undefined) {
          const check = checkValue(item.default, type);
          if (check.ok) input.default = check.value;
          else errors.push(`inputs[${index}].default ${check.reason}`);
        }
        if (input.required && input.default !== undefined) {
          warnings.push(`input "${inputName}" is required and also has a default; the default wins only when the arg is absent`);
        }
        inputs.push(input);
      }
    }
  }

  const phases = [];
  if (raw.phases !== undefined && raw.phases !== null) {
    if (!Array.isArray(raw.phases)) {
      errors.push('phases must be an array of {title, detail} objects');
    } else {
      for (let index = 0; index < raw.phases.length; index += 1) {
        const item = raw.phases[index];
        const title = isPlainObject(item) ? asText(item.title) : typeof item === 'string' ? asText(item) : '';
        if (title === '') {
          errors.push(`phases[${index}] needs a non-empty title`);
          continue;
        }
        phases.push({ title, detail: isPlainObject(item) ? asText(item.detail) : '' });
      }
    }
  }

  const tags = [];
  if (raw.tags !== undefined && raw.tags !== null) {
    if (!Array.isArray(raw.tags)) {
      errors.push('tags must be an array of strings');
    } else {
      for (const tag of raw.tags) {
        const text = asText(tag);
        if (text !== '' && !tags.includes(text) && tags.length < 16) tags.push(text);
      }
    }
  }

  const inlineScript = [raw.script, raw.run, raw.source].find((candidate) => typeof candidate === 'string');
  const script = scriptText !== undefined ? scriptText : inlineScript;
  if (typeof script !== 'string' || script.trim() === '') {
    errors.push('capsule has no script: provide "script", "run", "source", or a readable "scriptFile"');
  } else {
    const bytes = Buffer.byteLength(script, 'utf8');
    if (bytes > MAX_SCRIPT_BYTES) {
      errors.push(`script is ${bytes} bytes; the limit is ${MAX_SCRIPT_BYTES}`);
    }
    const esm = script.match(ESM_STATEMENT);
    if (esm) {
      errors.push(
        `script must be a function body, not a module: remove the top-level "${esm[1]}" statement (the engine wraps the script itself)`
      );
    }
    if (!RETURN_STATEMENT.test(script)) {
      warnings.push('script has no return statement, so the run result will be undefined');
    }
  }

  const capsule = {
    kind: FORMAT_KIND,
    version: FORMAT_VERSION,
    name,
    intent,
    whenToUse,
    inputs,
    phases,
    tags,
    script: typeof script === 'string' ? script : '',
    sourcePath: path,
    scope
  };

  return { capsule, errors, warnings };
}

/**
 * Merge declared inputs with call-site args: type-check what was supplied,
 * fill defaults, and report missing required inputs.
 */
export function applyInputs(capsule, provided) {
  const errors = [];
  if (provided !== undefined && provided !== null && !isPlainObject(provided)) {
    return { ok: false, errors: ['args must be a JSON object'] };
  }
  const supplied = provided ?? {};
  const args = { ...supplied };

  for (const input of capsule.inputs ?? []) {
    if (Object.prototype.hasOwnProperty.call(supplied, input.name)) {
      const check = checkValue(supplied[input.name], input.type);
      if (!check.ok) errors.push(`arg "${input.name}" ${check.reason}`);
      continue;
    }
    if (input.default !== undefined) {
      args[input.name] = input.default;
      continue;
    }
    if (input.required) errors.push(`missing required arg "${input.name}" (${input.type})`);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, args };
}

/** Compact one-line input contract used in listings and tool output. */
export function describeInputs(inputs) {
  if (!Array.isArray(inputs) || inputs.length === 0) return '(no declared inputs)';
  return inputs
    .map((input) => {
      const name = typeof input === 'string' ? input : String(input?.name ?? '');
      const type = typeof input === 'object' && input !== null ? String(input.type ?? 'string') : 'string';
      const required = typeof input === 'object' && input !== null && input.required === true;
      const withDefault =
        typeof input === 'object' && input !== null && input.default !== undefined
          ? `=${stringifyJson(input.default, 0)}`
          : '';
      return `${name}${required ? '*' : ''}:${type}${withDefault}`;
    })
    .join(', ');
}

/**
 * Map a capsule onto the native `WorkflowMeta` shape the engine validates.
 * Engine names are kept to the conservative kebab-case alphabet.
 */
export function toWorkflowMeta(capsule) {
  const meta = {
    name: slugify(capsule.name),
    description: capsule.intent
  };
  if (capsule.whenToUse !== '') meta.whenToUse = capsule.whenToUse;
  if (Array.isArray(capsule.phases) && capsule.phases.length > 0) {
    meta.phases = capsule.phases.map((phase) => {
      const entry = { title: phase.title };
      if (phase.detail !== '') entry.detail = phase.detail;
      return entry;
    });
  }
  return meta;
}

/**
 * Resolve a harness service from a plugin context.
 *
 * Cordis exposes services through two different paths and they are not
 * equivalent: property access (`ctx.jobs`) resolves through the providing
 * fiber's provisions, while `ctx.get(name)` only reports implementations whose
 * owning fiber is currently active. A plugin loaded as a profile bundle can
 * therefore reach a service by property while `ctx.get` returns nothing, so
 * this helper tries every documented path and reports which one answered.
 */
export function resolveService(ctx, name) {
  if (ctx === undefined || ctx === null || typeof name !== 'string' || name === '') {
    return { value: undefined, via: 'missing' };
  }

  try {
    const value = ctx[name];
    if (value !== undefined && value !== null) return { value, via: 'property' };
  } catch {
    // A required-but-inactive service throws on property access; fall through.
  }

  if (typeof ctx.get === 'function') {
    for (const [strict, via] of [
      [true, 'get'],
      [false, 'get-inactive']
    ]) {
      try {
        const value = ctx.get(name, strict);
        if (value !== undefined && value !== null) return { value, via };
      } catch {
        // Fall through to the next strategy.
      }
    }
  }

  try {
    const root = ctx.root;
    if (root !== undefined && root !== null && root !== ctx) {
      const value = root[name];
      if (value !== undefined && value !== null) return { value, via: 'root' };
    }
  } catch {
    // The service simply is not there.
  }

  // Last resort: the implementation store. A preset may isolate a service, in
  // which case the provider is registered under a realm symbol that neither
  // property access nor `get` resolves from a profile-level bundle. The store
  // still lists it, so scan it and prefer an active provider.
  try {
    const store = ctx.reflect?.store;
    if (store !== undefined && store !== null) {
      let fallback;
      for (const key of Reflect.ownKeys(store)) {
        const impl = store[key];
        if (impl === undefined || impl === null || impl.name !== name) continue;
        if (impl.ctx?.fiber?.state === 2) return { value: impl.value, via: 'store' };
        if (fallback === undefined) fallback = impl.value;
      }
      if (fallback !== undefined) return { value: fallback, via: 'store-inactive' };
    }
  } catch {
    // Kernels without a reflective store behave like a missing service.
  }

  return { value: undefined, via: 'missing' };
}

/** Shorthand for `resolveService(ctx, name).value`. */
export function serviceOf(ctx, name) {
  return resolveService(ctx, name).value;
}

function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}