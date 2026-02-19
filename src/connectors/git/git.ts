import simpleGit, { SimpleGit, DiffResult } from 'simple-git';
import path from 'path';

// ============================================================
// Git Connector
// ============================================================

function getGit(repoPath: string): SimpleGit {
  return simpleGit(path.resolve(repoPath));
}

// ─── Clone ───────────────────────────────────────────────────
export async function cloneRepo(
  url: string,
  targetDir: string
): Promise<{ success: boolean; path: string }> {
  const git = simpleGit();
  await git.clone(url, path.resolve(targetDir));
  return { success: true, path: path.resolve(targetDir) };
}

// ─── Commit ──────────────────────────────────────────────────
export async function commitChanges(
  repoPath: string,
  message: string,
  files?: string[]
): Promise<{ hash: string; message: string }> {
  const git = getGit(repoPath);
  if (files && files.length > 0) {
    await git.add(files);
  } else {
    await git.add('-A');
  }
  const result = await git.commit(message);
  return { hash: result.commit, message };
}

// ─── Create Branch ───────────────────────────────────────────
export async function createBranch(
  repoPath: string,
  branchName: string,
  checkout = true
): Promise<{ branch: string }> {
  const git = getGit(repoPath);
  await git.checkoutLocalBranch(branchName);
  return { branch: branchName };
}

// ─── Get Diff ────────────────────────────────────────────────
export async function getDiff(
  repoPath: string,
  from?: string,
  to?: string
): Promise<{ summary: string; files: string[]; insertions: number; deletions: number }> {
  const git = getGit(repoPath);
  let diff: DiffResult;

  if (from && to) {
    diff = await git.diffSummary([`${from}..${to}`]);
  } else if (from) {
    diff = await git.diffSummary([from]);
  } else {
    diff = await git.diffSummary(['HEAD']);
  }

  const files = diff.files.map((f) => f.file);
  const summary = diff.files
    .map((f) => `${f.file}: +${(f as any).insertions ?? 0} -${(f as any).deletions ?? 0}`)
    .join('\n');

  return {
    summary,
    files,
    insertions: diff.insertions,
    deletions: diff.deletions,
  };
}

// ─── Get Full Diff Content ───────────────────────────────────
export async function getDiffContent(
  repoPath: string,
  from = 'HEAD~1',
  to = 'HEAD'
): Promise<string> {
  const git = getGit(repoPath);
  return git.diff([`${from}..${to}`]);
}

// ─── Get Log ─────────────────────────────────────────────────
export async function getLog(
  repoPath: string,
  maxCount = 20
): Promise<Array<{ hash: string; message: string; author: string; date: string }>> {
  const git = getGit(repoPath);
  const log = await git.log({ maxCount });
  return log.all.map((entry) => ({
    hash: entry.hash.substring(0, 8),
    message: entry.message,
    author: entry.author_name,
    date: entry.date,
  }));
}

// ─── Check Breaking Changes ──────────────────────────────────
export async function analyzeBreakingChanges(
  repoPath: string,
  from = 'HEAD~1',
  to = 'HEAD'
): Promise<{ hasBreakingChanges: boolean; indicators: string[] }> {
  const diffContent = await getDiffContent(repoPath, from, to);
  const indicators: string[] = [];

  const breakingPatterns = [
    { pattern: /^-.*export (function|class|interface|type)/m, label: 'Removed export' },
    { pattern: /BREAKING CHANGE/i, label: 'Explicit BREAKING CHANGE annotation' },
    { pattern: /^-.*public\s+\w+\s*\(/m, label: 'Removed public method' },
    { pattern: /drop (table|column)/i, label: 'Database drop operation' },
    { pattern: /^-.*"version":\s*"\d/m, label: 'Version change in package.json' },
  ];

  for (const { pattern, label } of breakingPatterns) {
    if (pattern.test(diffContent)) {
      indicators.push(label);
    }
  }

  return { hasBreakingChanges: indicators.length > 0, indicators };
}

// ─── List Branches ───────────────────────────────────────────
export async function listBranches(repoPath: string): Promise<{
  current: string;
  branches: string[];
}> {
  const git = getGit(repoPath);
  const branches = await git.branch();
  return { current: branches.current, branches: branches.all };
}

// ─── Push ────────────────────────────────────────────────────
export async function pushBranch(
  repoPath: string,
  remote = 'origin',
  branch?: string
): Promise<{ success: boolean }> {
  const git = getGit(repoPath);
  await git.push(remote, branch);
  return { success: true };
}

// ─── Status ──────────────────────────────────────────────────
export async function getStatus(repoPath: string): Promise<{
  branch: string;
  staged: string[];
  modified: string[];
  untracked: string[];
  isClean: boolean;
}> {
  const git = getGit(repoPath);
  const status = await git.status();
  return {
    branch: status.current ?? 'unknown',
    staged: status.staged,
    modified: status.modified,
    untracked: status.not_added,
    isClean: status.isClean(),
  };
}
