import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function patternToMatcher(urlPattern) {
  if (typeof urlPattern === 'function') return urlPattern;
  if (urlPattern instanceof RegExp) return (url) => urlPattern.test(url);
  const str = String(urlPattern);
  if (!str.includes('*')) {
    return (url) => url.includes(str);
  }
  const escaped = str.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const regex = new RegExp(`^${escaped}$`);
  return (url) => regex.test(url);
}

const KEY_CODES = {
  Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r', raw: false },
  Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27, raw: true },
  Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, raw: true },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37, raw: true },
  ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38, nativeVirtualKeyCode: 38, raw: true },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39, raw: true },
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40, nativeVirtualKeyCode: 40, raw: true },
  Backspace: { key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8, raw: true },
  ' ': { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32, text: ' ', raw: false },
  Space: { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32, text: ' ', raw: false },
};

/**
 * High-level browser page API backed by a single CDP Target/Session and isolated BrowserContext.
 */
export class PageHelper {
  constructor({ client, sessionId, targetId, browserContextId, mainFrameId, downloadDir, onClose }) {
    this.client = client;
    this.sessionId = sessionId;
    this.targetId = targetId;
    this.browserContextId = browserContextId;
    this.mainFrameId = mainFrameId;
    this.downloadDir = downloadDir;
    this._onClose = onClose;
    this._closed = false;

    this.consoleErrors = [];
    this.pageErrors = [];
    this.logErrors = [];
    this.recordedRequests = [];
    this.routeHandlers = [];
    this._fetchEnabled = false;
    this._downloadMap = new Map();
    this._completedDownloads = [];
    this._unsubscribers = [];

    this._attachListeners();
  }

  _attachListeners() {
    this._unsubscribers.push(
      this.client.on('Runtime.consoleAPICalled', (params, sid) => {
        if (sid !== this.sessionId || params.type !== 'error') return;
        const parts = (params.args || []).map((arg) => {
          if (arg.value !== undefined) return String(arg.value);
          if (arg.description) return arg.description;
          return arg.type || '';
        });
        this.consoleErrors.push({
          text: parts.join(' '),
          args: params.args || [],
          timestamp: params.timestamp || Date.now(),
        });
      }),

      this.client.on('Runtime.exceptionThrown', (params, sid) => {
        if (sid !== this.sessionId) return;
        const details = params.exceptionDetails || {};
        const desc = details.exception?.description || details.text || 'Uncaught exception';
        this.pageErrors.push({
          text: desc,
          stack: details.stackTrace ? JSON.stringify(details.stackTrace) : '',
          timestamp: params.timestamp || Date.now(),
        });
      }),

      this.client.on('Log.entryAdded', (params, sid) => {
        if (sid !== this.sessionId) return;
        const entry = params.entry;
        if (!entry || entry.level !== 'error') return;
        this.logErrors.push({
          level: entry.level,
          text: entry.text || '',
          source: entry.source || '',
          url: entry.url || '',
        });
      }),

      this.client.on('Network.requestWillBeSent', (params, sid) => {
        if (sid !== this.sessionId) return;
        this.recordedRequests.push({
          requestId: params.requestId,
          url: params.request?.url || '',
          method: params.request?.method || 'GET',
          postData: params.request?.postData,
          timestamp: params.timestamp,
        });
      }),

      this.client.on('Browser.downloadWillBegin', (params) => {
        if (this.mainFrameId && params.frameId && params.frameId !== this.mainFrameId) return;
        this._downloadMap.set(params.guid, {
          guid: params.guid,
          suggestedFilename: params.suggestedFilename,
          url: params.url,
          frameId: params.frameId,
        });
      }),

      this.client.on('Browser.downloadProgress', (params) => {
        if (params.state !== 'completed') return;
        const filePath = params.filePath || '';
        const belongsHere =
          (filePath && filePath.startsWith(this.downloadDir)) || this._downloadMap.has(params.guid);
        if (!belongsHere) return;

        const meta = this._downloadMap.get(params.guid) || {};
        const fallbackName = filePath ? path.basename(filePath) : 'download';
        const resolvedPath =
          filePath && fs.existsSync(filePath)
            ? filePath
            : path.join(this.downloadDir, meta.suggestedFilename || fallbackName);

        this._completedDownloads.push({
          guid: params.guid,
          suggestedFilename: meta.suggestedFilename || path.basename(resolvedPath),
          filePath: resolvedPath,
        });
      }),

      this.client.on('Fetch.requestPaused', async (params, sid) => {
        if (sid !== this.sessionId) return;
        const { requestId, request } = params;
        const url = request?.url || '';
        let settled = false;

        const fulfill = async ({
          status = 200,
          headers = { 'content-type': 'application/json; charset=utf-8' },
          body = '',
        } = {}) => {
          if (settled) return;
          settled = true;
          const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
          const responseHeaders = Object.entries(headers).map(([name, value]) => ({
            name,
            value: String(value),
          }));
          await this.client.send(
            'Fetch.fulfillRequest',
            {
              requestId,
              responseCode: status,
              responseHeaders,
              body: Buffer.from(bodyStr, 'utf8').toString('base64'),
            },
            this.sessionId
          );
        };

        const fail = async (errorReason = 'Failed') => {
          if (settled) return;
          settled = true;
          await this.client.send('Fetch.failRequest', { requestId, errorReason }, this.sessionId);
        };

        const cont = async (overrides = {}) => {
          if (settled) return;
          settled = true;
          await this.client.send('Fetch.continueRequest', { requestId, ...overrides }, this.sessionId);
        };

        try {
          // Match latest registered route first so tests can override prior routes
          let matched = null;
          for (let i = this.routeHandlers.length - 1; i >= 0; i--) {
            if (this.routeHandlers[i].matcher(url, request)) {
              matched = this.routeHandlers[i];
              break;
            }
          }
          if (matched) {
            await matched.handler({
              requestId,
              request,
              url,
              method: request?.method || 'GET',
              headers: request?.headers || {},
              postData: request?.postData,
              fulfill,
              fail,
              continue: cont,
            });
          }
        } catch {
          // Fallback in finally prevents request hangs
        } finally {
          if (!settled) {
            try {
              await this.client.send('Fetch.continueRequest', { requestId }, this.sessionId);
            } catch {}
          }
        }
      })
    );
  }

