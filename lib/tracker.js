/**
 * Run tracker: bridges native `workflow/*` engine events to durable run
 * records and, for background runs, to the job output ring.
 *
 * The engine emits events for every workflow run in the profile, including
 * runs started by the native `workflow` tool. Only run ids registered here are
 * recorded, so this plugin never touches other runs' history.
 */

const MAX_PENDING_EVENTS = 200;

export function createRunTracker({ ctx, runs, log = () => {}, maxEventsPerRun = 5000 }) {
  const active = new Map();
  const pending = new Map();
  const eventCap = Number.isFinite(maxEventsPerRun) && maxEventsPerRun > 0 ? Math.floor(maxEventsPerRun) : 5000;

  const mirrorJob = (job, event) => {
    try {
      if (event.type === 'phase') {
        job.updateProgress(String(event.title ?? ''));
        job.append(`▸ ${String(event.title ?? '')}`, { channel: 'log' });
        return;
      }
      if (event.type === 'log') {
        job.append(`· ${String(event.message ?? '')}`, { channel: 'log' });
        return;
      }
      if (event.type === 'agent-start') {
        const phase = event.phase === '' ? '' : ` (${event.phase})`;
        job.append(`▶ ${String(event.label ?? 'agent')}${phase}`, { channel: 'log' });
        return;
      }
      if (event.type === 'agent-end') {
        job.append(`■ ${String(event.label ?? 'agent')} → ${String(event.outcome ?? 'done')}`, { channel: 'log' });
      }
    } catch {
      // A closed job must never break recording.
    }
  };

  const recordEvent = (entry, event) => {
    if (entry.events >= eventCap) {
      if (!entry.truncated) {
        entry.truncated = true;
        entry.record.event({ type: 'events-truncated', limit: eventCap });
      }
      return;
    }
    entry.events += 1;
    entry.record.event(event);
    if (entry.job) mirrorJob(entry.job, event);
  };

  const deliver = (info, event) => {
    const raw = info?.id ?? info?.runId;
    const id = typeof raw === 'string' ? raw : raw === undefined || raw === null ? '' : String(raw);
    if (id === '') return;

    const entry = active.get(id);
    if (entry) {
      recordEvent(entry, event);
      return;
    }
    const buffer = pending.get(id) ?? [];
    if (buffer.length < MAX_PENDING_EVENTS) {
      buffer.push(event);
      pending.set(id, buffer);
    }
  };

  const disposers = [
    ctx.on('workflow/phase', (info, title) => deliver(info, { type: 'phase', title: String(title ?? '') })),
    ctx.on('workflow/log', (info, message) => deliver(info, { type: 'log', message: String(message ?? '') })),
    ctx.on('workflow/agent-start', (info, agent) =>
      deliver(info, {
        type: 'agent-start',
        seq: toSeq(agent?.seq),
        label: String(agent?.label ?? ''),
        phase: String(agent?.phase ?? '')
      })
    ),
    ctx.on('workflow/agent-end', (info, agent) =>
      deliver(info, {
        type: 'agent-end',
        seq: toSeq(agent?.seq),
        label: String(agent?.label ?? ''),
        outcome: String(agent?.outcome ?? ''),
        phase: String(agent?.phase ?? '')
      })
    )
  ];

  return {
    /** Start recording; buffered events that arrived first are flushed. */
    async begin(options) {
      const record = await runs.begin(options);
      const entry = { record, job: undefined, events: 0, truncated: false };
      active.set(record.id, entry);
      const buffered = pending.get(record.id);
      if (buffered) {
        pending.delete(record.id);
        for (const event of buffered) recordEvent(entry, event);
      }
      return record;
    },

    /** Attach a job so lifecycle events also show up in its output ring. */
    attachJob(runId, job) {
      const entry = active.get(String(runId));
      if (entry) entry.job = job;
    },

    /** Finalize the record. Safe to call once; returns the run directory. */
    async finish(runId, result) {
      const id = String(runId);
      const entry = active.get(id);
      active.delete(id);
      pending.delete(id);
      if (!entry) return undefined;
      return entry.record.finish(result);
    },

    get activeRuns() {
      return active.size;
    },

    dispose() {
      for (const off of disposers) {
        try {
          if (typeof off === 'function') off();
        } catch (error) {
          log(`workflow-kit: cannot detach workflow listener: ${String(error)}`);
        }
      }
      disposers.length = 0;
      active.clear();
      pending.clear();
    }
  };
}

function toSeq(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : 0;
}