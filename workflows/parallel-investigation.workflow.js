/**
 * parallel-investigation
 *
 * One researcher per angle, then a single synthesizer.
 *
 * This file is a plain function body for the harness workflow engine. Inside it
 * these hooks are in scope:
 *
 *   args      — declared input values
 *   agent()   — run one subagent (resolves null when the child fails)
 *   pipeline()— map items through stages without a barrier between items
 *   phase()   — progress group for the run UI
 *   log()     — progress line for the run UI
 */

const ANGLE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    finding: { type: 'string' },
    evidence: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
  },
  required: ['finding', 'evidence', 'confidence']
};

function normaliseAngles(value) {
  const list = Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter((item) => item !== '')
    : [];
  if (list.length > 0) return list.slice(0, 8);
  return ['official documentation', 'the actual implementation', 'real usage examples', 'risks and failure modes'];
}

const question = String(args.question ?? '').trim();
if (question === '') throw new Error('parallel-investigation needs a non-empty "question" arg');

const angles = normaliseAngles(args.angles);
const extraBrief = String(args.brief ?? '').trim();

phase('Investigate');

const investigations = await pipeline(angles, async (_previous, angle, index) => {
  const result = await agent(
    [
      `Investigate one angle of this question: ${question}`,
      '',
      `Angle: ${angle} (${index + 1} of ${angles.length})`,
      'Stay inside this angle. Do not try to answer the whole question; another researcher covers the rest.',
      'Ground every claim in something you actually read or ran.',
      '',
      'Return finding (2-6 sentences), evidence (concrete file paths, URLs or commands), and confidence.'
    ].join('\n'),
    { label: `investigate: ${angle}`, phase: 'Investigate', schema: ANGLE_SCHEMA }
  );

  if (result === null) {
    return {
      angle,
      index,
      finding: `the "${angle}" investigation failed or was skipped`,
      evidence: [],
      confidence: 'low'
    };
  }
  return { angle, index, finding: result.finding, evidence: result.evidence, confidence: result.confidence };
});

phase('Synthesize');

const findings = investigations.filter((entry) => entry !== null && entry !== undefined);

const brief = await agent(
  [
    `Write one brief that answers this question: ${question}`,
    extraBrief === '' ? '' : `Extra instruction: ${extraBrief}`,
    '',
    'Use only the findings below. Where angles disagree, say so instead of picking one silently.',
    'Cite the file paths, URLs or commands from the evidence lists. Keep it under 600 words.',
    '',
    'Findings (JSON):',
    JSON.stringify(findings, null, 2)
  ]
    .filter((line) => line !== '')
    .join('\n'),
  { label: 'synthesize', phase: 'Synthesize' }
);

return {
  question,
  angles,
  findings,
  brief,
  agentsStarted: findings.length + 1
};