  async addInitScript(source) {
    await this.client.send('Page.addScriptToEvaluateOnNewDocument', { source }, this.sessionId);
  }

  async goto(url, { waitUntil = 'load', timeoutMs = 15000 } = {}) {
    const eventName = waitUntil === 'domcontentloaded' ? 'Page.domContentEventFired' : 'Page.loadEventFired';
    const loaded = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsub();
        reject(new Error(`Timed out waiting for ${eventName} navigating to ${url}`));
      }, timeoutMs);
      const unsub = this.client.on(eventName, (_params, sid) => {
        if (sid !== this.sessionId) return;
        clearTimeout(timer);
        unsub();
        resolve();
      });
    });

    await this.client.send('Page.navigate', { url }, this.sessionId, timeoutMs);
    await loaded;
    await new Promise((r) => setTimeout(r, 40));
  }

  async reload({ ignoreCache = true, timeoutMs = 15000 } = {}) {
    const loaded = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsub();
        reject(new Error(`Timed out waiting for Page.loadEventFired on reload`));
      }, timeoutMs);
      const unsub = this.client.on('Page.loadEventFired', (_params, sid) => {
        if (sid !== this.sessionId) return;
        clearTimeout(timer);
        unsub();
        resolve();
      });
    });

    await this.client.send('Page.reload', { ignoreCache }, this.sessionId, timeoutMs);
    await loaded;
    await new Promise((r) => setTimeout(r, 40));
  }

  async setViewport({ width, height, deviceScaleFactor = 1, mobile = false }) {
    await this.client.send(
      'Emulation.setDeviceMetricsOverride',
      { width, height, deviceScaleFactor, mobile },
      this.sessionId
    );
  }

  async setColorScheme(scheme) {
    await this.setEmulatedMedia([{ name: 'prefers-color-scheme', value: scheme }]);
  }

  async setEmulatedMedia(features) {
    await this.client.send('Emulation.setEmulatedMedia', { features }, this.sessionId);
  }

  async evaluate(fnOrExpr, ...args) {
    const expression =
      typeof fnOrExpr === 'function'
        ? `(${fnOrExpr.toString()})(...${JSON.stringify(args)})`
        : String(fnOrExpr);

    const res = await this.client.send(
      'Runtime.evaluate',
      {
        expression,
        awaitPromise: true,
        returnByValue: true,
      },
      this.sessionId
    );

    if (res.exceptionDetails) {
      const msg =
        res.exceptionDetails.exception?.description ||
        res.exceptionDetails.text ||
        'Evaluation threw an exception';
      throw new Error(`Page evaluate error: ${msg}`);
    }

    return res.result?.value;
  }

  async waitForSelector(selector, { visible = false, hidden = false, timeoutMs = 8000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const state = await this.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return { exists: false, visible: false };
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const hiddenByStyle =
          style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0;
        const hiddenByClass = Boolean(el.closest('.hidden'));
        const isVis =
          !hiddenByStyle && !hiddenByClass && (rect.width > 0 || rect.height > 0 || el.getClientRects().length > 0);
        return { exists: true, visible: isVis };
      }, selector);

      if (hidden) {
        if (!state.exists || !state.visible) return true;
      } else if (visible) {
        if (state.exists && state.visible) return true;
      } else if (state.exists) {
        return true;
      }

      await new Promise((r) => setTimeout(r, 35));
    }

    throw new Error(
      `Timed out waiting for selector "${selector}" (${hidden ? 'hidden' : visible ? 'visible' : 'present'}) after ${timeoutMs}ms`
    );
  }

  async waitForFunction(fn, args = [], { timeoutMs = 8000, pollMs = 35 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let lastError = null;
    while (Date.now() < deadline) {
      try {
        const val = await this.evaluate(fn, ...args);
        if (val) return val;
      } catch (err) {
        lastError = err;
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }
    throw new Error(
      `Timed out waiting for function condition after ${timeoutMs}ms${lastError ? ` (last error: ${lastError.message})` : ''}`
    );
  }

  async click(selector, { timeoutMs = 8000 } = {}) {
    await this.waitForSelector(selector, { visible: true, timeoutMs });
    const box = await this.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      let rect = el.getBoundingClientRect();
      // If still outside viewport (e.g. nested scroll container or tall sticky panel), try scrolling ancestors
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        let p = el.parentElement;
        while (p) {
          const cs = window.getComputedStyle(p);
          if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight) {
            p.scrollTop += rect.top - window.innerHeight / 2;
          }
          p = p.parentElement;
        }
        rect = el.getBoundingClientRect();
      }
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const inViewport =
        rect.left >= 0 &&
        rect.top >= 0 &&
        rect.right <= window.innerWidth &&
        rect.bottom <= window.innerHeight;
      const hit = inViewport ? document.elementFromPoint(x, y) : null;
      const hitTarget = Boolean(hit && (el === hit || el.contains(hit)));
      return {
        x,
        y,
        width: rect.width,
        height: rect.height,
        inViewport,
        hitTarget,
      };
    }, selector);

    assert.ok(box && box.width > 0 && box.height > 0, `Element "${selector}" has zero bounding box`);

    if (!box.inViewport || !box.hitTarget) {
      await this.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.click();
      }, selector);
      return;
    }

    await this.client.send(
      'Input.dispatchMouseEvent',
      { type: 'mouseMoved', x: box.x, y: box.y, button: 'none', clickCount: 0 },
      this.sessionId
    );
    await this.client.send(
      'Input.dispatchMouseEvent',
      { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 },
      this.sessionId
    );
    await this.client.send(
      'Input.dispatchMouseEvent',
      { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 },
      this.sessionId
    );
  }

  async focus(selector) {
    await this.waitForSelector(selector, { visible: true });
    await this.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.focus();
    }, selector);
  }

  async fill(selector, value) {
    await this.waitForSelector(selector, { visible: true });
    await this.evaluate((sel, val) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`Missing element ${sel}`);
      el.focus();
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : el instanceof HTMLInputElement
            ? HTMLInputElement.prototype
            : Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(el, String(val));
      else el.value = String(val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, selector, value);
  }

  async type(selector, text, { delayMs = 0 } = {}) {
    await this.focus(selector);
    for (const ch of String(text)) {
      await this.client.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch }, this.sessionId);
      await this.client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch }, this.sessionId);
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  async selectOption(selector, value) {
    await this.waitForSelector(selector, { visible: true });
    const found = await this.evaluate((sel, val) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const opt = Array.from(el.options || []).find((o) => o.value === String(val));
      if (!opt) return false;
      el.value = String(val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, selector, value);
    assert.ok(found, `Option "${value}" not found in select "${selector}"`);
  }

  async pressKey(key, { shiftKey = false } = {}) {
    const modifiers = shiftKey ? 8 : 0;
    const spec = KEY_CODES[key];
    if (spec) {
      const downType = spec.raw ? 'rawKeyDown' : 'keyDown';
      await this.client.send(
        'Input.dispatchKeyEvent',
        {
          type: downType,
          key: spec.key,
          code: spec.code,
          windowsVirtualKeyCode: spec.windowsVirtualKeyCode,
          nativeVirtualKeyCode: spec.nativeVirtualKeyCode,
          ...(spec.text ? { text: spec.text } : {}),
          modifiers,
        },
        this.sessionId
      );
      await this.client.send(
        'Input.dispatchKeyEvent',
        {
          type: 'keyUp',
          key: spec.key,
          code: spec.code,
          windowsVirtualKeyCode: spec.windowsVirtualKeyCode,
          nativeVirtualKeyCode: spec.nativeVirtualKeyCode,
          modifiers,
        },
        this.sessionId
      );
      return;
    }

    await this.client.send(
      'Input.dispatchKeyEvent',
      { type: 'keyDown', text: key, key, modifiers },
      this.sessionId
    );
    await this.client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, modifiers }, this.sessionId);
  }

  async getText(selector) {
    return this.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.textContent.trim() : null;
    }, selector);
  }

  async getAttr(selector, name) {
    return this.evaluate((sel, attr) => {
      const el = document.querySelector(sel);
      return el ? el.getAttribute(attr) : null;
    }, selector, name);
  }

  async getValue(selector) {
    return this.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.value : null;
    }, selector);
  }

  async exists(selector) {
    return this.evaluate((sel) => Boolean(document.querySelector(sel)), selector);
  }

  async isVisible(selector) {
    return this.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) {
        return false;
      }
      if (el.closest('.hidden')) return false;
      return rect.width > 0 || rect.height > 0 || el.getClientRects().length > 0;
    }, selector);
  }

  async count(selector) {
    return this.evaluate((sel) => document.querySelectorAll(sel).length, selector);
  }

  async countVisible(selector) {
    return this.evaluate((sel) => {
      return Array.from(document.querySelectorAll(sel)).filter((el) => {
        if (el.closest('.hidden')) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) {
          return false;
        }
        const rect = el.getBoundingClientRect();
        return rect.width > 0 || rect.height > 0 || el.getClientRects().length > 0;
      }).length;
    }, selector);
  }

  async getBoundingRect(selector) {
    return this.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    }, selector);
  }

  async getComputedStyle(selector, prop) {
    return this.evaluate((sel, property) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return window.getComputedStyle(el).getPropertyValue(property).trim() || window.getComputedStyle(el)[property];
    }, selector, prop);
  }

  async getCssVar(name, selector = ':root') {
    return this.evaluate((sel, varName) => {
      const el = document.querySelector(sel);
      if (!el) return '';
      return window.getComputedStyle(el).getPropertyValue(varName).trim();
    }, selector, name);
  }

  async interceptRoute(urlPattern, handler) {
    if (!this._fetchEnabled) {
      await this.client.send(
        'Fetch.enable',
        { patterns: [{ urlPattern: '*', requestStage: 'Request' }] },
        this.sessionId
      );
      this._fetchEnabled = true;
    }
    const route = { matcher: patternToMatcher(urlPattern), handler };
    this.routeHandlers.push(route);
    return () => {
      const idx = this.routeHandlers.indexOf(route);
      if (idx !== -1) this.routeHandlers.splice(idx, 1);
    };
  }

  async mockError(
    urlPattern,
    { status = 500, body = { success: false, error: 'Mocked error' }, networkFail = false, errorReason = 'Failed' } = {}
  ) {
    return this.interceptRoute(urlPattern, async (route) => {
      if (networkFail) {
        await route.fail(errorReason);
      } else {
        await route.fulfill({ status, body });
      }
    });
  }

  async clearRoutes() {
    this.routeHandlers = [];
    if (this._fetchEnabled) {
      this._fetchEnabled = false;
      try {
        await this.client.send('Fetch.disable', {}, this.sessionId);
      } catch {}
    }
  }

  getRecordedRequests() {
    return [...this.recordedRequests];
  }

  clearRecordedRequests() {
    this.recordedRequests = [];
  }

  async waitForDownload(triggerFn, { timeoutMs = 8000 } = {}) {
    const startCount = this._completedDownloads.length;
    await triggerFn();

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this._completedDownloads.length > startCount) {
        const entry = this._completedDownloads[startCount];
        if (entry.filePath && fs.existsSync(entry.filePath)) {
          const buffer = fs.readFileSync(entry.filePath);
          return {
            suggestedFilename: entry.suggestedFilename,
            filePath: entry.filePath,
            buffer,
            content: buffer.toString('utf8'),
          };
        }
      }
      await new Promise((r) => setTimeout(r, 35));
    }

    throw new Error(`Timed out waiting for download completion after ${timeoutMs}ms`);
  }

  async readClipboard() {
    return this.evaluate(() => navigator.clipboard.readText());
  }

  async getLocalStorage(key) {
    return this.evaluate((k) => window.localStorage.getItem(k), key);
  }

  async setLocalStorage(key, value) {
    await this.evaluate((k, v) => window.localStorage.setItem(k, v), key, value);
  }

  async clearStorage() {
    await this.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  }

  async screenshot({ fullPage = false } = {}) {
    const res = await this.client.send(
      'Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: fullPage },
      this.sessionId
    );
    return Buffer.from(res.data, 'base64');
  }

  captureConsoleAndPageErrors() {
    return {
      consoleErrors: [...this.consoleErrors],
      pageErrors: [...this.pageErrors],
      logErrors: [...this.logErrors],
    };
  }

  clearErrors() {
    this.consoleErrors = [];
    this.pageErrors = [];
    this.logErrors = [];
  }

  assertNoPageErrors(context = '') {
    const prefix = context ? `[${context}] ` : '';
    assert.equal(
      this.pageErrors.length,
      0,
      `${prefix}Expected 0 uncaught pageErrors, got ${this.pageErrors.length}: ${JSON.stringify(this.pageErrors)}`
    );
  }

  assertNoRuntimeErrors(context = '') {
    const prefix = context ? `[${context}] ` : '';
    this.assertNoPageErrors(context);
    assert.equal(
      this.consoleErrors.length,
      0,
      `${prefix}Expected 0 consoleErrors, got ${this.consoleErrors.length}: ${JSON.stringify(this.consoleErrors)}`
    );
    const localOrAppLogErrors = this.logErrors.filter(
      (entry) =>
        !(
          entry.source === 'network' &&
          typeof entry.url === 'string' &&
          entry.url.startsWith('https://') &&
          typeof entry.text === 'string' &&
          entry.text.includes('ERR_CERT_AUTHORITY_INVALID')
        )
    );
    assert.equal(
      localOrAppLogErrors.length,
      0,
      `${prefix}Expected 0 logErrors, got ${localOrAppLogErrors.length}: ${JSON.stringify(localOrAppLogErrors)}`
    );
  }

  async resetBrowserState({ url } = {}) {
    await this.clearRoutes();
    await this.clearStorage();
    this.clearErrors();
    this.clearRecordedRequests();
    if (url) {
      await this.goto(url);
    }
  }

  async close() {
    if (this._closed) return;
    this._closed = true;
    this._onClose?.();

    await this.clearRoutes();
    for (const unsub of this._unsubscribers) {
      try {
        unsub();
      } catch {}
    }
    this._unsubscribers = [];

    try {
      await this.client.send('Target.closeTarget', { targetId: this.targetId }, undefined, 3000);
    } catch {}
    try {
      await this.client.send('Target.disposeBrowserContext', { browserContextId: this.browserContextId }, undefined, 3000);
    } catch {}
    try {
      fs.rmSync(this.downloadDir, { recursive: true, force: true });
    } catch {}
  }
}
