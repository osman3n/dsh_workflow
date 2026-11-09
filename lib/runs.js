/**
 * Durable run records.
 *
 * Every workflow run gets one directory:
 *
 *   .dsh/workflow-runs/<runId>/
 *     run.json               — status, timing, args, capsule path, agent count
 *     events.jsonl           — phase / log / agent-start / agent-end stream
 *     workflow.workflow.json — exact capsule and script that ran (provenance)
 *     result.json            — the value the script returned
 *
 * Records are written best-effort: a failing record write is logged and never
 * fails the workflow itself.
 */

import { existsSync } from 'node:fs';
import { appendFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { FORMAT_KIND, FORMAT_VERSION, errorMessage, stringifyJson } from './spec.js';

const RECORD_VERSION = 1;
const RECORD_FILE = 'run.json';

export class RunStore {
  #homeDir;
  #limit;
  #log;

  constructor({ homeDir, limit = 25, log = () => {} } = {}) {
    this.#homeDir = homeDir;
    this.#limit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 25;
    this.#log = log;
  }

  /** Project-local run history, or a personal fallback when there is no cwd. */
  rootDir(cwd) {
    if (typeof cwd === 'string' && cwd.trim() !== '') return join(cwd, '.dsh', 'workflow-runs');
    return join(this.#homeDir, 'workflow-runs');
  }

  async begin({ runId, name, capsule, args, cwd }) {
    const id = String(runId ?? '').trim();
    if (id === '') throw new Error('run records need a run id');

    const dir = join(this.rootDir(cwd), safeSegment(id));
    const startedAt = new Date().toISOString();
    const base = {
      version: RECORD_VERSION,
      id,
      name: String(name ?? ''),
      status: 'running',
      startedAt,
      finishedAt: '',
      stopReason: '',
      agentsStarted: 0,
      error: '',
      capsulePath: typeof capsule?.sourcePath === 'string' ? capsule.sourcePath : '',
      capsuleScope: typeof capsule?.scope === 'string' ? capsule.scope : '',
      args: args ?? null
    };

    let queue = Promise.resolve();
    const enqueue = (task) => {
      queue = queue.then(task).catch((error) => {
        this.#log(`workflow-kit: run record ${dir}: ${errorMessage(error)}`);
      });
      return queue;
    };

    enqueue(async () => {
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, RECORD_FILE), `${JSON.stringify(base, null, 2)}\n`, 'utf8');
      await appendFile(join(dir, 'events.jsonl'), `${JSON.stringify({ time: startedAt, type: 'run-start', name: base.name })}\n`, 'utf8');
      if (capsule) {
        const provenance = {
          kind: FORMAT_KIND,
          version: FORMAT_VERSION,
          name: capsule.name,
          intent: capsule.intent,
          whenToUse: capsule.whenToUse,
          inputs: capsule.inputs,
          phases: capsule.phases,
          tags: capsule.tags,
          script: capsule.script,
          sourcePath: capsule.sourcePath,
          scope: capsule.scope,
          recordedAt: startedAt
        };
        await writeFile(join(dir, 'workflow.workflow.json'), `${JSON.stringify(provenance, null, 2)}\n`, 'utf8');
      }
    });

    const store = this;

    return {
      id,
      dir,
      /** Append one event to events.jsonl, preserving write order. */
      event(event) {
        enqueue(() =>
          appendFile(join(dir, 'events.jsonl'), `${JSON.stringify({ time: new Date().toISOString(), ...event })}\n`, 'utf8')
        );
      },
      /** Finalize run.json, write result.json and prune old runs. */
      async finish(result) {
        await queue;
        const stopReason = String(result?.stopReason ?? 'error');
        const status = stopReason === 'completed' ? 'completed' : stopReason === 'cancelled' ? 'cancelled' : 'error';
        const final = {
          ...base,
          status,
          finishedAt: new Date().toISOString(),
          stopReason,
          agentsStarted: Number.isFinite(Number(result?.agentsStarted)) ? Math.max(0, Math.floor(Number(result.agentsStarted))) : 0,
          error: typeof result?.error === 'string' ? result.error : ''
        };
        await enqueue(async () => {
          await writeFile(join(dir, RECORD_FILE), `${JSON.stringify(final, null, 2)}\n`, 'utf8');
          await writeFile(join(dir, 'result.json'), `${stringifyJson(result?.value ?? null)}\n`, 'utf8');
          await appendFile(
            join(dir, 'events.jsonl'),
            `${JSON.stringify({ time: final.finishedAt, type: 'run-end', status, stopReason, agentsStarted: final.agentsStarted })}\n`,
            'utf8'
          );
        });
        await queue;
        const pruned = await store.prune(cwd).catch(() => []);
        return { ...final, dir, pruned };
      }
    };
  }

  /** Recent run records, newest first. */
  async list(cwd, limit) {
    const root = this.rootDir(cwd);
    if (!existsSync(root)) return [];

    let names;
    try {
      names = await readdir(root);
    } catch (error) {
      this.#log(`workflow-kit: cannot read ${root}: ${errorMessage(error)}`);
      return [];
    }

    const records = [];
    for (const entry of names) {
      try {
        const text = await readFile(join(root, entry, RECORD_FILE), 'utf8');
        const record = JSON.parse(text);
        if (record && typeof record === 'object') records.push({ ...record, dir: join(root, entry) });
      } catch {
        // A half-written or foreign directory is not a run record.
      }
    }

    records.sort((left, right) => String(right.startedAt ?? '').localeCompare(String(left.startedAt ?? '')));
    const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : records.length;
    return records.slice(0, cap);
  }

  /** Newest run of one workflow, if any. */
  async lastRun(cwd, name) {
    const records = await this.list(cwd);
    return records.find((record) => record.name === name);
  }

  /** Keep the newest `keep` run records (default from config). */
  async prune(cwd, keep) {
    const wanted = Number.isFinite(keep) && keep > 0 ? Math.floor(keep) : this.#limit;
    const records = await this.list(cwd);
    const removed = [];
    for (const record of records.slice(wanted)) {
      try {
        await rm(record.dir, { recursive: true, force: true });
        removed.push(record.dir);
      } catch (error) {
        this.#log(`workflow-kit: cannot prune ${record.dir}: ${errorMessage(error)}`);
      }
    }
    return removed;
  }
}

function safeSegment(value) {
  const segment = String(value ?? '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .slice(0, 120);
  return segment === '' ? 'run' : segment;
}