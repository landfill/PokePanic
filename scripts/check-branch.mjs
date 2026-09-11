import { execFileSync } from 'node:child_process';

// PR의 source branch 또는 로컬 작업 브랜치. main의 일반 빌드에는 적용하지 않는다.
const branch = process.env.PR_HEAD_REF ?? execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
const valid = /^codex\/(feat|fix|refactor|test|docs|chore|perf|hotfix)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(branch);
if (!valid) {
  console.error('Invalid work branch: ' + (branch || '(detached HEAD)') + '. Expected codex/<type>/<slug>; see docs/BRANCHING.md.');
  process.exitCode = 1;
} else console.log('Work branch OK: ' + branch);
