import { spawnSync } from 'node:child_process';

const ORGANIZATION_REPOSITORY = 'URECA-Cking/.github';
const PROJECT_REPOSITORY = 'URECA-Cking/Cking-FE';

function fail(message) {
  console.error(`검증 실패: ${message}`);
  process.exitCode = 1;
}

function runGh(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8' });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `gh ${args.join(' ')} 실행에 실패했습니다.`);
  }

  return result.stdout.trim();
}

function getOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function getJson(args) {
  return JSON.parse(runGh(args));
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

function requiredHeadings(markdown) {
  return markdown
    .split('\n')
    .map((line) => line.match(/^##\s+(.+)$/)?.[1])
    .filter(Boolean);
}

function verifyIssue(number) {
  const issue = getJson([
    'issue',
    'view',
    number,
    '--repo',
    PROJECT_REPOSITORY,
    '--json',
    'title,labels,assignees,body,url',
  ]);
  const templateType = issue.labels.find(({ name }) =>
    ['feature', 'bug', 'task'].includes(name),
  )?.name;

  if (!templateType) {
    fail(`${issue.url}: feature, bug, task 레이블 중 하나가 없습니다.`);
    return;
  }

  const template = getOrganizationFile(`.github/ISSUE_TEMPLATE/${templateType}.yml`);
  const titlePrefix = template.match(/^title:\s*["']?([^"'\n]*)/m)?.[1];
  const headings = [...template.matchAll(/^\s+label:\s*([^\n]+)$/gm)].map((match) =>
    match[1].trim().replaceAll(/^['"]|['"]$/g, ''),
  );
  const currentLogin = runGh(['api', 'user', '--jq', '.login']);

  if (titlePrefix && !issue.title.startsWith(titlePrefix)) {
    fail(`${issue.url}: 제목이 '${titlePrefix}'로 시작하지 않습니다.`);
  }

  if (!issue.assignees.some(({ login }) => login === currentLogin)) {
    fail(`${issue.url}: 작성자 ${currentLogin}이 담당자로 지정되지 않았습니다.`);
  }

  for (const heading of headings) {
    if (!issue.body.includes(`## ${heading}`)) {
      fail(`${issue.url}: '${heading}' 템플릿 섹션이 없습니다.`);
    }
  }

  if (process.exitCode !== 1) {
    console.log(`Issue #${number}: 중앙 ${templateType} 템플릿 검증 통과`);
  }
}

function verifyPullRequest(number) {
  const pullRequest = getJson([
    'pr',
    'view',
    number,
    '--repo',
    PROJECT_REPOSITORY,
    '--json',
    'body,reviewRequests,url',
  ]);
  const template = getOrganizationFile('.github/PULL_REQUEST_TEMPLATE.md');

  for (const heading of requiredHeadings(template)) {
    if (!pullRequest.body.includes(`## ${heading}`)) {
      fail(`${pullRequest.url}: '${heading}' 템플릿 섹션이 없습니다.`);
    }
  }

  if (!/\bCloses\s+#\d+\b/i.test(pullRequest.body)) {
    fail(`${pullRequest.url}: 'Closes #이슈번호'가 없습니다.`);
  }

  if (pullRequest.reviewRequests.length === 0) {
    fail(`${pullRequest.url}: 요청된 리뷰어가 없습니다.`);
  }

  if (process.exitCode !== 1) {
    console.log(`PR #${number}: 중앙 PR 템플릿 검증 통과`);
  }
}

function printUsage() {
  console.error('사용법: node scripts/github/verify-template.mjs <issue|pr> --number <번호>');
  process.exitCode = 1;
}

const [target] = process.argv.slice(2);
const number = getOption('--number');

if (!['issue', 'pr'].includes(target) || !/^\d+$/.test(number ?? '')) {
  printUsage();
} else {
  try {
    if (target === 'issue') {
      verifyIssue(number);
    } else {
      verifyPullRequest(number);
    }
  } catch (error) {
    fail(error.message);
  }
}
