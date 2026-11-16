#!/usr/bin/env node
/**
 * Script local opcional (cero dependencias externas, Node v24 + Chromium CDP)
 * para buscar Reels en Instagram usando una sesión autenticada persistente,
 * extraer metadatos + screenshot del primer frame y enviarlos a Content Studio.
 *
 * Uso:
 *   1) Iniciar sesión una sola vez en perfil local:
 *      node scripts/ig-capture-cdp.mjs --login
 *
 *   2) Capturar Reels por búsqueda, hashtag o cuenta:
 *      node scripts/ig-capture-cdp.mjs --query="ia productividad" --limit=8 --target=http://localhost:3000
 *      node scripts/ig-capture-cdp.mjs --tag="inteligenciaartificial" --limit=6
 *      node scripts/ig-capture-cdp.mjs --account="@creatorshub" --limit=8
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';

const DEFAULT_PROFILE_DIR = path.join(os.homedir(), '.content-studio-ig-profile');

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('No se encontró Chromium/Chrome. Define CHROMIUM_PATH=/ruta/al/navegador.');
}

function parseArgs(argv) {
  const opts = {
    login: false,
    query: '',
    tag: '',
    account: '',
    limit: 8,
    target: 'http://localhost:3000',
    out: '',
    headless: false,
    profileDir: DEFAULT_PROFILE_DIR,
    help: false,
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--login') opts.login = true;
    else if (arg === '--headless') opts.headless = true;
    else if (arg.startsWith('--query=')) opts.query = arg.slice('--query='.length).trim();
    else if (arg.startsWith('--tag=')) opts.tag = arg.slice('--tag='.length).replace(/^#/, '').trim();
    else if (arg.startsWith('--account=')) opts.account = arg.slice('--account='.length).replace(/^@/, '').trim();
    else if (arg.startsWith('--limit=')) opts.limit = Math.min(20, Math.max(1, parseInt(arg.slice('--limit='.length), 10) || 8));
    else if (arg.startsWith('--target=')) opts.target = arg.slice('--target='.length).replace(/\/$/, '').trim();
    else if (arg.startsWith('--out=')) opts.out = arg.slice('--out='.length).trim();
    else if (arg.startsWith('--profile=')) opts.profileDir = arg.slice('--profile='.length).trim();
  }
  return opts;
}

function printHelp() {
  console.log(`IG Reels Local CDP Capture (Node v24 + Chromium CDP)

Opciones:
  --login                 Abre Chrome visible en instagram.com para iniciar sesión manualmente
  --query="<texto>"       Busca Reels por palabra clave en Instagram
  --tag="<hashtag>"       Busca Reels en /explore/tags/<hashtag>/
  --account="@<handle>"   Captura Reels de /<handle>/reels/
  --limit=<n>             Máximo de Reels a capturar (default: 8, máx: 20)
  --target=<url>          URL del backend Content Studio (default: http://localhost:3000)
  --out=<archivo.json>    Guarda copia local del JSON capturado
  --headless              Ejecuta en modo headless (solo si ya iniciaste sesión con --login)
  --profile=<ruta>        Directorio persistente del perfil Chrome
`);
}

function waitForDevToolsUrl(chrome, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let stderrBuf = '';
    const timer = setTimeout(() => reject(new Error(`Timeout esperando DevTools.\n${stderrBuf}`)), timeoutMs);
    const onData = (chunk) => {
      stderrBuf += chunk.toString('utf8');
      const m = stderrBuf.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) {
        clearTimeout(timer);
        chrome.stderr.off('data', onData);
        resolve(m[1]);
      }
    };
    chrome.stderr.on('data', onData);
    chrome.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Chromium terminó con código ${code}.\n${stderrBuf}`));
    });
  });
}

class SimpleCdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = sessionId ? { id, method, params, sessionId } : { id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function evalJs(client, sessionId, expression) {
  const res = await client.send(
    'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true },
    sessionId
  );
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.text || 'Error evaluando JS en página');
  }
  return res.result?.value;
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || (!opts.login && !opts.query && !opts.tag && !opts.account)) {
    printHelp();
    process.exit(opts.help ? 0 : 1);
  }

  fs.mkdirSync(opts.profileDir, { recursive: true });
  const browserPath = findBrowserExecutable();
  const chrome = spawn(
    browserPath,
    [
      ...(opts.headless && !opts.login ? ['--headless=new'] : []),
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1280,900',
      '--remote-debugging-port=0',
      `--user-data-dir=${opts.profileDir}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );

  let ws;
  try {
    const wsUrl = await waitForDevToolsUrl(chrome);
    ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });

    const client = new SimpleCdpClient(ws);
    const { targetInfos } = await client.send('Target.getTargets');
    const pageTarget = targetInfos.find((t) => t.type === 'page') || (await client.send('Target.createTarget', { url: 'about:blank' }));
    const targetId = pageTarget.targetId;
    const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });
    await client.send('Page.enable', {}, sessionId);
    await client.send('Runtime.enable', {}, sessionId);

    if (opts.login) {
      await client.send('Page.navigate', { url: 'https://www.instagram.com/' }, sessionId);
      console.log('🔐 Inicia sesión manualmente en la ventana abierta de Instagram.');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      await rl.question('Presiona ENTER aquí cuando ya hayas iniciado sesión para guardar el perfil y salir... ');
      rl.close();
      console.log(`✅ Perfil guardado en ${opts.profileDir}`);
      return;
    }

    let searchUrl = 'https://www.instagram.com/reels/';
    let sourceQuery = 'Reels';
    if (opts.account) {
      searchUrl = `https://www.instagram.com/${encodeURIComponent(opts.account)}/reels/`;
      sourceQuery = `@${opts.account}`;
    } else if (opts.tag) {
      searchUrl = `https://www.instagram.com/explore/tags/${encodeURIComponent(opts.tag)}/`;
      sourceQuery = `#${opts.tag}`;
    } else if (opts.query) {
      searchUrl = `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(opts.query)}`;
      sourceQuery = opts.query;
    }

    console.log(`🌐 Navegando a ${searchUrl}...`);
    await client.send('Page.navigate', { url: searchUrl }, sessionId);
    await sleep(4000);

    const currentUrl = await evalJs(client, sessionId, 'window.location.href');
    if (/\/accounts\/login|\/challenge/i.test(currentUrl)) {
      throw new Error(
        `Instagram solicitó inicio de sesión o verificación (${currentUrl}). Ejecuta primero: node scripts/ig-capture-cdp.mjs --login`
      );
    }

    await evalJs(client, sessionId, 'window.scrollBy(0, 900)');
    await sleep(2000);

    const reelLinks = await evalJs(
      client,
      sessionId,
      `(() => {
        const seen = new Set();
        const out = [];
        for (const a of document.querySelectorAll('a[href*="/reel/"]')) {
          const m = (a.getAttribute('href') || '').match(/\\/reel\\/([A-Za-z0-9_-]+)/);
          if (m && !seen.has(m[1])) {
            seen.add(m[1]);
            out.push({ shortcode: m[1], reelUrl: 'https://www.instagram.com/reel/' + m[1] + '/' });
          }
        }
        return out.slice(0, ${opts.limit});
      })()`
    );

    if (!Array.isArray(reelLinks) || reelLinks.length === 0) {
      console.warn('⚠️ No se detectaron enlaces /reel/ en la vista actual.');
      return;
    }

    console.log(`🔎 Encontrados ${reelLinks.length} Reels. Capturando metadatos y primer frame...`);
    const captured = [];

    for (const item of reelLinks) {
      await client.send('Page.navigate', { url: item.reelUrl }, sessionId);
      await sleep(2800);

      const urlNow = await evalJs(client, sessionId, 'window.location.href');
      if (/\/accounts\/login|\/challenge/i.test(urlNow)) {
        console.warn(`⚠️ Detenido por verificación/login en ${urlNow}`);
        break;
      }

      const meta = await evalJs(
        client,
        sessionId,
        `(() => {
          const root = document.querySelector('main') || document.body;
          const vid = root.querySelector('video');
          if (vid) vid.pause();
          const rect = vid ? vid.getBoundingClientRect() : null;
          const authorLink = root.querySelector('header a[href^="/"], a[role="link"][href^="/"]');
          const authorRaw = authorLink ? (authorLink.getAttribute('href') || authorLink.textContent || '') : '';
          const authorHandle = authorRaw.replace(/\\//g, '').trim();
          const candidates = Array.from(root.querySelectorAll('h1, span[dir="auto"], div[dir="auto"]'))
            .map((el) => (el.innerText || '').trim())
            .filter((t) => t.length > 15);
          const caption = candidates[0] || '';
          const audioEl = root.querySelector('a[href*="/audio/"]');
          const audioName = audioEl ? audioEl.innerText.trim() : 'Audio original';
          const textBlob = root.innerText || '';
          const likesMatch = textBlob.match(/([0-9.,]+[KMB]?)\\s*(Me gusta|likes?)/i);
          const commentsMatch = textBlob.match(/([0-9.,]+[KMB]?)\\s*(comentarios?|comments?)/i);
          const viewsMatch = textBlob.match(/([0-9.,]+[KMB]?)\\s*(reproducciones?|views?|plays?)/i);
          return {
            authorHandle,
            caption,
            audioName,
            likeCount: likesMatch ? likesMatch[1] : 0,
            commentCount: commentsMatch ? commentsMatch[1] : 0,
            viewCount: viewsMatch ? viewsMatch[1] : 0,
            clip: rect && rect.width > 40 && rect.height > 40
              ? { x: Math.max(0, rect.x), y: Math.max(0, rect.y), width: rect.width, height: rect.height, scale: 1 }
              : null
          };
        })()`
      );

      let frameImageBase64 = '';
      try {
        const shot = await client.send(
          'Page.captureScreenshot',
          {
            format: 'jpeg',
            quality: 60,
            ...(meta?.clip ? { clip: meta.clip } : {}),
          },
          sessionId
        );
        if (shot?.data) {
          frameImageBase64 = `data:image/jpeg;base64,${shot.data}`;
        }
      } catch (shotErr) {
        console.warn(`⚠️ No se pudo capturar screenshot de ${item.shortcode}: ${shotErr.message}`);
      }

      captured.push({
        shortcode: item.shortcode,
        reelUrl: item.reelUrl,
        authorHandle: meta?.authorHandle || opts.account || '@instagram_creator',
        caption: meta?.caption || '',
        audioName: meta?.audioName || 'Audio original',
        likeCount: meta?.likeCount || 0,
        commentCount: meta?.commentCount || 0,
        viewCount: meta?.viewCount || 0,
        frameImageBase64,
      });
      console.log(`  ✓ Capturado ${item.shortcode} (${meta?.authorHandle || 'autor'})`);
    }

    if (opts.out) {
      fs.writeFileSync(opts.out, JSON.stringify({ sourceQuery, capturedVia: 'cdp_local', reels: captured }, null, 2));
      console.log(`💾 Copia guardada en ${opts.out}`);
    }

    if (captured.length > 0) {
      console.log(`🚀 Enviando ${captured.length} Reels a ${opts.target}/api/instagram/reels/capture...`);
      const res = await fetch(`${opts.target}/api/instagram/reels/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceQuery,
          capturedVia: 'cdp_local',
          reels: captured,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      console.log(`✅ ${data.count} Reels procesados y guardados en Content Studio.`);
    }
  } finally {
    try { ws?.close(); } catch {}
    try { chrome.kill('SIGTERM'); } catch {}
  }
}

run().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
