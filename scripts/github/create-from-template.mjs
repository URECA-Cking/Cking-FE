import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const ORGANIZATION_REPOSITORY = 'URECA-Cking/.github';
const PROJECT_REPOSITORY = 'URECA-Cking/Cking-FE';

function runGh(args, options = {}) {
  const result = spawnSync('gh', args, { encoding: 'utf8', ...options });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `gh ${args.join(' ')} 실행에 실패했습니다.`);
  }

  return result.stdout.trim();
}

function getOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function getOrganizationFile(path) {
  const encoded = runGh([
    'api',
    `repos/${ORGANIZATION_REPOSITORY}/contents/${path}`,
    '--jq',
    '.content',
  ]);

  return Buffer.from(encoded.replaceAll('\n', ''), 'base64').toString('utf8');
}

function requireOption(name) {
  const value = getOption(name);

  if (!value || value.startsWith('--')) {
    throw new Error(`${name} 값을 지정해야 합니다.`);
  }

  return value;
}

function getBody() {
  return readFileSync(requireOption('--body-file'), 'utf8');
}

function requireHeadings(body, headings) {
  const missingHeadings = headings.filter((heading) => !body.includes(`## ${heading}`));

  if (missingHeadings.length > 0) {
    throw new Error(`템플릿 필수 섹션이 없습니다: ${missingHeadings.join(', ')}`);
  }
}

function issueTemplate(type) {
  if (!['feature', 'bug', 'task'].includes(type)) {
    throw new Error('--type은 feature, bug, task 중 하나여야 합니다.');
  }

  const template = getOrganizationFile(`.github/ISSUE_TEMPLATE/${type}.yml`);
  const titlePrefix = template.match(/^title:\s*["']?([^"'\n]*)/m)?.[1];
  const headings = [...template.matchAll(/^\s+label:\s*([^\n]+)$/gm)].map((match) =>
    match[1].trim().replace(/^['"]|['"]$/g, ''),
  );

  return { titlePrefix, headings };
}

function prTemplate() {
  return getOrganizationFile('.github/PULL_REQUEST_TEMPLATE.md')
    .split('\n')
    .map((line) => line.match(/^##\s+(.+)$/)?.[1])
    .filter(Boolean);
}

function getCreatedNumber(url, kind) {
  const number = url.match(new RegExp(`${kind}/(\\d+)$`))?.[1];

  if (!number) {
    throw new Error(`생성 결과 URL에서 ${kind} 번호를 찾을 수 없습니다: ${url}`);
  }

  return number;
}

function runVerifier(target, number) {
  const result = spawnSync(
    process.execPath,
    ['scripts/github/verify-template.mjs', target, '--number', number],
    { encoding: 'utf8' },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `${target} 검증에 실패했습니다.`);
  }

  console.log(result.stdout.trim());
}

function repairIssue(number, { title, type, body }) {
  runGh([
    'issue', 'edit', number, '--repo', PROJECT_REPOSITORY, '--title', title,
    '--body', body, '--add-label', type, '--add-assignee', '@me',
  ]);
}

function repairPullRequest(number, { title, body, reviewer }) {
  runGh([
    'pr', 'edit', number, '--repo', PROJECT_REPOSITORY, '--title', title,
    '--body', body, '--add-reviewer', reviewer,
  ]);
}

function createIssue() {
  const type = requireOption('--type');
  const title = requireOption('--title');
  const body = getBody();
  const { titlePrefix, headings } = issueTemplate(type);

  if (titlePrefix && !title.startsWith(titlePrefix)) {
    throw new Error(`제목은 '${titlePrefix}'로 시작해야 합니다.`);
  }

  requireHeadings(body, headings);
  const args = [
    'issue', 'create', '--repo', PROJECT_REPOSITORY, '--title', title, '--label', type,
    '--assignee', '@me', '--body', body,
  ];
  const url = runGh(args);
  const number = getCreatedNumber(url, 'issues');

  repairIssue(number, { title, type, body });
  runVerifier('issue', number);
  console.log(`생성 완료: ${url}`);
}

function createPullRequest() {
  const title = requireOption('--title');
  const body = getBody();
  const issueNumber = requireOption('--issue');
  const reviewer = requireOption('--reviewer');
  const base = getOption('--base') ?? 'develop';
  const headings = prTemplate();

  requireHeadings(body, headings);
  if (!new RegExp(`\\bCloses\\s+#${issueNumber}\\b`, 'i').test(body)) {
    throw new Error(`PR 본문에 'Closes #${issueNumber}'를 넣어야 합니다.`);
  }

  const args = [
    'pr', 'create', '--repo', PROJECT_REPOSITORY, '--base', base, '--title', title,
    '--reviewer', reviewer, '--body', body,
  ];

  const url = runGh(args);
  const number = getCreatedNumber(url, 'pull');

  repairPullRequest(number, { title, body, reviewer });
  runVerifier('pr', number);
  console.log(`생성 완료: ${url}`);
}

function printUsage() {
  console.error('사용법: node scripts/github/create-from-template.mjs <issue|pr> [옵션]');
  process.exitCode = 1;
}

const [target] = process.argv.slice(2);

try {
  if (target === 'issue') {
    createIssue();
  } else if (target === 'pr') {
    createPullRequest();
  } else {
    printUsage();
  }
} catch (error) {
  console.error(`생성 중단: ${error.message}`);
  process.exitCode = 1;
}
