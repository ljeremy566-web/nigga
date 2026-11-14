import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const E2E_DIR = import.meta.dirname;
const DEFAULT_CHROMIUM = process.env.CHROMIUM_PATH || '/usr/bin/chromium';

const TIER_FILES = {
  '1': 'tier1-features.test.mjs',
  '2': 'tier2-boundaries.test.mjs',
  '3': 'tier3-combinations.test.mjs',
  '4': 'tier4-scenarios.test.mjs',
};

function printHelp() {
  console.log(`Content Studio E2E Test Runner (Node v24 node:test + Headless Chromium CDP)

Usage:
  node tests/e2e/run-e2e.mjs [options]

Options:
  --tier=1|2|3|4|all    Select tier to execute (default: all)
  --filter=<pattern>    Filter tests by name pattern (--test-name-pattern)
  --concurrency=<n>     Number of test files to run concurrently (default: 1)
  --help, -h            Show this help text

Environment:
  TEST_BASE_URL         Attach to an already running server instead of spawning dist/index.js
  TEST_PORT             Force specific port for spawned dist/index.js
  CHROMIUM_PATH         Override Chromium executable (default: /usr/bin/chromium)
`);
}

function parseArgs(argv) {
  const opts = { tier: 'all', filter: null, concurrency: '1', help: false };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg.startsWith('--tier=')) {
      opts.tier = arg.slice('--tier='.length).trim();
    } else if (arg.startsWith('--filter=')) {
      opts.filter = arg.slice('--filter='.length);
    } else if (arg.startsWith('--concurrency=')) {
      opts.concurrency = arg.slice('--concurrency='.length).trim();
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
  printHelp();
  process.exit(0);
}

let files;
if (opts.tier === 'all') {
  files = Object.values(TIER_FILES).map((f) => path.join(E2E_DIR, f));
} else if (TIER_FILES[opts.tier]) {
  files = [path.join(E2E_DIR, TIER_FILES[opts.tier])];
} else {
  console.error(`Invalid --tier=${opts.tier}. Expected 1, 2, 3, 4, or all.`);
  process.exit(2);
}

if (!fs.existsSync(DEFAULT_CHROMIUM)) {
  console.error(`Chromium executable not found at ${DEFAULT_CHROMIUM}.`);
  process.exit(1);
}

if (!process.env.TEST_BASE_URL) {
  const distEntry = path.join(REPO_ROOT, 'dist', 'index.js');
  const nodeModules = path.join(REPO_ROOT, 'node_modules');
  if (!fs.existsSync(distEntry) || !fs.existsSync(nodeModules)) {
    console.error(
      `Missing dist/index.js or node_modules/ in ${REPO_ROOT}.\nRun "npm ci && npm run build" (or wait for M1 build) before running E2E tests, or set TEST_BASE_URL.`
    );
    process.exit(1);
  }
}

const nodeArgs = [
  '--test',
  '--test-reporter=spec',
  `--test-concurrency=${opts.concurrency}`,
];
if (opts.filter) {
  nodeArgs.push(`--test-name-pattern=${opts.filter}`);
}
nodeArgs.push(...files);

const result = spawnSync(process.execPath, nodeArgs, {
  cwd: REPO_ROOT,
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
