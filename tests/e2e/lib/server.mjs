import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const MAX_LOG_CHARS = 64 * 1024;

function appendLog(current, chunk) {
  const next = current + chunk.toString('utf8');
  return next.length > MAX_LOG_CHARS ? next.slice(next.length - MAX_LOG_CHARS) : next;
}

/**
 * Reserves an ephemeral non-zero TCP port on 127.0.0.1 and releases it.
 * Required because src/config/env.ts parses process.env.PORT before app.listen().
 */
export function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string' || addr.port <= 0) {
        server.close(() => reject(new Error('Failed to acquire an ephemeral TCP port')));
        return;
      }
      const { port } = addr;
      server.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
  });
}

async function waitForHealth(baseUrl, timeoutMs, getChildState) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'No response';

  while (Date.now() < deadline) {
    if (getChildState) {
      const { exited, exitCode, signal, stdout, stderr } = getChildState();
      if (exited) {
        throw new Error(
          `Server exited early (code=${exitCode}, signal=${signal}).\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`
        );
      }
    }

    try {
      const res = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (res.status === 200) {
        const body = await res.json();
        if (body && body.status === 'ok') {
          return;
        }
        lastError = `Unexpected /health body: ${JSON.stringify(body)}`;
      } else {
        lastError = `HTTP ${res.status}`;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    await new Promise((r) => setTimeout(r, 50));
  }

  const state = getChildState ? getChildState() : { stdout: '', stderr: '' };
  throw new Error(
    `Timed out waiting for ${baseUrl}/health (${timeoutMs}ms). Last error: ${lastError}\nSTDOUT:\n${state.stdout}\nSTDERR:\n${state.stderr}`
  );
}

/**
 * Starts an isolated Express child process (`node dist/index.js`) or attaches to TEST_BASE_URL.
 */
export async function startServer({ port, env = {}, timeoutMs = 15000 } = {}) {
  if (process.env.TEST_BASE_URL) {
    const baseUrl = process.env.TEST_BASE_URL.replace(/\/+$/, '');
    await waitForHealth(baseUrl, timeoutMs, null);
    const parsed = new URL(baseUrl);
    return {
      baseUrl,
      port: Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80)),
      getLogs: () => ({ stdout: '', stderr: '' }),
      close: async () => {},
    };
  }

  const entryFile = path.join(REPO_ROOT, 'dist', 'index.js');
  const nodeModulesDir = path.join(REPO_ROOT, 'node_modules');
  if (!fs.existsSync(entryFile) || !fs.existsSync(nodeModulesDir)) {
    throw new Error(
      `Missing dist/index.js or node_modules/ in ${REPO_ROOT}. Run "npm ci && npm run build" before running E2E tests.`
    );
  }

  const targetPort = port ?? (process.env.TEST_PORT ? Number(process.env.TEST_PORT) : await findFreePort());
  const baseUrl = `http://127.0.0.1:${targetPort}`;

  let stdout = '';
  let stderr = '';
  let exited = false;
  let exitCode = null;
  let exitSignal = null;

  const child = spawn(process.execPath, ['dist/index.js'], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PORT: String(targetPort),
      NODE_ENV: 'test',
      SUPABASE_URL: '',
      SUPABASE_KEY: '',
      YOUTUBE_API_KEY: '',
      GEMINI_API_KEY: '',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    stdout = appendLog(stdout, chunk);
  });
  child.stderr.on('data', (chunk) => {
    stderr = appendLog(stderr, chunk);
  });
  child.on('exit', (code, signal) => {
    exited = true;
    exitCode = code;
    exitSignal = signal;
  });

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    process.off('exit', onProcessExit);
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);

    if (exited || child.killed) return;

    await new Promise((resolve) => {
      const killTimer = setTimeout(() => {
        if (!exited) {
          try {
            child.kill('SIGKILL');
          } catch {}
        }
        resolve();
      }, 2000);

      child.once('exit', () => {
        clearTimeout(killTimer);
        resolve();
      });

      try {
        child.kill('SIGTERM');
      } catch {
        clearTimeout(killTimer);
        resolve();
      }
    });
  };

  const onProcessExit = () => {
    if (!exited) {
      try {
        child.kill('SIGKILL');
      } catch {}
    }
  };
  const onSignal = () => {
    onProcessExit();
  };

  process.once('exit', onProcessExit);
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  try {
    await waitForHealth(baseUrl, timeoutMs, () => ({
      exited,
      exitCode,
      signal: exitSignal,
      stdout,
      stderr,
    }));
  } catch (err) {
    await close();
    throw err;
  }

  return {
    baseUrl,
    port: targetPort,
    getLogs: () => ({ stdout, stderr }),
    close,
  };
}
