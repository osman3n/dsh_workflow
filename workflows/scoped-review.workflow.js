/**
 * scoped-review
 *
 * One reviewer per focus aspect, then a single verdict agent that sees every
 * finding. The reviewers run concurrently.
 *
 * This file is a plain function body for the harness workflow engine; `args`,
 * `agent()`, `parallel()`, `phase()` and `log()` are in scope.
 */

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    aspect: { type: 'string' },
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          severity: { type: 'string', enum: ['blocker', 'high', 'medium', 'low'] },
          problem: { type: 'string' },
          evidence: { type: 'string' },
          fix: { type: 'string' }
        },
        required: ['severity', 'problem', 'evidence', 'fix']
      }
    }
  },
  required: ['aspect', 'summary', 'findings']
};

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict: { type: 'string', enum: ['approve', 'request-changes', 'reject'] },
    rationale: { type: 'string' },
    blocking: { type: 'array', items: { type: 'string' } }
  },
  required: ['verdict', 'rationale', 'blocking']
};

const target = String(args.target ?? '').trim();
if (target === '') throw new Error('scoped-review needs a "target" arg (a path, a diff, a branch, or a change description)');

const requestedFocus = Array.isArray(args.focus)
  ? args.focus.map((item) => String(item).trim()).filter((item) => item !== '')
  : [];
const focus = (requestedFocus.length > 0 ? requestedFocus : ['correctness', 'security', 'maintainability']).slice(0, 6);
const maxFindings = Number.isInteger(args.max_findings) && args.max_findings > 0 ? args.max_findings : 6;

phase('Review');

const reviews = (
  await parallel(
    focus.map((aspect) => async () => {
      const result = await agent(
        [
          `Review this target: ${target}`,
          '',
          `Focus aspect: ${aspect}`,
          `Report at most ${maxFindings} findings for this aspect. Read the code instead of guessing;`,
          'every finding needs concrete evidence (file:line, a command you ran, or an error you reproduced).',
          'Do not report style opinions or things the code already handles.',
          '',
          'Return a one-paragraph summary plus findings with severity, problem, evidence and fix.'
        ].join('\n'),
        { label: `review: ${aspect}`, phase: 'Review', schema: FINDINGS_SCHEMA }
      );

      if (result === null) {
        return { aspect, summary: `the ${aspect} reviewer failed or was skipped`, findings: [] };
      }
      return {
        aspect,
        summary: result.summary,
        findings: Array.isArray(result.findings) ? result.findings.slice(0, maxFindings) : []
      };
    })
  )
).filter((review) => review !== null && review !== undefined);

const findings = [];
for (const review of reviews) {
  for (const finding of review.findings) {
    findings.push({
      aspect: review.aspect,
      severity: finding.severity,
      problem: finding.problem,
      evidence: finding.evidence,
      fix: finding.fix
    });
  }
}

phase('Verdict');

const verdict = await agent(
  [
    `Decide the review verdict for this target: ${target}`,
    '',
    'Weigh only the findings below. A blocker or several high findings means request-changes or reject.',
    'If the findings are minor or empty, approve. Name the blocking findings in "blocking".',
    '',
    'Findings (JSON):',
    JSON.stringify(findings, null, 2)
  ].join('\n'),
  { label: 'verdict', phase: 'Verdict', schema: VERDICT_SCHEMA }
);

return {
  target,
  focus,
  reviews,
  findings,
  verdict,
  findingCount: findings.length,
  agentsStarted: reviews.length + 1
};