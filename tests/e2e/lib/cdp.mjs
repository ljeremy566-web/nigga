import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PageHelper } from './page.mjs';

const DEFAULT_CHROMIUM = '/usr/bin/chromium';

function waitForDevToolsUrl(chrome, timeoutMs) {
  return new Promise((resolve, reject) => {
    let stderrBuf = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Timed out waiting for Chromium DevTools URL (${timeoutMs}ms). STDERR:\n${stderrBuf}`));
    }, timeoutMs);

    const onData = (chunk) => {
      stderrBuf += chunk.toString('utf8');
      const match = stderrBuf.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match && !settled) {
        settled = true;
        cleanup();
        resolve(match[1]);
      }
    };

    const onExit = (code, signal) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Chromium exited prematurely (code=${code}, signal=${signal}). STDERR:\n${stderrBuf}`));
    };

    const onError = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      clearTimeout(timer);
      chrome.stderr.off('data', onData);
      chrome.off('exit', onExit);
      chrome.off('error', onError);
    };

    chrome.stderr.on('data', onData);
    chrome.once('exit', onExit);
    chrome.once('error', onError);
  });
}

function openWebSocket(wsUrl, timeoutMs) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {}
      reject(new Error(`Timed out connecting to CDP WebSocket ${wsUrl}`));
    }, timeoutMs);

    ws.addEventListener('open', () => {
      clearTimeout(timer);
      resolve(ws);
    }, { once: true });

    ws.addEventListener('error', (event) => {
      clearTimeout(timer);
      reject(new Error(`CDP WebSocket error: ${event?.message || 'connection failed'}`));
    }, { once: true });
  });
}

/**
 * Launches headless Chromium and returns a CDP browser controller with isolated BrowserContext pages.
 */
export async function launchBrowser({
  executablePath = process.env.CHROMIUM_PATH || DEFAULT_CHROMIUM,
  headless = true,
  timeoutMs = 15000,
} = {}) {
  if (!fs.existsSync(executablePath)) {
    throw new Error(`Chromium executable not found at ${executablePath}`);
  }

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-chrome-'));
  const downloadBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-dl-'));

  const args = [
    ...(headless ? ['--headless'] : []),
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ];

  const chrome = spawn(executablePath, args, {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let closed = false;
  const activePages = new Set();

  const killChromeAndCleanDirs = () => {
    if (chrome.pid) {
      try {
        process.kill(-chrome.pid, 'SIGKILL');
      } catch {}
    }
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
    try {
      fs.rmSync(downloadBaseDir, { recursive: true, force: true });
    } catch {}
  };

  const onProcessExit = () => {
    killChromeAndCleanDirs();
  };
  process.once('exit', onProcessExit);

  let ws;
  try {
    const wsUrl = await waitForDevToolsUrl(chrome, timeoutMs);
    ws = await openWebSocket(wsUrl, timeoutMs);
  } catch (err) {
    process.off('exit', onProcessExit);
    killChromeAndCleanDirs();
    throw err;
  }

  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  const rejectAllPending = (reason) => {
    for (const [id, entry] of pending.entries()) {
      clearTimeout(entry.timer);
      entry.reject(new Error(`${entry.method} failed: ${reason}`));
      pending.delete(id);
    }
  };

  ws.addEventListener('message', (event) => {
    let msg;
    try {
      msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
    } catch {
      return;
    }

    if (msg.id !== undefined) {
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      clearTimeout(entry.timer);
      if (msg.error) {
        entry.reject(new Error(`CDP ${entry.method} error (${msg.error.code}): ${msg.error.message}`));
      } else {
        entry.resolve(msg.result ?? {});
      }
      return;
    }

    if (msg.method) {
      const handlers = listeners.get(msg.method);
      if (handlers) {
        for (const fn of [...handlers]) {
          try {
            fn(msg.params ?? {}, msg.sessionId);
          } catch {
            // Listener exceptions must not break CDP event loop
          }
        }
      }
    }
  });

  ws.addEventListener('close', () => {
    rejectAllPending('WebSocket closed');
  });

  ws.addEventListener('error', () => {
    rejectAllPending('WebSocket error');
  });

  const send = (method, params = {}, sessionId = undefined, cmdTimeoutMs = timeoutMs) => {
    if (ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error(`Cannot send ${method}: CDP WebSocket is not open`));
    }
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP ${method} timed out after ${cmdTimeoutMs}ms`));
      }, cmdTimeoutMs);

      pending.set(id, { resolve, reject, timer, method });
      const payload = sessionId ? { id, method, params, sessionId } : { id, method, params };
      try {
        ws.send(JSON.stringify(payload));
      } catch (err) {
        clearTimeout(timer);
        pending.delete(id);
        reject(err);
      }
    });
  };

  const on = (method, handler) => {
    let set = listeners.get(method);
    if (!set) {
      set = new Set();
      listeners.set(method, set);
    }
    set.add(handler);
    return () => {
      set.delete(handler);
      if (set.size === 0) listeners.delete(method);
    };
  };

  const client = { send, on };

  const newPage = async ({
    baseUrl,
    viewport = { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
    colorScheme,
    initScripts = [],
  } = {}) => {
    const { browserContextId } = await send('Target.createBrowserContext', { disposeOnDetach: true });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

    await send('Page.enable', {}, sessionId);
    await send('Runtime.enable', {}, sessionId);
    await send('DOM.enable', {}, sessionId);
    await send('Network.enable', {}, sessionId);
    await send('Log.enable', {}, sessionId);

    const frameTree = await send('Page.getFrameTree', {}, sessionId);
    const mainFrameId = frameTree?.frameTree?.frame?.id;

    for (const source of initScripts) {
      await send('Page.addScriptToEvaluateOnNewDocument', { source }, sessionId);
    }

    if (baseUrl) {
      const origin = new URL(baseUrl).origin;
      await send('Browser.grantPermissions', {
        origin,
        permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
        browserContextId,
      });
    }

    const downloadDir = fs.mkdtempSync(path.join(downloadBaseDir, 'page-'));
    await send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir,
      eventsEnabled: true,
      browserContextId,
    });

    const page = new PageHelper({
      client,
      sessionId,
      targetId,
      browserContextId,
      mainFrameId,
      downloadDir,
      onClose: () => activePages.delete(page),
    });
    activePages.add(page);

    if (viewport) {
      await page.setViewport(viewport);
    }
    if (colorScheme) {
      await page.setColorScheme(colorScheme);
    }

    return page;
  };

  const exitPromise = new Promise((resolve) => {
    if (chrome.exitCode !== null || chrome.signalCode !== null) {
      resolve();
    } else {
      chrome.once('exit', () => resolve());
    }
  });

  const close = async () => {
    if (closed) return;
    closed = true;
    process.off('exit', onProcessExit);

    for (const page of [...activePages]) {
      try {
        await page.close();
      } catch {}
    }

    try {
      await send('Browser.close', {}, undefined, 1500);
    } catch {}

    try {
      ws.close();
    } catch {}

    await Promise.race([exitPromise, new Promise((r) => setTimeout(r, 500))]);
    killChromeAndCleanDirs();
    await Promise.race([exitPromise, new Promise((r) => setTimeout(r, 200))]);
  };

  return {
    send,
    on,
    newPage,
    close,
    userDataDir,
  };
}
