import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const exists = path => existsSync(resolve(root, path));
const readJson = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const required = [
  'README.md', 'AGENTS.md', 'ASSET_LICENSES.md', 'package.json', 'package-lock.json',
  'tsconfig.json', 'vite.config.ts', 'vitest.config.ts', 'playwright.config.ts',
  '.github/workflows/ci.yml', 'docs/README.md', 'docs/PRODUCT.md', 'docs/GAME_RULES.md',
  'docs/ARCHITECTURE.md', 'docs/CONTENT.md', 'docs/IMPLEMENTATION.md', 'docs/QA.md',
  'docs/HARNESS.md', 'docs/STATUS.md', 'docs/decisions/0001-project-baseline.md',
  'docs/templates/TASK.md', 'docs/templates/VERIFICATION.md', 'docs/templates/PLAYTEST.md',
  'tests/fixtures/shots.json', 'tests/e2e/readiness.spec.ts',
];
for (const path of required) check(exists(path), 'Missing required file: ' + path);

try {
  const matrix = readJson('docs/requirements.json');
  check(matrix.schemaVersion === 1, 'Unsupported requirement schema');
  check(exists(matrix.source), 'Missing original specification');
  const ids = new Set();
  for (const row of matrix.requirements) {
    check(!ids.has(row.id), 'Duplicate requirement: ' + row.id);
    ids.add(row.id);
    check(/^R-[A-Z][A-Z0-9]*$/.test(row.id), 'Invalid requirement ID: ' + row.id);
    check(exists(row.document), row.id + ': missing design document');
    check(row.sourceSections.length > 0 && row.sourceSections.every(n => Number.isInteger(n) && n >= 1 && n <= 16),
      row.id + ': invalid source section');
    check(['planned', 'reference-tested', 'implemented', 'verified'].includes(row.status), row.id + ': invalid status');
    check(row.acceptance?.length > 0 && row.verification?.length > 0 && row.owner?.length > 0,
      row.id + ': missing acceptance / verification / owner');
    check(/^M[0-4]$/.test(row.milestone), row.id + ': invalid milestone');
    if (row.status !== 'planned') check(row.evidence.length > 0, row.id + ': status requires evidence');
    for (const path of row.evidence) check(exists(path), row.id + ': missing evidence ' + path);
  }
  check(ids.size >= 28, 'Requirement inventory is incomplete');

  const plan = readJson('docs/content-plan.json');
  check(plan.schemaVersion === 1 && plan.status === 'planning-only', 'Content must be explicitly planning-only');
  const types = ['HIGH_POWER_MISS', 'MISS', 'NEAR_SUCCESS', 'UNDERPOWER_HIT', 'OFF_CENTER_HIT'];
  const familyTypes = {
    DELAYED_NOTICE: ['UNDERPOWER_HIT', 'OFF_CENTER_HIT'],
    FALSE_RELIEF: ['NEAR_SUCCESS'],
    SELF_OWN: ['HIGH_POWER_MISS'],
    AWKWARD_MISS: ['MISS'],
    FAKE_FORGIVENESS: ['UNDERPOWER_HIT', 'OFF_CENTER_HIT', 'MISS'],
  };
  const characters = new Set(plan.characters.map(c => c.id));
  const endings = new Map(plan.endings.map(e => [e.id, e]));
  check(characters.size === 8 && plan.characters.length === 8, 'Exactly eight unique initial characters required');
  check(endings.size === plan.endings.length, 'Duplicate ending IDs');
  for (const family of Object.keys(familyTypes)) {
    check(plan.endings.some(e => e.family === family), 'Missing ending family: ' + family);
  }
  for (const ending of plan.endings) {
    check(ending.status === 'planned', ending.id + ': content cannot be marked produced by this manifest');
    check(ending.characterIds.length > 0 && ending.characterIds.every(id => characters.has(id)),
      ending.id + ': unknown or missing compatible characters');
    check(ending.allowedFailureTypes.length > 0 && ending.allowedFailureTypes.every(t => familyTypes[ending.family]?.includes(t)),
      ending.id + ': incompatible failure family');
    check(ending.beats.includes(ending.keyMoment), ending.id + ': missing key-moment beat');
    check(ending.assetKeys.length > 0, ending.id + ': missing asset planning keys');
  }
  for (const character of plan.characters) {
    check(character.age >= 20 && character.status === 'planned', character.id + ': invalid adult/planning status');
    check(character.nameKey && character.successReactionId && character.dialogueKey && character.reactionType,
      character.id + ': missing identity/reaction contract');
    check(Object.keys(character.endingIdsByFailure).length === types.length, character.id + ': unexpected failure map');
    for (const type of types) {
      const candidates = character.endingIdsByFailure[type] ?? [];
      check(candidates.length > 0, character.id + ': uncovered failure ' + type);
      check(new Set(candidates).size === candidates.length, character.id + ': duplicate candidates for ' + type);
      for (const id of candidates) {
        const ending = endings.get(id);
        check(ending?.allowedFailureTypes.includes(type) && ending?.characterIds.includes(character.id),
          character.id + '/' + type + ': incompatible ending ' + id);
      }
    }
  }

  // Check authored Markdown's relative file links. The user source is read-only reference material.
  function markdownFiles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? markdownFiles(path) : entry.name.endsWith('.md') ? [path] : [];
    });
  }
  const markdown = ['README.md', 'AGENTS.md', 'ASSET_LICENSES.md'].map(p => resolve(root, p))
    .concat(markdownFiles(resolve(root, 'docs')));
  for (const file of markdown.filter(file => file !== resolve(root, matrix.source))) {
    const contents = readFileSync(file, 'utf8');
    for (const match of contents.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
      check(existsSync(resolve(dirname(file), decodeURIComponent(target))),
        relative(root, file) + ': broken link ' + target);
    }
  }
  const pkg = readJson('package.json');
  const lock = readJson('package-lock.json');
  check(pkg.name === 'poke-and-panic' && pkg.private === true, 'Package identity/private setting mismatch');
  for (const script of ['dev', 'build', 'preview', 'typecheck', 'test', 'test:e2e', 'check']) {
    check(Boolean(pkg.scripts[script]), 'Missing script: ' + script);
  }
  for (const category of ['dependencies', 'devDependencies']) {
    check(JSON.stringify(pkg[category]) === JSON.stringify(lock.packages[''][category]),
      'Lockfile root mismatch: ' + category);
  }
  if (!errors.length) {
    console.log('Project harness OK: ' + ids.size + ' requirements, ' + characters.size +
      ' planned characters, ' + endings.size + ' planned endings, 40 compatible character/failure combinations.');
    console.log('This checks planning integrity, not game completion or animation quality.');
  }
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
}
if (errors.length) {
  for (const error of errors) console.error('- ' + error);
  process.exitCode = 1;
}
