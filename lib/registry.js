/**
 * Capsule registry: discovers, validates, saves and deletes `dsh.workflow`
 * v1 capsules.
 *
 * Search order is low priority to high priority:
 *   builtin  — capsules shipped inside this plugin (workflows/)
 *   project  — <cwd>/.dsh/workflows
 *   personal — $DSH_HOME/workflows
 *   extra    — configured extraDirs, in order
 *
 * A later scope overrides an earlier one with the same capsule name, so a
 * personal workflow can shadow a built-in without editing it.
 */

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';

import {
  FORMAT_KIND,
  FORMAT_VERSION,
  capsuleBaseName,
  errorMessage,
  normalizeCapsule
} from './spec.js';

const CAPSULE_FILE = /\.workflow\.json$/i;

export class Registry {
  #builtinsDir;
  #homeDir;
  #extraDirs;
  #log;

  constructor({ builtinsDir = '', homeDir, extraDirs = [], log = () => {} } = {}) {
    this.#builtinsDir = builtinsDir;
    this.#homeDir = homeDir;
    this.#extraDirs = extraDirs;
    this.#log = log;
  }

  /** Directories searched for capsules, low priority first. */
  resolveDirs(cwd) {
    const dirs = [];
    if (this.#builtinsDir !== '') dirs.push({ scope: 'builtin', dir: this.#builtinsDir });
    if (typeof cwd === 'string' && cwd.trim() !== '') dirs.push({ scope: 'project', dir: join(cwd, '.dsh', 'workflows') });
    dirs.push({ scope: 'personal', dir: join(this.#homeDir, 'workflows') });
    for (const extra of this.#extraDirs) dirs.push({ scope: 'extra', dir: resolve(extra) });
    return dirs.map((entry) => ({ ...entry, exists: existsSync(entry.dir) }));
  }

  /** Every capsule file on disk, low priority first. */
  async scan(cwd) {
    const entries = [];
    for (const dirEntry of this.resolveDirs(cwd)) {
      if (!dirEntry.exists) continue;
      let files;
      try {
        files = await readdir(dirEntry.dir);
      } catch (error) {
        this.#log(`workflow-kit: cannot read ${dirEntry.dir}: ${errorMessage(error)}`);
        continue;
      }
      for (const file of files.sort()) {
        if (!CAPSULE_FILE.test(file)) continue;
        entries.push({ scope: dirEntry.scope, dir: dirEntry.dir, file, path: join(dirEntry.dir, file) });
      }
    }
    return entries;
  }

  /** Read and validate one capsule file. Never throws. */
  async readEntry(entry) {
    let text;
    try {
      text = await readFile(entry.path, 'utf8');
    } catch (error) {
      return { ok: false, entry, errors: [`cannot read capsule: ${errorMessage(error)}`], warnings: [] };
    }

    let raw;
    try {
      raw = JSON.parse(text);
    } catch (error) {
      return { ok: false, entry, errors: [`invalid JSON: ${errorMessage(error)}`], warnings: [] };
    }

    let scriptText;
    const scriptFile = typeof raw?.scriptFile === 'string' ? raw.scriptFile.trim() : '';
    if (scriptFile !== '') {
      const target = isAbsolute(scriptFile) ? scriptFile : resolve(entry.dir, scriptFile);
      try {
        scriptText = await readFile(target, 'utf8');
      } catch (error) {
        return {
          ok: false,
          entry,
          errors: [`scriptFile ${JSON.stringify(scriptFile)} is not readable: ${errorMessage(error)}`],
          warnings: []
        };
      }
    }

    const result = normalizeCapsule(raw, { path: entry.path, scope: entry.scope, scriptText });
    return { ...result, ok: result.errors.length === 0, entry };
  }

  /**
   * All capsules visible from `cwd`, with shadowing collapsed into one entry
   * per name. Invalid capsules are reported separately so they stay fixable.
   */
  async list(cwd) {
    const entries = await this.scan(cwd);
    const dirs = this.resolveDirs(cwd);
    const byName = new Map();
    const problems = [];

    for (const entry of entries) {
      const read = await this.readEntry(entry);
      if (!read.ok || !read.capsule) {
        problems.push({
          name: read.capsule?.name ?? capsuleBaseName(entry.file),
          scope: entry.scope,
          path: entry.path,
          error: (read.errors ?? ['unknown error']).join('; ')
        });
        continue;
      }
      const previous = byName.get(read.capsule.name);
      const alsoInList = previous ? [`${previous.scope}:${previous.path}`, ...previous.alsoInList] : [];
      byName.set(read.capsule.name, { capsule: read.capsule, scope: entry.scope, path: entry.path, alsoInList });
    }

    const workflows = [...byName.values()]
      .map((record) => ({
        capsule: record.capsule,
        name: record.capsule.name,
        intent: record.capsule.intent,
        whenToUse: record.capsule.whenToUse,
        inputs: record.capsule.inputs,
        phases: record.capsule.phases,
        tags: record.capsule.tags,
        scope: record.scope,
        path: record.path,
        alsoIn: record.alsoInList.join(' ')
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    return { workflows, problems, dirs };
  }

  /** Load one capsule by name from the highest-priority scope that defines it. */
  async load(name, cwd) {
    const wanted = String(name ?? '').trim();
    if (wanted === '') throw new Error('workflow name is required');

    const entries = await this.scan(cwd);
    let winner;
    const errors = [];

    for (const entry of entries) {
      const read = await this.readEntry(entry);
      const matches = read.capsule?.name === wanted || capsuleBaseName(entry.file) === wanted;
      if (!matches) continue;
      if (!read.ok || !read.capsule) {
        errors.push(`${entry.path}: ${(read.errors ?? ['unknown error']).join('; ')}`);
        continue;
      }
      winner = { capsule: read.capsule, warnings: read.warnings ?? [], path: entry.path };
    }

    if (winner) return { ...winner.capsule, warnings: winner.warnings };
    if (errors.length > 0) throw new Error(`workflow "${wanted}" is invalid:\n${errors.join('\n')}`);
    throw new Error(
      `unknown workflow "${wanted}"; call workflow_list to see the available capsules and their names`
    );
  }

  /** Directory a capsule is written to. */
  storageDir(scope, cwd) {
    if (scope === 'personal') return join(this.#homeDir, 'workflows');
    if (scope === 'project') {
      if (typeof cwd !== 'string' || cwd.trim() === '') {
        throw new Error('project scope needs a workspace directory, but this session has no cwd; use scope="personal"');
      }
      return join(cwd, '.dsh', 'workflows');
    }
    throw new Error(`unknown scope ${JSON.stringify(scope)}; expected "project" or "personal"`);
  }

  /**
   * Write a capsule as `<name>.workflow.json` plus `<name>.workflow.js`.
   * The script lives in its own file so it stays readable and reviewable.
   */
  async save(capsule, { scope = 'project', cwd, overwrite = false } = {}) {
    const dir = this.storageDir(scope, cwd);
    const name = capsule.name;
    const capsulePath = join(dir, `${name}.workflow.json`);
    const scriptPath = join(dir, `${name}.workflow.js`);

    if (!overwrite) {
      if (existsSync(capsulePath)) {
        throw new Error(`${capsulePath} already exists; pass overwrite=true to replace it`);
      }
      if (existsSync(scriptPath)) {
        throw new Error(`${scriptPath} already exists; pass overwrite=true to replace it`);
      }
    }

    const manifest = { kind: FORMAT_KIND, version: FORMAT_VERSION, name, intent: capsule.intent };
    if (capsule.whenToUse !== '') manifest.whenToUse = capsule.whenToUse;
    if (capsule.inputs.length > 0) manifest.inputs = capsule.inputs;
    if (capsule.phases.length > 0) manifest.phases = capsule.phases;
    if (capsule.tags.length > 0) manifest.tags = capsule.tags;
    manifest.scriptFile = `./${name}.workflow.js`;

    await mkdir(dir, { recursive: true });
    await writeFile(scriptPath, `${capsule.script.trimEnd()}\n`, 'utf8');
    await writeFile(capsulePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    return { dir, scope, capsulePath, scriptPath };
  }

  /** Delete one capsule (and its script file) from one scope. */
  async remove(name, { scope = 'project', cwd } = {}) {
    if (scope === 'builtin') throw new Error('built-in workflows are read-only; save an override into project or personal scope instead');
    const dir = this.storageDir(scope, cwd);
    if (!existsSync(dir)) throw new Error(`the ${scope} workflow directory does not exist: ${dir}`);

    const files = await readdir(dir);
    for (const file of files.sort()) {
      if (!CAPSULE_FILE.test(file)) continue;
      const path = join(dir, file);
      let raw;
      try {
        raw = JSON.parse(await readFile(path, 'utf8'));
      } catch {
        raw = undefined;
      }
      const capsuleName = typeof raw?.name === 'string' && raw.name.trim() !== '' ? raw.name.trim() : capsuleBaseName(file);
      if (capsuleName !== name) continue;

      const removed = [path];
      await rm(path, { force: true });

      const scriptFile = typeof raw?.scriptFile === 'string' ? raw.scriptFile.trim() : '';
      if (scriptFile !== '') {
        const target = isAbsolute(scriptFile) ? scriptFile : resolve(dir, scriptFile);
        if (target.startsWith(dir) && existsSync(target)) {
          await rm(target, { force: true });
          removed.push(target);
        }
      }
      return { removed, dir, scope };
    }

    throw new Error(`no workflow named "${name}" in the ${scope} scope (${dir})`);
  }
}