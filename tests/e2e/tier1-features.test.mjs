import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launchBrowser } from './lib/cdp.mjs';
import {
  CSV_HEADERS_COUNT,
  DEFAULT_IG_ACCOUNT,
  DEFAULT_NICHE,
  M3_TOKENS,
  ROUTES,
  SELECTORS,
  STATUS_LABELS,
  STORAGE_KEYS,
  VALID_STATUSES,
  VIEWPORTS,
  WEEK_LABELS,
  makeMockRoadmap,
  makeMockVideos,
  makeUniqueNiche,
  parseCssColor,
  parseRfc4180Csv,
  relativeLuminance,
} from './lib/fixtures.mjs';
import {
  assertNoHorizontalOverflow,
  confirmDialogAccept,
  confirmDialogCancel,
  loadNiche,
  openAppPage,
  selectDay,
  setDayStatus,
  switchTab,
  waitForRoadmapHydrated,
} from './lib/helpers.mjs';
import { startServer } from './lib/server.mjs';

let server;
let browser;

before(async () => {
  server = await startServer();
  browser = await launchBrowser();
});

after(async () => {
  await browser?.close();
  await server?.close();
});

describe('Tier 1: Feature Coverage (F1–F14, 77 cases)', () => {
  // =========================================================================
  // F1: App Shell, Navigation Rail/Bar & Top App Bar (6 cases)
  // =========================================================================
  describe('F1: App Shell, Navigation Rail/Bar & Top App Bar', () => {
    test('T1-F1-01: Boot app shell & Spanish document landmarks', async () => {
      const res = await fetch(`${server.baseUrl}/`);
      assert.equal(res.status, 200);

      const page = await openAppPage(browser, server.baseUrl);
      try {
        const doc = await page.evaluate(() => ({
          lang: document.documentElement.lang,
          headerText: document.querySelector('header')?.textContent || '',
          headerHeight: document.querySelector('header')?.getBoundingClientRect().height || 0,
        }));

        assert.equal(doc.lang, 'es');
        assert.match(doc.headerText, /Content Studio/i);
        assert.ok(doc.headerHeight >= 52 && doc.headerHeight <= 80, `Unexpected Top App Bar height: ${doc.headerHeight}px`);

        assert.equal(await page.getAttr(SELECTORS.tabRoadmap, 'aria-selected'), 'true');
        assert.equal(await page.getAttr(SELECTORS.tabYoutube, 'aria-selected'), 'false');
        assert.equal(await page.getAttr(SELECTORS.tabOracle, 'aria-selected'), 'false');

        assert.equal(await page.isVisible(SELECTORS.viewRoadmap), true);
        assert.equal(await page.isVisible(SELECTORS.viewYoutube), false);
        assert.equal(await page.isVisible(SELECTORS.viewOracle), false);

        page.assertNoRuntimeErrors('T1-F1-01');
      } finally {
        await page.close();
      }
    });

    test('T1-F1-02: Desktop M3 Navigation Rail (>=840px)', async () => {
      const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.DESKTOP });
      try {
        assert.equal(await page.count(SELECTORS.tabRoadmap), 1);
        assert.equal(await page.count(SELECTORS.tabYoutube), 1);
        assert.equal(await page.count(SELECTORS.tabOracle), 1);

        const navInfo = await page.evaluate(() => {
          const tab = document.querySelector('#tab-roadmap');
          const nav = tab?.closest('nav');
          const rect = nav ? nav.getBoundingClientRect() : null;
          return {
            hasNav: Boolean(nav),
            rect: rect ? { left: rect.left, width: rect.width, height: rect.height } : null,
            text: nav?.textContent || '',
          };
        });

        assert.equal(navInfo.hasNav, true, 'Navigation tabs must live inside a <nav> landmark');
        assert.ok(navInfo.rect.left <= 24, `Desktop nav rail should dock on left, got left=${navInfo.rect.left}`);
        assert.ok(navInfo.rect.width >= 64 && navInfo.rect.width <= 120, `Rail width expected ~80px, got ${navInfo.rect.width}`);
        assert.ok(navInfo.rect.height > navInfo.rect.width, 'Desktop nav rail must be vertical (height > width)');
        assert.match(navInfo.text, /Roadmap/i);
        assert.match(navInfo.text, /YouTube/i);
        assert.match(navInfo.text, /Oráculo/i);

        await assertNoHorizontalOverflow(page, 'T1-F1-02');
        page.assertNoRuntimeErrors('T1-F1-02');
      } finally {
        await page.close();
      }
    });

    test('T1-F1-03: Mobile M3 Bottom Navigation Bar (<840px)', async () => {
      const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.MOBILE });
      try {
        const navRect = await page.evaluate(() => {
          const nav = document.querySelector('#tab-roadmap')?.closest('nav');
          if (!nav) return null;
          const r = nav.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, width: r.width, height: r.height };
        });

        assert.ok(navRect, 'Mobile nav element missing');
        assert.ok(navRect.bottom >= 820, `Mobile nav bar must sit at bottom, got bottom=${navRect.bottom}`);
        assert.ok(navRect.width >= 350 && navRect.height >= 56 && navRect.height <= 96, `Unexpected mobile nav bar size: ${JSON.stringify(navRect)}`);

        assert.equal(await page.isVisible(SELECTORS.tabRoadmap), true);
        assert.equal(await page.isVisible(SELECTORS.tabYoutube), true);
        assert.equal(await page.isVisible(SELECTORS.tabOracle), true);

        await assertNoHorizontalOverflow(page, 'T1-F1-03');
        page.assertNoRuntimeErrors('T1-F1-03');
      } finally {
        await page.close();
      }
    });

    test('T1-F1-04: Tab switching updates panels, ARIA & URL hash', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await switchTab(page, 'youtube');
        assert.equal(await page.evaluate(() => window.location.hash), '#youtube');
        assert.equal(await page.getAttr(SELECTORS.tabYoutube, 'aria-selected'), 'true');
        assert.equal(await page.getAttr(SELECTORS.tabRoadmap, 'aria-selected'), 'false');
        assert.equal(await page.isVisible(SELECTORS.viewYoutube), true);
        assert.equal(await page.isVisible(SELECTORS.viewRoadmap), false);
        assert.equal(await page.isVisible(SELECTORS.viewOracle), false);

        await switchTab(page, 'oracle');
        assert.equal(await page.evaluate(() => window.location.hash), '#oracle');
        assert.equal(await page.getAttr(SELECTORS.tabOracle, 'aria-selected'), 'true');
        assert.equal(await page.getAttr(SELECTORS.tabYoutube, 'aria-selected'), 'false');
        assert.equal(await page.isVisible(SELECTORS.viewOracle), true);
        assert.equal(await page.isVisible(SELECTORS.viewYoutube), false);

        page.assertNoRuntimeErrors('T1-F1-04');
      } finally {
        await page.close();
      }
    });

    test('T1-F1-05: Deep-link boot via URL hash (#oracle & #youtube)', async () => {
      const oraclePage = await openAppPage(browser, server.baseUrl, { pathAndHash: '/#oracle', waitForCards: false });
      try {
        await oraclePage.waitForSelector(SELECTORS.viewOracle, { visible: true });
        assert.equal(await oraclePage.getAttr(SELECTORS.tabOracle, 'aria-selected'), 'true');
        assert.equal(await oraclePage.isVisible(SELECTORS.viewRoadmap), false);
        assert.equal(await oraclePage.isVisible(SELECTORS.viewYoutube), false);
        oraclePage.assertNoRuntimeErrors('T1-F1-05-oracle');
      } finally {
        await oraclePage.close();
      }

      const ytPage = await openAppPage(browser, server.baseUrl, { pathAndHash: '/#youtube', waitForCards: false });
      try {
        await ytPage.waitForSelector(SELECTORS.viewYoutube, { visible: true });
        assert.equal(await ytPage.getAttr(SELECTORS.tabYoutube, 'aria-selected'), 'true');
        assert.equal(await ytPage.isVisible(SELECTORS.viewRoadmap), false);
        assert.equal(await ytPage.isVisible(SELECTORS.viewOracle), false);
        ytPage.assertNoRuntimeErrors('T1-F1-05-youtube');
      } finally {
        await ytPage.close();
      }
    });

    test('T1-F1-06: Browser history Back & hashchange sync', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await switchTab(page, 'youtube');
        await switchTab(page, 'oracle');
        assert.equal(await page.evaluate(() => window.location.hash), '#oracle');

        await page.evaluate(() => window.history.back());
        await page.waitForFunction(() => window.location.hash === '#youtube');
        await page.waitForSelector(SELECTORS.viewYoutube, { visible: true });

        assert.equal(await page.getAttr(SELECTORS.tabYoutube, 'aria-selected'), 'true');
        assert.equal(await page.isVisible(SELECTORS.viewOracle), false);
        page.assertNoRuntimeErrors('T1-F1-06');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F2: M3 Design System, Tonal Surfaces & Light/Dark Theme (6 cases)
  // =========================================================================
  describe('F2: M3 Design System, Tonal Surfaces & Light/Dark Theme', () => {
    test('T1-F2-01: Complete M3 CSS token registry & Light Blue seed', async () => {
      const page = await openAppPage(browser, server.baseUrl, { colorScheme: 'light' });
      try {
        const theme = await page.evaluate(() => document.documentElement.dataset.theme);
        assert.equal(theme, 'light');

        const allTokens = [
          ...M3_TOKENS.colors,
          ...M3_TOKENS.statusColors,
          ...M3_TOKENS.shapes,
          ...M3_TOKENS.elevations,
          ...M3_TOKENS.motion,
          ...M3_TOKENS.state,
        ];
        const values = await page.evaluate((names) => {
          const cs = window.getComputedStyle(document.documentElement);
          const out = {};
          for (const n of names) out[n] = cs.getPropertyValue(n).trim();
          return out;
        }, allTokens);

        for (const token of allTokens) {
          assert.ok(values[token] && values[token].length > 0, `Missing M3 CSS token: ${token}`);
        }

        const primaryRgb = parseCssColor(values['--md-sys-color-primary']);
        assert.deepEqual({ r: primaryRgb?.r, g: primaryRgb?.g, b: primaryRgb?.b }, { r: 11, g: 87, b: 208 }, `Expected Google Blue #0B57D0 in light mode, got ${values['--md-sys-color-primary']}`);

        const surfaceContainerVals = new Set([
          values['--md-sys-color-surface-container-lowest'],
          values['--md-sys-color-surface-container-low'],
          values['--md-sys-color-surface-container'],
          values['--md-sys-color-surface-container-high'],
          values['--md-sys-color-surface-container-highest'],
        ]);
        assert.ok(surfaceContainerVals.size >= 4, 'Surface container levels should have distinct tonal colors');

        page.assertNoRuntimeErrors('T1-F2-01');
      } finally {
        await page.close();
      }
    });

    test('T1-F2-02: Theme toggle #btnThemeToggle switches Light <-> Dark', async () => {
      const page = await openAppPage(browser, server.baseUrl, { colorScheme: 'light' });
      try {
        await page.click(SELECTORS.btnThemeToggle);
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');

        assert.equal(await page.getLocalStorage(STORAGE_KEYS.THEME), 'dark');
        const darkPrimary = parseCssColor(await page.getCssVar('--md-sys-color-primary'));
        assert.deepEqual({ r: darkPrimary?.r, g: darkPrimary?.g, b: darkPrimary?.b }, { r: 168, g: 199, b: 250 });

        const darkBg = parseCssColor(await page.getComputedStyle('body', 'background-color'));
        assert.ok(relativeLuminance(darkBg) < 0.2, `Expected dark body background, got ${JSON.stringify(darkBg)}`);

        await page.click(SELECTORS.btnThemeToggle);
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
        assert.equal(await page.getLocalStorage(STORAGE_KEYS.THEME), 'light');

        const lightBg = parseCssColor(await page.getComputedStyle('body', 'background-color'));
        assert.ok(relativeLuminance(lightBg) > 0.75, `Expected light body background, got ${JSON.stringify(lightBg)}`);

        page.assertNoRuntimeErrors('T1-F2-02');
      } finally {
        await page.close();
      }
    });

    test('T1-F2-03: Theme persistence across reload', async () => {
      const page = await openAppPage(browser, server.baseUrl, { colorScheme: 'light' });
      try {
        await page.click(SELECTORS.btnThemeToggle);
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');

        await page.reload();
        await waitForRoadmapHydrated(page);

        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
        assert.equal(await page.getLocalStorage(STORAGE_KEYS.THEME), 'dark');
        const darkBg = parseCssColor(await page.getComputedStyle('body', 'background-color'));
        assert.ok(relativeLuminance(darkBg) < 0.2, 'Dark surface background must persist after reload');

        page.assertNoRuntimeErrors('T1-F2-03');
      } finally {
        await page.close();
      }
    });

    test('T1-F2-04: M3 Typography & Material Symbols Rounded fonts', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        const fontCheck = await page.evaluate(async () => {
          await document.fonts.ready;
          const bodyFont = window.getComputedStyle(document.body).fontFamily;
          const promptFont = window.getComputedStyle(document.querySelector('#inspectorImagePrompt')).fontFamily;
          const iconEl = document.querySelector('.material-symbols-rounded');
          const iconFont = iconEl ? window.getComputedStyle(iconEl).fontFamily : '';
          const fontLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((l) => l.href);
          return { bodyFont, promptFont, iconFont, hasIconEl: Boolean(iconEl), fontLinks };
        });

        assert.match(fontCheck.bodyFont, /Roboto|Google Sans/i);
        assert.match(fontCheck.promptFont, /Roboto Mono/i);
        assert.equal(fontCheck.hasIconEl, true, 'Expected Material Symbols Rounded icon element in DOM');
        assert.match(fontCheck.iconFont, /Material Symbols Rounded/i);
        assert.ok(fontCheck.fontLinks.some((h) => h.includes('fonts.googleapis.com')), 'Expected Google Fonts stylesheet link');

        page.assertNoRuntimeErrors('T1-F2-04');
      } finally {
        await page.close();
      }
    });

    test('T1-F2-05: M3 Shape Scale & Tonal Container Separation', async () => {
      const page = await openAppPage(browser, server.baseUrl, { colorScheme: 'light' });
      try {
        const chipRadius = parseFloat(await page.getComputedStyle(SELECTORS.btnWeekAll, 'border-top-left-radius'));
        const ctaRadius = parseFloat(await page.getComputedStyle(SELECTORS.btnGenerateRoadmap, 'border-top-left-radius'));
        const cardRadius = parseFloat(await page.getComputedStyle(SELECTORS.dayCardByNum(1), 'border-top-left-radius'));
        const cardBg = await page.getComputedStyle(SELECTORS.dayCardByNum(1), 'background-color');
        const listBg = await page.getComputedStyle('body', 'background-color');

        assert.ok(chipRadius >= 8, `Filter chip radius should follow M3 shape scale (>=8px), got ${chipRadius}px`);
        assert.ok(ctaRadius >= 16, `Primary CTA should have pill radius (>=16px), got ${ctaRadius}px`);
        assert.ok(cardRadius >= 12, `Day card should have M3 medium/large radius (>=12px), got ${cardRadius}px`);
        assert.notEqual(cardBg, listBg, 'Day card must separate from page surface via tonal color');

        await page.click(SELECTORS.btnGenerateRoadmap);
        await page.waitForSelector(SELECTORS.m3ConfirmDialog, { visible: true });
        const dialogRadius = parseFloat(await page.getComputedStyle(SELECTORS.m3ConfirmDialog, 'border-top-left-radius'));
        assert.ok(dialogRadius >= 24, `M3 dialog must use extra-large corner radius (~28px), got ${dialogRadius}px`);
        await confirmDialogCancel(page);

        page.assertNoRuntimeErrors('T1-F2-05');
      } finally {
        await page.close();
      }
    });

    test('T1-F2-06: OS prefers-color-scheme: dark automatic fallback', async () => {
      const page = await openAppPage(browser, server.baseUrl, { colorScheme: 'dark' });
      try {
        const theme = await page.evaluate(() => document.documentElement.dataset.theme);
        assert.equal(theme, 'dark');
        const bg = parseCssColor(await page.getComputedStyle('body', 'background-color'));
        assert.ok(relativeLuminance(bg) < 0.2, `Expected dark background on prefers-color-scheme: dark, got ${JSON.stringify(bg)}`);
        page.assertNoRuntimeErrors('T1-F2-06');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F3: Live System & Source Status Indicators (6 cases)
  // =========================================================================
  describe('F3: Live System & Source Status Indicators', () => {
    test('T1-F3-01: Live Health Badge (#statusHealthBadge) reflects GET /health 200', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await page.waitForFunction(
          (sel) => (document.querySelector(sel)?.textContent || '').includes('Servidor OK'),
          [SELECTORS.statusHealthBadge]
        );
        assert.equal(await page.isVisible(SELECTORS.statusHealthBadge), true);
        page.assertNoRuntimeErrors('T1-F3-01');
      } finally {
        await page.close();
      }
    });

    test('T1-F3-02: Oracle Badge (#statusOracleBadge) ready state before first run', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/oracle/status', async (route) => {
            await route.fulfill({
              status: 200,
              body: {
                success: true,
                lastExecution: 'Aún no se ha ejecutado ningún ciclo. Puedes dispararlo con POST /api/oracle/run-now',
              },
            });
          });
        },
      });
      try {
        await page.waitForFunction(
          (sel) => (document.querySelector(sel)?.textContent || '').includes('Oráculo listo'),
          [SELECTORS.statusOracleBadge]
        );
        assert.equal(await page.isVisible(SELECTORS.statusOracleBadge), true);
        page.assertNoRuntimeErrors('T1-F3-02');
      } finally {
        await page.close();
      }
    });

    test('T1-F3-03: Oracle Badge (#statusOracleBadge) synced state when completed report exists', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/oracle/status', async (route) => {
            await route.fulfill({
              status: 200,
              body: {
                success: true,
                lastExecution: {
                  id: 'exec-1',
                  status: 'completado',
                  timestamp: '2026-11-14T20:00:00.000Z',
                  details: 'OK',
                },
              },
            });
          });
        },
      });
      try {
        await page.waitForFunction(
          (sel) => (document.querySelector(sel)?.textContent || '').includes('Oráculo sincronizado'),
          [SELECTORS.statusOracleBadge]
        );
        page.assertNoRuntimeErrors('T1-F3-03');
      } finally {
        await page.close();
      }
    });

    test('T1-F3-04: Data Source Truth Badge (#statusSourceBadge)', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        assert.equal(await page.isVisible(SELECTORS.statusSourceBadge), true);
        const text = await page.getText(SELECTORS.statusSourceBadge);
        const title = await page.getAttr(SELECTORS.statusSourceBadge, 'title');
        const ariaLabel = await page.getAttr(SELECTORS.statusSourceBadge, 'aria-label');
        assert.match(text, /YouTube Real/i);
        assert.match(text, /IG Simulado/i);
        assert.ok((title && title.length > 5) || (ariaLabel && ariaLabel.length > 5), 'Source badge must expose tooltip/aria-label explanation');
        page.assertNoRuntimeErrors('T1-F3-04');
      } finally {
        await page.close();
      }
    });

    test('T1-F3-05: Status badges refresh dynamically after Oracle execution', async () => {
      let oracleRan = false;
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/oracle/status', async (route) => {
            await route.fulfill({
              status: 200,
              body: {
                success: true,
                lastExecution: oracleRan
                  ? { status: 'completado', timestamp: '2026-11-14T21:00:00.000Z', details: '30 contenidos generados' }
                  : 'Aún no se ha ejecutado ningún ciclo.',
              },
            });
          });
          await p.interceptRoute('/api/oracle/run-now', async (route) => {
            oracleRan = true;
            await route.fulfill({
              status: 200,
              body: {
                success: true,
                report: {
                  id: 'oracle-run-1',
                  status: 'completado',
                  timestamp: '2026-11-14T21:00:00.000Z',
                  details: '30 contenidos generados',
                },
              },
            });
          });
        },
      });
      try {
        await page.waitForFunction(
          (sel) => (document.querySelector(sel)?.textContent || '').includes('Oráculo listo'),
          [SELECTORS.statusOracleBadge]
        );

        await page.click(SELECTORS.btnRunOracle);
        await confirmDialogAccept(page);

        await page.waitForFunction(
          (sel) => (document.querySelector(sel)?.textContent || '').includes('Oráculo sincronizado'),
          [SELECTORS.statusOracleBadge]
        );
        const healthText = await page.getText(SELECTORS.statusHealthBadge);
        assert.match(healthText, /Servidor OK/i);
        page.assertNoRuntimeErrors('T1-F3-05');
      } finally {
        await page.close();
      }
    });

    test('T1-F3-06: Direct REST contract check for /health and /api/oracle/status', async () => {
      const healthRes = await fetch(`${server.baseUrl}${ROUTES.HEALTH}`);
      assert.equal(healthRes.status, 200);
      const healthBody = await healthRes.json();
      assert.equal(healthBody.status, 'ok');
      assert.ok(!Number.isNaN(Date.parse(healthBody.timestamp)), 'Invalid /health timestamp');
      assert.equal(typeof healthBody.uptime, 'number');
      assert.ok(healthBody.uptime >= 0);

      const oracleRes = await fetch(`${server.baseUrl}${ROUTES.ORACLE_STATUS}`);
      assert.equal(oracleRes.status, 200);
      const oracleBody = await oracleRes.json();
      assert.equal(oracleBody.success, true);
      assert.ok(oracleBody.lastExecution !== undefined);
    });
  });

  // =========================================================================
  // F4: Roadmap Command Bar, Load, Generate & AI Oracle (6 cases)
  // =========================================================================
  describe('F4: Roadmap Command Bar, Load, Generate & AI Oracle', () => {
    test('T1-F4-01: Default command bar inputs & boot auto-hydration', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        assert.equal(await page.getValue(SELECTORS.nicheInput), DEFAULT_NICHE);
        assert.equal(await page.getValue(SELECTORS.igAccountInput), DEFAULT_IG_ACCOUNT);
        assert.equal(await page.isVisible(SELECTORS.roadmapLinearProgress), false);
        assert.equal(await page.count(SELECTORS.dayCard), 30);
        assert.equal(await page.isVisible(SELECTORS.roadmapSourceNotice), false);
        page.assertNoRuntimeErrors('T1-F4-01');
      } finally {
        await page.close();
      }
    });

    test('T1-F4-02: Load niche via #btnLoadRoadmap & Enter key in #nicheInput', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        const niche1 = makeUniqueNiche('Fitness');
        page.clearRecordedRequests();
        await loadNiche(page, niche1);

        const req1 = page.getRecordedRequests().find((r) => r.url.includes('/api/roadmap?') && r.url.includes(encodeURIComponent(niche1)));
        assert.ok(req1, 'Expected GET /api/roadmap?niche=... after clicking Cargar');
        assert.equal(await page.count(SELECTORS.dayCard), 30);

        const niche2 = makeUniqueNiche('Finanzas');
        page.clearRecordedRequests();
        await page.fill(SELECTORS.nicheInput, niche2);
        await page.pressKey('Enter');
        // Wait until the GET request for niche2 has arrived
        const deadline = Date.now() + 5000;
        let req2;
        while (Date.now() < deadline) {
          req2 = page.getRecordedRequests().find((r) => r.url.includes('/api/roadmap?') && r.url.includes(encodeURIComponent(niche2)));
          if (req2) break;
          await new Promise((r) => setTimeout(r, 50));
        }
        assert.ok(req2, 'Expected GET /api/roadmap?niche=... after pressing Enter in #nicheInput');
        assert.equal(await page.count(SELECTORS.dayCard), 30);

        page.assertNoRuntimeErrors('T1-F4-02');
      } finally {
        await page.close();
      }
    });

    test('T1-F4-03: Generate 30 days (#btnGenerateRoadmap) with M3 Confirm Dialog & UUID re-hydration', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        const niche = makeUniqueNiche('GenNiche');
        await page.fill(SELECTORS.nicheInput, niche);
        page.clearRecordedRequests();

        await page.click(SELECTORS.btnGenerateRoadmap);
        await page.waitForSelector(SELECTORS.m3ConfirmDialog, { visible: true });
        assert.ok((await page.getText(SELECTORS.m3ConfirmTitle)).length > 0);
        assert.ok((await page.getText(SELECTORS.m3ConfirmBody)).length > 0);

        await confirmDialogAccept(page);

        await page.waitForFunction(
          (sel) => (document.querySelector(sel)?.textContent || '').trim().length > 0,
          [SELECTORS.toastContainer]
        );
        await waitForRoadmapHydrated(page);

        const apiCalls = page
          .getRecordedRequests()
          .filter((r) => r.url.includes('/api/roadmap'));
        const postIdx = apiCalls.findIndex((r) => r.method === 'POST' && r.url.includes('/api/roadmap/generate'));
        const getIdx = apiCalls.findIndex((r, idx) => idx > postIdx && r.method === 'GET' && r.url.includes('/api/roadmap?'));
        assert.ok(postIdx !== -1, 'Expected POST /api/roadmap/generate');
        assert.ok(getIdx !== -1, 'Expected follow-up GET /api/roadmap?niche=... to hydrate UUIDs');

        assert.equal(await page.count(SELECTORS.dayCard), 30);
        assert.equal(await page.getAttr(SELECTORS.dayCardByNum(1), 'aria-current'), 'true');
        page.assertNoRuntimeErrors('T1-F4-03');
      } finally {
        await page.close();
      }
    });

    test('T1-F4-04: Cancel regeneration in #m3ConfirmDialog (#m3ConfirmCancel)', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        const beforeTitle = await page.getText(`${SELECTORS.dayCardByNum(1)} .day-card-title, ${SELECTORS.dayCardByNum(1)}`);
        page.clearRecordedRequests();

        await page.click(SELECTORS.btnGenerateRoadmap);
        await confirmDialogCancel(page);

        await new Promise((r) => setTimeout(r, 150));
        const postCalls = page.getRecordedRequests().filter((r) => r.url.includes('/api/roadmap/generate'));
        assert.equal(postCalls.length, 0, 'Canceling confirm dialog must not trigger POST /api/roadmap/generate');
        assert.equal(await page.count(SELECTORS.dayCard), 30);
        assert.equal(await page.getText(`${SELECTORS.dayCardByNum(1)} .day-card-title, ${SELECTORS.dayCardByNum(1)}`), beforeTitle);
        page.assertNoRuntimeErrors('T1-F4-04');
      } finally {
        await page.close();
      }
    });

    test('T1-F4-05: Run AI Oracle from Command Bar (#btnRunOracle)', async () => {
      let capturedBody = null;
      const niche = makeUniqueNiche('OracleCmd');
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/oracle/run-now', async (route) => {
            capturedBody = route.postData ? JSON.parse(route.postData) : null;
            await route.fulfill({
              status: 200,
              body: {
                success: true,
                report: {
                  id: 'cmd-oracle-1',
                  status: 'completado',
                  timestamp: new Date().toISOString(),
                  niche,
                  instagramAccount: '@mi_cuenta',
                  details: '30 contenidos generados',
                },
              },
            });
          });
        },
      });
      try {
        await page.fill(SELECTORS.nicheInput, niche);
        await page.fill(SELECTORS.igAccountInput, '@mi_cuenta');
        await page.click(SELECTORS.btnRunOracle);
        await confirmDialogAccept(page);

        await page.waitForFunction(() => Boolean(document.querySelector('#toastContainer')?.textContent?.trim()));
        assert.deepEqual(capturedBody, { niche, instagramAccount: '@mi_cuenta' });
        assert.equal(await page.isVisible(SELECTORS.roadmapLinearProgress), false);
        assert.equal(await page.count(SELECTORS.dayCard), 30);
        page.assertNoRuntimeErrors('T1-F4-05');
      } finally {
        await page.close();
      }
    });

    test('T1-F4-06: Direct REST contract for /api/roadmap, /api/roadmap/generate, /api/oracle/run-now', async () => {
      const testNiche = makeUniqueNiche('RestContract');

      const getRes = await fetch(`${server.baseUrl}${ROUTES.ROADMAP}?niche=${encodeURIComponent(testNiche)}`);
      assert.equal(getRes.status, 200);
      const getJson = await getRes.json();
      assert.equal(getJson.success, true);
      assert.equal(getJson.count, 30);
      assert.equal(getJson.niche, testNiche);
      assert.equal(getJson.roadmap.length, 30);

      const genRes = await fetch(`${server.baseUrl}${ROUTES.ROADMAP_GENERATE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: testNiche }),
      });
      assert.equal(genRes.status, 200);
      const genJson = await genRes.json();
      assert.equal(genJson.success, true);
      assert.equal(genJson.count, 30);
      assert.ok(genJson.message.includes(testNiche));

      const oracleRes = await fetch(`${server.baseUrl}${ROUTES.ORACLE_RUN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: testNiche, instagramAccount: '@test' }),
      });
      assert.equal(oracleRes.status, 200);
      const oracleJson = await oracleRes.json();
      assert.equal(typeof oracleJson.report, 'object');
      assert.ok(oracleJson.report !== null);
    });
  });

  // =========================================================================
  // F5: Roadmap CSV & JSON Export (6 cases)
  // =========================================================================
  describe('F5: Roadmap CSV & JSON Export', () => {
    test('T1-F5-01: CSV export download (#btnExportCsv) UTF-8 BOM & 14 columns', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        const dl = await page.waitForDownload(() => page.click(SELECTORS.btnExportCsv));
        assert.match(dl.suggestedFilename, /^roadmap_30_dias_.*\.csv$/);

        const parsed = parseRfc4180Csv(dl.buffer);
        assert.equal(parsed.hasBom, true, 'CSV export must begin with UTF-8 BOM');
        assert.equal(parsed.rows.length, 31, 'Expected 1 header row + 30 data rows');
        for (const [idx, row] of parsed.rows.entries()) {
          assert.equal(row.length, CSV_HEADERS_COUNT, `CSV row ${idx} expected ${CSV_HEADERS_COUNT} columns, got ${row.length}`);
        }
        page.assertNoRuntimeErrors('T1-F5-01');
      } finally {
        await page.close();
      }
    });

    test('T1-F5-02: JSON export download (#btnExportJson) pretty format & schema', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        const dl = await page.waitForDownload(() => page.click(SELECTORS.btnExportJson));
        assert.match(dl.suggestedFilename, /^roadmap_30_dias_.*\.json$/);
        assert.ok(dl.content.includes('\n  '), 'JSON export must be pretty-printed');

        const items = JSON.parse(dl.content);
        assert.equal(Array.isArray(items), true);
        assert.equal(items.length, 30);

        const requiredKeys = [
          'day_number',
          'week_number',
          'content_pillar',
          'format',
          'title',
          'hook',
          'script',
          'image_prompt',
          'caption',
          'hashtags',
          'status',
          'niche',
        ];
        for (const key of requiredKeys) {
          assert.ok(key in items[0], `JSON export item missing key "${key}"`);
        }
        page.assertNoRuntimeErrors('T1-F5-02');
      } finally {
        await page.close();
      }
    });

    test('T1-F5-03: Exports merge localStorage draft overrides', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await selectDay(page, 1);
        await page.click(SELECTORS.btnToggleEditMode);
        await page.fill(SELECTORS.editHookInput, 'Hook Editado Export');
        await page.fill(SELECTORS.editCaptionInput, 'Caption Editado Export');
        await page.click(SELECTORS.btnSaveDraft);

        const csvDl = await page.waitForDownload(() => page.click(SELECTORS.btnExportCsv));
        const { rows } = parseRfc4180Csv(csvDl.buffer);
        assert.ok(rows[1].includes('Hook Editado Export'), 'CSV export must merge local draft hook');
        assert.ok(rows[1].includes('Caption Editado Export'), 'CSV export must merge local draft caption');

        const jsonDl = await page.waitForDownload(() => page.click(SELECTORS.btnExportJson));
        const items = JSON.parse(jsonDl.content);
        assert.equal(items[0].hook, 'Hook Editado Export');
        assert.equal(items[0].caption, 'Caption Editado Export');
        page.assertNoRuntimeErrors('T1-F5-03');
      } finally {
        await page.close();
      }
    });

    test('T1-F5-04: Exports reflect live status transitions', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await loadNiche(page, makeUniqueNiche('ExportStatus'));
        await setDayStatus(page, 2, 'grabado');
        await setDayStatus(page, 3, 'publicado');

        const csvDl = await page.waitForDownload(() => page.click(SELECTORS.btnExportCsv));
        const { rows } = parseRfc4180Csv(csvDl.buffer);
        assert.ok(rows[2].includes('grabado'), 'CSV row 2 should show status grabado');
        assert.ok(rows[3].includes('publicado'), 'CSV row 3 should show status publicado');

        const jsonDl = await page.waitForDownload(() => page.click(SELECTORS.btnExportJson));
        const items = JSON.parse(jsonDl.content);
        assert.equal(items.find((d) => d.day_number === 2)?.status, 'grabado');
        assert.equal(items.find((d) => d.day_number === 3)?.status, 'publicado');
        page.assertNoRuntimeErrors('T1-F5-04');
      } finally {
        await page.close();
      }
    });

    test('T1-F5-05: M3 Snackbar confirmation on CSV & JSON export', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await page.waitForDownload(() => page.click(SELECTORS.btnExportCsv));
        await page.waitForFunction(() => (document.querySelector('#toastContainer')?.textContent || '').trim().length > 0);
        const csvToast = await page.getText(SELECTORS.toastContainer);
        assert.match(csvToast, /CSV|export/i);

        await page.waitForDownload(() => page.click(SELECTORS.btnExportJson));
        await page.waitForFunction(() => /JSON/i.test(document.querySelector('#toastContainer')?.textContent || ''));
        page.assertNoRuntimeErrors('T1-F5-05');
      } finally {
        await page.close();
      }
    });

    test('T1-F5-06: Export filename slugification for niche with accents/spaces', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await loadNiche(page, 'Diseño Gráfico & IA 2026');
        const csvDl = await page.waitForDownload(() => page.click(SELECTORS.btnExportCsv));
        const jsonDl = await page.waitForDownload(() => page.click(SELECTORS.btnExportJson));

        assert.match(csvDl.suggestedFilename, /^roadmap_30_dias_[a-z0-9_-]+\.csv$/);
        assert.match(jsonDl.suggestedFilename, /^roadmap_30_dias_[a-z0-9_-]+\.json$/);
        page.assertNoRuntimeErrors('T1-F5-06');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F6: Progress Tracking & Multi-Dimensional Filtering (6 cases)
  // =========================================================================
  describe('F6: Progress Tracking & Multi-Dimensional Filtering', () => {
    test('T1-F6-01: Initial progress bar & 5 status counters', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await loadNiche(page, makeUniqueNiche('ProgressInit'));
        assert.equal(await page.getText(SELECTORS.progressSummaryText), '0 / 30 publicados · 0%');
        assert.equal(await page.getText(SELECTORS.countTotal), '30');
        assert.equal(await page.getText(SELECTORS.countPendiente), '30');
        assert.equal(await page.getText(SELECTORS.countGrabado), '0');
        assert.equal(await page.getText(SELECTORS.countEditado), '0');
        assert.equal(await page.getText(SELECTORS.countPublicado), '0');
        const fillWidth = parseFloat(await page.getComputedStyle(SELECTORS.progressFill, 'width'));
        assert.equal(fillWidth, 0);
        page.assertNoRuntimeErrors('T1-F6-01');
      } finally {
        await page.close();
      }
    });

    test('T1-F6-02: Real-time counter & progress bar update on status changes', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await loadNiche(page, makeUniqueNiche('ProgressLive'));
        await setDayStatus(page, 1, 'publicado');
        await setDayStatus(page, 2, 'publicado');
        await setDayStatus(page, 3, 'publicado');
        await setDayStatus(page, 4, 'grabado');
        await setDayStatus(page, 5, 'grabado');
        await setDayStatus(page, 6, 'editado');

        assert.equal(await page.getText(SELECTORS.countPublicado), '3');
        assert.equal(await page.getText(SELECTORS.countGrabado), '2');
        assert.equal(await page.getText(SELECTORS.countEditado), '1');
        assert.equal(await page.getText(SELECTORS.countPendiente), '24');
        assert.equal(await page.getText(SELECTORS.countTotal), '30');
        assert.equal(await page.getText(SELECTORS.progressSummaryText), '3 / 30 publicados · 10%');

        const fillRect = await page.getBoundingRect(SELECTORS.progressFill);
        assert.ok(fillRect.width > 0, 'Progress fill width must grow above 0px');
        page.assertNoRuntimeErrors('T1-F6-02');
      } finally {
        await page.close();
      }
    });

    test('T1-F6-03: Week Filter Chips (#weekFilterGroup)', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        const expectVisible = async (n) => {
          await page.waitForFunction(
            (expected) =>
              Array.from(document.querySelectorAll('.day-card')).filter(
                (el) => !el.closest('.hidden') && window.getComputedStyle(el).display !== 'none'
              ).length === expected,
            [n]
          );
          assert.equal(await page.countVisible(SELECTORS.dayCard), n);
        };
        await page.click(SELECTORS.btnWeek1);
        await expectVisible(7);
        await page.click(SELECTORS.btnWeek2);
        await expectVisible(7);
        await page.click(SELECTORS.btnWeek3);
        await expectVisible(7);
        await page.click(SELECTORS.btnWeek4);
        await expectVisible(9);
        await page.click(SELECTORS.btnWeekAll);
        await expectVisible(30);
        page.assertNoRuntimeErrors('T1-F6-03');
      } finally {
        await page.close();
      }
    });

    test('T1-F6-04: Format & Status <select> filters (including combination)', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await loadNiche(page, makeUniqueNiche('CombinedFilters'));
        const day1Format = await page.evaluate(() => {
          const card = document.querySelector('#day-card-1');
          return card?.textContent?.includes('Carrusel')
            ? 'Carrusel'
            : card?.textContent?.includes('Story')
              ? 'Story'
              : 'Reel';
        });
        await setDayStatus(page, 1, 'grabado');

        await page.selectOption(SELECTORS.formatFilterSelect, day1Format);
        await page.waitForFunction(
          () =>
            Array.from(document.querySelectorAll('.day-card')).filter(
              (el) => !el.closest('.hidden') && window.getComputedStyle(el).display !== 'none'
            ).length < 30
        );
        const formatCount = await page.countVisible(SELECTORS.dayCard);
        assert.ok(formatCount > 0 && formatCount < 30, `Expected filtered format count between 1 and 29, got ${formatCount}`);
        const allMatchFormat = await page.evaluate(
          (fmt) =>
            Array.from(document.querySelectorAll('.day-card'))
              .filter((c) => !c.closest('.hidden') && window.getComputedStyle(c).display !== 'none')
              .every((c) => c.textContent.includes(fmt)),
          day1Format
        );
        assert.equal(allMatchFormat, true);

        await page.selectOption(SELECTORS.statusFilterSelect, 'grabado');
        await page.waitForFunction(
          () =>
            Array.from(document.querySelectorAll('.day-card')).filter(
              (el) => !el.closest('.hidden') && window.getComputedStyle(el).display !== 'none'
            ).length === 1
        );
        assert.equal(await page.countVisible(SELECTORS.dayCard), 1);
        assert.equal(await page.isVisible(SELECTORS.dayCardByNum(1)), true);
        page.assertNoRuntimeErrors('T1-F6-04');
      } finally {
        await page.close();
      }
    });

    test('T1-F6-05: Debounced search (#searchRoadmapInput) filters across day content', async () => {
      const niche = makeUniqueNiche('SearchUnique');
      const roadmap = makeMockRoadmap(niche, {
        12: { title: 'Día especial QuantumHook99', hook: 'Gancho QuantumHook99' },
      });
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/roadmap?', async (route) => {
            await route.fulfill({ status: 200, body: { success: true, count: 30, niche, roadmap } });
          });
        },
      });
      try {
        await page.type(SELECTORS.searchRoadmapInput, 'QuantumHook99');
        await page.waitForFunction(() => document.querySelectorAll('.day-card').length === 1);
        assert.equal(await page.exists(SELECTORS.dayCardByNum(12)), true);
        assert.equal(await page.isVisible(SELECTORS.roadmapEmptyState), false);
        page.assertNoRuntimeErrors('T1-F6-05');
      } finally {
        await page.close();
      }
    });

    test('T1-F6-06: View Mode Segmented Toggle (#viewModeGrid <-> #viewModeTimeline) & #btnResetFilters', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await page.click(SELECTORS.btnWeek2);
        await page.selectOption(SELECTORS.formatFilterSelect, 'Reel');

        await page.click(SELECTORS.viewModeTimeline);
        const timelinePressed = await page.getAttr(SELECTORS.viewModeTimeline, 'aria-pressed');
        const listHasTimelineClass = await page.evaluate(() => {
          const list = document.querySelector('#roadmapList');
          return Boolean(list && /timeline|list/i.test(list.className));
        });
        assert.ok(timelinePressed === 'true' || listHasTimelineClass, 'Timeline view mode must activate');

        await page.click(SELECTORS.viewModeGrid);
        const gridPressed = await page.getAttr(SELECTORS.viewModeGrid, 'aria-pressed');
        assert.ok(gridPressed === 'true' || !(await page.evaluate(() => /timeline/i.test(document.querySelector('#roadmapList')?.className || ''))));

        await page.click(SELECTORS.btnResetFilters);
        assert.equal(await page.getValue(SELECTORS.searchRoadmapInput), '');
        assert.equal(await page.getValue(SELECTORS.formatFilterSelect), 'all');
        assert.equal(await page.getValue(SELECTORS.statusFilterSelect), 'all');
        assert.equal(await page.count(SELECTORS.dayCard), 30);
        page.assertNoRuntimeErrors('T1-F6-06');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F7: 30-Day Roadmap Master List & Day Cards (6 cases)
  // =========================================================================
  describe('F7: 30-Day Roadmap Master List & Day Cards', () => {
    test('T1-F7-01: 4 Week Groups (WEEK_LABELS) rendered in chronological order', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        const listText = await page.getText(SELECTORS.roadmapList);
        let lastIdx = -1;
        for (const label of WEEK_LABELS) {
          const idx = listText.indexOf(label);
          assert.ok(idx > lastIdx, `Expected week label "${label}" in chronological order inside #roadmapList`);
          lastIdx = idx;
        }
        page.assertNoRuntimeErrors('T1-F7-01');
      } finally {
        await page.close();
      }
    });

    test('T1-F7-02: 30 Day Cards DOM IDs & data-* attribute contract', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        assert.equal(await page.count(SELECTORS.dayCard), 30);
        const allValid = await page.evaluate(() => {
          for (let n = 1; n <= 30; n++) {
            const card = document.querySelector(`#day-card-${n}`);
            if (!card) return `Missing #day-card-${n}`;
            if (card.dataset.day !== String(n)) return `Wrong data-day on #day-card-${n}: ${card.dataset.day}`;
            if (!card.querySelector(`[data-card-status="${n}"]`)) return `Missing [data-card-status="${n}"]`;
          }
          return true;
        });
        assert.equal(allValid, true);
        page.assertNoRuntimeErrors('T1-F7-02');
      } finally {
        await page.close();
      }
    });

    test('T1-F7-03: Active selection state (aria-current)', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await selectDay(page, 10);
        const ariaStates = await page.evaluate(() =>
          Array.from(document.querySelectorAll('.day-card')).map((c) => ({
            day: c.dataset.day,
            current: c.getAttribute('aria-current'),
          }))
        );
        const trues = ariaStates.filter((s) => s.current === 'true');
        assert.equal(trues.length, 1);
        assert.equal(trues[0].day, '10');
        assert.equal(ariaStates.filter((s) => s.current === 'false').length, 29);
        assert.match(await page.getText(SELECTORS.inspectorDayBadge), /10/);
        page.assertNoRuntimeErrors('T1-F7-03');
      } finally {
        await page.close();
      }
    });

    test('T1-F7-04: Card metadata & capitalized status badge copy', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await loadNiche(page, makeUniqueNiche('CardMeta'));
        await setDayStatus(page, 2, 'grabado');

        const d1Status = await page.getText(SELECTORS.cardStatusByNum(1));
        const d2Status = await page.getText(SELECTORS.cardStatusByNum(2));
        assert.equal(d1Status, 'Pendiente');
        assert.equal(d2Status, 'Grabado');

        const d1Text = await page.getText(SELECTORS.dayCardByNum(1));
        assert.match(d1Text, /Día\s*0?1/i);
        assert.match(d1Text, /Reel|Carrusel|Story/);
        page.assertNoRuntimeErrors('T1-F7-04');
      } finally {
        await page.close();
      }
    });

    test('T1-F7-05: Boot loading skeletons shown during pending GET /api/roadmap', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        waitForCards: false,
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/roadmap', async (route) => {
            await new Promise((r) => setTimeout(r, 700));
            await route.continue();
          });
        },
      });
      try {
        await new Promise((r) => setTimeout(r, 200));
        const loadingSnapshot = await page.evaluate(() => {
          const list = document.querySelector('#roadmapList');
          const skeletons = list?.querySelectorAll('[class*="skeleton"], [aria-busy="true"], .skeleton-card').length || 0;
          const cards = list?.querySelectorAll('.day-card').length || 0;
          return { skeletons, cards, hasContent: (list?.children.length || 0) > 0 };
        });
        assert.ok(
          loadingSnapshot.skeletons > 0 || (loadingSnapshot.hasContent && loadingSnapshot.cards === 0),
          `Expected boot skeletons during pending GET /api/roadmap, got ${JSON.stringify(loadingSnapshot)}`
        );

        await waitForRoadmapHydrated(page);
        const afterSkeletons = await page.evaluate(
          () => document.querySelectorAll('#roadmapList [class*="skeleton"], #roadmapList .skeleton-card').length
        );
        assert.equal(afterSkeletons, 0, 'Skeleton placeholders must be removed after hydration');
        page.assertNoRuntimeErrors('T1-F7-05');
      } finally {
        await page.close();
      }
    });

    test('T1-F7-06: M3 Tonal Day Card styling (no generic 1px border clutter)', async () => {
      const page = await openAppPage(browser, server.baseUrl, { colorScheme: 'light' });
      try {
        await selectDay(page, 10);
        const card1Radius = parseFloat(await page.getComputedStyle(SELECTORS.dayCardByNum(1), 'border-top-left-radius'));
        const card1Bg = await page.getComputedStyle(SELECTORS.dayCardByNum(1), 'background-color');
        const card10Bg = await page.getComputedStyle(SELECTORS.dayCardByNum(10), 'background-color');
        const surfaceBg = await page.getCssVar('--md-sys-color-surface');

        assert.ok(card1Radius >= 12, `Day card corner radius must be >=12px, got ${card1Radius}px`);
        assert.notEqual(card1Bg, surfaceBg, 'Inactive day card must use tonal surface distinct from base surface');
        assert.notEqual(card10Bg, card1Bg, 'Active day card must use distinct highlight/selected tonal surface');
        page.assertNoRuntimeErrors('T1-F7-06');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F8: Day Inspector Side/Bottom Sheet & Keyboard Nav (5 cases)
  // =========================================================================
  describe('F8: Day Inspector Side/Bottom Sheet & Keyboard Navigation', () => {
    test('T1-F8-01: Desktop docked side sheet displays clicked day', async () => {
      const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.DESKTOP });
      try {
        await selectDay(page, 5);
        assert.equal(await page.isVisible(SELECTORS.dayInspector), true);
        assert.equal(await page.isVisible(SELECTORS.inspectorBackdrop), false);
        assert.match(await page.getText(SELECTORS.inspectorDayBadge), /0?5/);
        assert.ok((await page.getText(SELECTORS.inspectorWeekBadge)).length > 0);
        assert.ok((await page.getText(SELECTORS.inspectorFormatBadge)).length > 0);
        assert.ok((await page.getText(SELECTORS.inspectorPillarBadge)).length > 0);
        assert.ok((await page.getText(SELECTORS.inspectorTitle)).length > 0);
        page.assertNoRuntimeErrors('T1-F8-01');
      } finally {
        await page.close();
      }
    });

    test('T1-F8-02: Prev/Next buttons step sequentially through days', async () => {
      const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.DESKTOP });
      try {
        await selectDay(page, 5);
        await page.click(SELECTORS.btnNextDay);
        await page.waitForFunction(
          () =>
            document.querySelector('#day-card-6')?.getAttribute('aria-current') === 'true' &&
            /\b0?6\b/.test(document.querySelector('#inspectorDayBadge')?.textContent || '')
        );
        assert.equal(await page.getAttr(SELECTORS.dayCardByNum(6), 'aria-current'), 'true');
        assert.match(await page.getText(SELECTORS.inspectorDayBadge), /0?6/);

        await page.click(SELECTORS.btnPrevDay);
        await page.waitForFunction(
          () =>
            document.querySelector('#day-card-5')?.getAttribute('aria-current') === 'true' &&
            /\b0?5\b/.test(document.querySelector('#inspectorDayBadge')?.textContent || '')
        );
        assert.equal(await page.getAttr(SELECTORS.dayCardByNum(5), 'aria-current'), 'true');
        assert.match(await page.getText(SELECTORS.inspectorDayBadge), /0?5/);
        page.assertNoRuntimeErrors('T1-F8-02');
      } finally {
        await page.close();
      }
    });

    test('T1-F8-03: ArrowRight and ArrowLeft keyboard navigation', async () => {
      const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.DESKTOP });
      try {
        await selectDay(page, 4);
        await page.evaluate(() => document.activeElement?.blur?.());
        await page.pressKey('ArrowRight');
        assert.equal(await page.getAttr(SELECTORS.dayCardByNum(5), 'aria-current'), 'true');
        await page.pressKey('ArrowLeft');
        assert.equal(await page.getAttr(SELECTORS.dayCardByNum(4), 'aria-current'), 'true');
        page.assertNoRuntimeErrors('T1-F8-03');
      } finally {
        await page.close();
      }
    });

    test('T1-F8-04: Mobile modal sheet opens on card click and closes via #btnCloseDrawer', async () => {
      const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.MOBILE });
      try {
        await page.click(SELECTORS.dayCardByNum(3));
        await page.waitForSelector(SELECTORS.dayInspector, { visible: true });

        assert.equal(await page.getAttr(SELECTORS.dayInspector, 'role'), 'dialog');
        assert.equal(await page.getAttr(SELECTORS.dayInspector, 'aria-modal'), 'true');
        assert.equal(await page.isVisible(SELECTORS.inspectorBackdrop), true);

        await page.click(SELECTORS.btnCloseDrawer);
        await page.waitForSelector(SELECTORS.inspectorBackdrop, { hidden: true });
        assert.equal(await page.isVisible(SELECTORS.inspectorBackdrop), false);
        page.assertNoRuntimeErrors('T1-F8-04');
      } finally {
        await page.close();
      }
    });

    test('T1-F8-05: Escape closes mobile modal sheet', async () => {
      const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.MOBILE });
      try {
        await page.click(SELECTORS.dayCardByNum(2));
        await page.waitForSelector(SELECTORS.inspectorBackdrop, { visible: true });

        await page.pressKey('Escape');
        await page.waitForSelector(SELECTORS.inspectorBackdrop, { hidden: true });
        assert.equal(await page.isVisible(SELECTORS.inspectorBackdrop), false);
        page.assertNoRuntimeErrors('T1-F8-05');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F9: Production Status Tracking & Optimistic Sync (5 cases)
  // =========================================================================
  describe('F9: Production Status Tracking & Optimistic Sync', () => {
    test('T1-F9-01: Change status to Grabado updates inspector, card, counters, and progress', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await loadNiche(page, makeUniqueNiche('F9-Grabado'));
        await setDayStatus(page, 1, 'grabado');

        assert.equal(await page.getAttr(SELECTORS.statusBtn('grabado'), 'aria-pressed'), 'true');
        assert.equal(await page.getAttr(SELECTORS.statusBtn('pendiente'), 'aria-pressed'), 'false');
        assert.equal(await page.getText(SELECTORS.cardStatusByNum(1)), 'Grabado');
        assert.equal(await page.getText(SELECTORS.countGrabado), '1');
        assert.equal(await page.getText(SELECTORS.countPendiente), '29');
        page.assertNoRuntimeErrors('T1-F9-01');
      } finally {
        await page.close();
      }
    });

    test('T1-F9-02: Change status through Editado and Publicado updates progress bar', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await loadNiche(page, makeUniqueNiche('F9-EditPub'));
        await setDayStatus(page, 1, 'editado');
        assert.equal(await page.getText(SELECTORS.countEditado), '1');
        assert.equal(await page.getText(SELECTORS.cardStatusByNum(1)), 'Editado');

        await setDayStatus(page, 1, 'publicado');
        assert.equal(await page.getText(SELECTORS.countPublicado), '1');
        assert.match(await page.getText(SELECTORS.progressSummaryText), /1 \/ 30 publicados/);
        const fillRect = await page.getBoundingRect(SELECTORS.progressFill);
        assert.ok(fillRect.width > 0);
        page.assertNoRuntimeErrors('T1-F9-02');
      } finally {
        await page.close();
      }
    });

    test('T1-F9-03: Status change persists on server across reload', async () => {
      await fetch(`${server.baseUrl}/api/roadmap/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: DEFAULT_NICHE }),
      });
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await setDayStatus(page, 1, 'publicado');

        await page.reload();
        await waitForRoadmapHydrated(page);

        assert.equal(await page.getText(SELECTORS.cardStatusByNum(1)), 'Publicado');
        await selectDay(page, 1);
        assert.equal(await page.getAttr(SELECTORS.statusBtn('publicado'), 'aria-pressed'), 'true');
        assert.equal(await page.getText(SELECTORS.countPublicado), '1');
        page.assertNoRuntimeErrors('T1-F9-03');
      } finally {
        await page.close();
      }
    });

    test('T1-F9-04: Segmented button aria-pressed exclusivity across all 4 statuses', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await loadNiche(page, makeUniqueNiche('F9-Exclusive'));
        await selectDay(page, 2);

        for (const targetStatus of ['grabado', 'editado', 'publicado', 'pendiente']) {
          await page.click(SELECTORS.statusBtn(targetStatus));
          await page.waitForFunction(
            (sel) => document.querySelector(sel)?.getAttribute('aria-pressed') === 'true',
            [SELECTORS.statusBtn(targetStatus)]
          );
          for (const s of VALID_STATUSES) {
            const pressed = await page.getAttr(SELECTORS.statusBtn(s), 'aria-pressed');
            assert.equal(pressed, s === targetStatus ? 'true' : 'false');
          }
          await new Promise((r) => setTimeout(r, 80));
        }
        page.assertNoRuntimeErrors('T1-F9-04');
      } finally {
        await page.close();
      }
    });

    test('T1-F9-05: Optimistic UI reflects new status immediately before delayed PATCH resolves', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await loadNiche(page, makeUniqueNiche('F9-Optimistic'));
        await selectDay(page, 3);

        await page.interceptRoute('/status', async (route) => {
          await new Promise((r) => setTimeout(r, 450));
          await route.continue();
        });

        await page.click(SELECTORS.statusBtn('grabado'));
        await new Promise((r) => setTimeout(r, 60));

        assert.equal(await page.getAttr(SELECTORS.statusBtn('grabado'), 'aria-pressed'), 'true');
        assert.equal(await page.getText(SELECTORS.cardStatusByNum(3)), 'Grabado');

        await new Promise((r) => setTimeout(r, 500));
        assert.equal(await page.getText(SELECTORS.cardStatusByNum(3)), 'Grabado');
        assert.ok((await page.getText(SELECTORS.toastContainer)).length > 0);
        page.assertNoRuntimeErrors('T1-F9-05');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F10: Day Content Details, Visual 9:16/1:1 Safe-Zone & Copy (5 cases)
  // =========================================================================
  describe('F10: Day Content Details, Visual 9:16/1:1 Safe-Zone & Copy', () => {
    test('T1-F10-01: Core content fields populate from selected day', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await selectDay(page, 1);
        for (const sel of [
          SELECTORS.inspectorTitle,
          SELECTORS.inspectorHook,
          SELECTORS.inspectorImagePrompt,
          SELECTORS.inspectorScript,
          SELECTORS.inspectorCaption,
        ]) {
          assert.ok((await page.getText(sel)).length > 0, `Expected non-empty content in ${sel}`);
        }
        const hashtagsText = await page.getText(SELECTORS.inspectorHashtags);
        assert.match(hashtagsText, /#\w+/);
        page.assertNoRuntimeErrors('T1-F10-01');
      } finally {
        await page.close();
      }
    });

    test('T1-F10-02: 9:16 vs 1:1 visual aspect frame and composition tip match format', async () => {
      const niche = makeUniqueNiche('F10-Aspect');
      const roadmap = makeMockRoadmap(niche, {
        1: { format: 'Reel' },
        2: { format: 'Carrusel' },
        3: { format: 'Story' },
      });
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/roadmap?', async (route) => {
            await route.fulfill({ status: 200, body: { success: true, count: 30, niche, roadmap } });
          });
        },
      });
      try {
        await selectDay(page, 1);
        assert.equal(await page.getAttr(SELECTORS.visualAspectFrame, 'data-ratio'), '9:16');
        assert.match(await page.getText(SELECTORS.visualRatioLabel), /9:16/);
        assert.equal(await page.getText(SELECTORS.visualFrameFormat), 'Reel');
        assert.ok((await page.getText(SELECTORS.visualCompositionTip)).length > 0);

        await selectDay(page, 2);
        assert.equal(await page.getAttr(SELECTORS.visualAspectFrame, 'data-ratio'), '1:1');
        assert.match(await page.getText(SELECTORS.visualRatioLabel), /1:1/);

        await selectDay(page, 3);
        assert.equal(await page.getAttr(SELECTORS.visualAspectFrame, 'data-ratio'), '9:16');
        page.assertNoRuntimeErrors('T1-F10-02');
      } finally {
        await page.close();
      }
    });

    test('T1-F10-03: Copy Hook and Copy Image Prompt write exact content to clipboard', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await selectDay(page, 1);
        const expectedHook = await page.getText(SELECTORS.inspectorHook);
        const expectedPrompt = await page.getText(SELECTORS.inspectorImagePrompt);

        await page.click(SELECTORS.btnCopyHook);
        assert.equal(await page.readClipboard(), expectedHook);
        await page.waitForFunction(() => (document.querySelector('#toastContainer')?.textContent || '').trim().length > 0);

        await page.click(SELECTORS.btnCopyPrompt);
        assert.equal(await page.readClipboard(), expectedPrompt);
        page.assertNoRuntimeErrors('T1-F10-03');
      } finally {
        await page.close();
      }
    });

    test('T1-F10-04: Copy Script and Copy Caption (+ hashtags) write formatted text to clipboard', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await selectDay(page, 1);
        const expectedScript = await page.getText(SELECTORS.inspectorScript);
        const expectedCaption = await page.getText(SELECTORS.inspectorCaption);

        await page.click(SELECTORS.btnCopyScript);
        assert.equal(await page.readClipboard(), expectedScript);

        await page.click(SELECTORS.btnCopyCaption);
        const copiedCaption = await page.readClipboard();
        assert.ok(copiedCaption.startsWith(expectedCaption), 'Copied caption must start with #inspectorCaption text');
        assert.match(copiedCaption, /#\w+/);
        page.assertNoRuntimeErrors('T1-F10-04');
      } finally {
        await page.close();
      }
    });

    test('T1-F10-05: Real YouTube reference_video_id renders external link with security attrs', async () => {
      const niche = makeUniqueNiche('F10-RealRef');
      const roadmap = makeMockRoadmap(niche, { 1: { reference_video_id: 'dQw4w9WgXcQ' } });
      const videos = makeMockVideos(1, 'Real Ref');

      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/roadmap?', async (route) => {
            await route.fulfill({ status: 200, body: { success: true, count: 30, niche, roadmap } });
          });
          await p.interceptRoute('/api/videos', async (route) => {
            await route.fulfill({ status: 200, body: { success: true, count: 1, videos } });
          });
        },
      });
      try {
        await selectDay(page, 1);
        assert.equal(await page.getAttr(SELECTORS.inspectorRefLink, 'href'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        assert.equal(await page.getAttr(SELECTORS.inspectorRefLink, 'target'), '_blank');
        const rel = await page.getAttr(SELECTORS.inspectorRefLink, 'rel');
        assert.match(rel, /noopener/);
        assert.match(rel, /noreferrer/);
        page.assertNoRuntimeErrors('T1-F10-05');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F11: Local Draft Editor (localStorage) (5 cases)
  // =========================================================================
  describe('F11: Local Draft Editor (localStorage)', () => {
    test('T1-F11-01: Toggle edit mode reveals #draftEditorForm prefilled with current values', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await selectDay(page, 1);
        assert.equal(await page.isVisible(SELECTORS.draftEditorForm), false);

        const hook = await page.getText(SELECTORS.inspectorHook);
        const prompt = await page.getText(SELECTORS.inspectorImagePrompt);
        const script = await page.getText(SELECTORS.inspectorScript);
        const caption = await page.getText(SELECTORS.inspectorCaption);

        await page.click(SELECTORS.btnToggleEditMode);
        await page.waitForSelector(SELECTORS.draftEditorForm, { visible: true });
        assert.match(await page.getText(SELECTORS.btnToggleEditMode), /Ver detalle/i);

        assert.equal(await page.getValue(SELECTORS.editHookInput), hook);
        assert.equal(await page.getValue(SELECTORS.editPromptInput), prompt);
        assert.equal(await page.getValue(SELECTORS.editScriptInput), script);
        assert.equal(await page.getValue(SELECTORS.editCaptionInput), caption);
        page.assertNoRuntimeErrors('T1-F11-01');
      } finally {
        await page.close();
      }
    });

    test('T1-F11-02: Saving draft updates inspector, card badge, and localStorage', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await selectDay(page, 1);
        await page.click(SELECTORS.btnToggleEditMode);
        await page.fill(SELECTORS.editHookInput, 'Gancho E2E personalizado');
        await page.fill(SELECTORS.editCaptionInput, 'Caption E2E');
        await page.click(SELECTORS.btnSaveDraft);

        await page.waitForSelector(SELECTORS.draftEditorForm, { hidden: true });
        assert.equal(await page.getText(SELECTORS.inspectorHook), 'Gancho E2E personalizado');
        assert.equal(await page.isVisible(SELECTORS.localDraftBadge), true);
        assert.match(await page.getText(SELECTORS.dayCardByNum(1)), /Borrador/);

        const drafts = JSON.parse(await page.getLocalStorage(STORAGE_KEYS.DRAFTS));
        const key = `${DEFAULT_NICHE.toLowerCase()}::1`;
        assert.equal(drafts[key]?.hook, 'Gancho E2E personalizado');
        page.assertNoRuntimeErrors('T1-F11-02');
      } finally {
        await page.close();
      }
    });

    test('T1-F11-03: Saved draft persists across page reload', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await selectDay(page, 1);
        await page.click(SELECTORS.btnToggleEditMode);
        await page.fill(SELECTORS.editHookInput, 'Gancho Persistente Reload');
        await page.click(SELECTORS.btnSaveDraft);
        await page.waitForSelector(SELECTORS.draftEditorForm, { hidden: true });

        await page.reload();
        await waitForRoadmapHydrated(page);
        await selectDay(page, 1);

        assert.equal(await page.getText(SELECTORS.inspectorHook), 'Gancho Persistente Reload');
        assert.equal(await page.isVisible(SELECTORS.localDraftBadge), true);
        assert.match(await page.getText(SELECTORS.dayCardByNum(1)), /Borrador/);
        page.assertNoRuntimeErrors('T1-F11-03');
      } finally {
        await page.close();
      }
    });

    test('T1-F11-04: Drafts are isolated per niche and day number', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await selectDay(page, 1);
        await page.click(SELECTORS.btnToggleEditMode);
        await page.fill(SELECTORS.editHookInput, 'Solo Nicho A Dia 1');
        await page.click(SELECTORS.btnSaveDraft);
        await page.waitForSelector(SELECTORS.draftEditorForm, { hidden: true });

        await selectDay(page, 2);
        assert.equal(await page.isVisible(SELECTORS.localDraftBadge), false);

        await loadNiche(page, makeUniqueNiche('NichoB'));
        await selectDay(page, 1);
        assert.notEqual(await page.getText(SELECTORS.inspectorHook), 'Solo Nicho A Dia 1');
        assert.equal(await page.isVisible(SELECTORS.localDraftBadge), false);
        page.assertNoRuntimeErrors('T1-F11-04');
      } finally {
        await page.close();
      }
    });

    test('T1-F11-05: Restaurar original deletes local draft after confirmation', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await selectDay(page, 1);
        const originalHook = await page.getText(SELECTORS.inspectorHook);

        await page.click(SELECTORS.btnToggleEditMode);
        await page.fill(SELECTORS.editHookInput, 'Temporal para Restaurar');
        await page.click(SELECTORS.btnSaveDraft);
        await page.waitForSelector(SELECTORS.draftEditorForm, { hidden: true });
        await page.waitForFunction(() => document.querySelector('#inspectorHook')?.textContent?.includes('Temporal para Restaurar'));
        assert.equal(await page.getText(SELECTORS.inspectorHook), 'Temporal para Restaurar');

        await page.click(SELECTORS.btnToggleEditMode);
        await page.click(SELECTORS.btnResetDraft);
        await confirmDialogAccept(page);

        assert.equal(await page.isVisible(SELECTORS.localDraftBadge), false);
        assert.doesNotMatch(await page.getText(SELECTORS.dayCardByNum(1)), /Borrador/);
        assert.equal(await page.getText(SELECTORS.inspectorHook), originalHook);

        const drafts = JSON.parse((await page.getLocalStorage(STORAGE_KEYS.DRAFTS)) || '{}');
        assert.equal(drafts[`${DEFAULT_NICHE.toLowerCase()}::1`], undefined);
        page.assertNoRuntimeErrors('T1-F11-05');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F12: YouTube Research View & Topic Pivot (5 cases)
  // =========================================================================
  describe('F12: YouTube Research View & Topic Pivot', () => {
    test('T1-F12-01: Switching to YouTube view lazy-loads history and stored videos', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        page.clearRecordedRequests();
        await switchTab(page, 'youtube');
        await new Promise((r) => setTimeout(r, 200));

        const reqs = page.getRecordedRequests();
        assert.ok(reqs.some((r) => r.url.includes('/api/videos')), 'Expected GET /api/videos when opening YouTube view');
        assert.ok(reqs.some((r) => r.url.includes('/api/youtube/history')), 'Expected GET /api/youtube/history when opening YouTube view');
        assert.equal(await page.isVisible(SELECTORS.viewYoutube), true);
        assert.equal(await page.isVisible(SELECTORS.viewRoadmap), false);
        assert.ok((await page.getText(SELECTORS.ytVideosGrid)).length > 0);
        assert.ok((await page.getText(SELECTORS.ytHistoryList)).length > 0);
        page.assertNoRuntimeErrors('T1-F12-01');
      } finally {
        await page.close();
      }
    });

    test('T1-F12-02: Submitting YouTube search displays #ytResultsSection cards', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await switchTab(page, 'youtube');
        page.clearRecordedRequests();
        await page.fill(SELECTORS.ytSearchInput, 'automatización IA');
        await page.click(SELECTORS.btnYtSearch);

        await page.waitForSelector(SELECTORS.ytResultsSection, { visible: true });
        await page.waitForFunction(() => document.querySelectorAll('#ytResultsList [data-use-topic]').length >= 1);

        const req = page.getRecordedRequests().find((r) => r.url.includes('/api/youtube/search'));
        assert.ok(req, 'Expected GET /api/youtube/search');
        assert.match(req.url, /maxResults=6/);
        assert.ok((await page.count('#ytResultsList .video-thumb')) >= 1);
        assert.ok((await page.count('#ytResultsList .video-card-title')) >= 1);
        assert.ok((await page.count('#ytResultsList .video-card-meta')) >= 1);
        page.assertNoRuntimeErrors('T1-F12-02');
      } finally {
        await page.close();
      }
    });

    test('T1-F12-03: Search updates Recent History chips immediately', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await switchTab(page, 'youtube');
        const q = `chip_${Date.now()}`;
        await page.fill(SELECTORS.ytSearchInput, q);
        await page.click(SELECTORS.btnYtSearch);
        await page.waitForSelector(`.history-chip[data-history-query="${q}"]`, { visible: true });

        const chipText = await page.getText(`.history-chip[data-history-query="${q}"]`);
        assert.match(chipText, /\d+/);
        page.assertNoRuntimeErrors('T1-F12-03');
      } finally {
        await page.close();
      }
    });

    test('T1-F12-04: Clicking a history chip executes search and populates input', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await switchTab(page, 'youtube');
        const q = `histclick_${Date.now()}`;
        await page.fill(SELECTORS.ytSearchInput, q);
        await page.click(SELECTORS.btnYtSearch);
        await page.waitForSelector(`.history-chip[data-history-query="${q}"]`, { visible: true });

        await page.fill(SELECTORS.ytSearchInput, '');
        page.clearRecordedRequests();
        await page.click(`.history-chip[data-history-query="${q}"]`);

        await page.waitForFunction((expected) => document.querySelector('#ytSearchInput')?.value === expected, [q]);
        const req = page.getRecordedRequests().find((r) => r.url.includes('/api/youtube/search') && r.url.includes(encodeURIComponent(q)));
        assert.ok(req, 'Clicking history chip must trigger GET /api/youtube/search');
        page.assertNoRuntimeErrors('T1-F12-04');
      } finally {
        await page.close();
      }
    });

    test('T1-F12-05: "Usar tema en Roadmap" pivots to Roadmap with confirmation', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await switchTab(page, 'youtube');
        await page.fill(SELECTORS.ytSearchInput, 'Agentes IA');
        await page.click(SELECTORS.btnYtSearch);
        await page.waitForSelector('#ytResultsList [data-use-topic]', { visible: true });

        const expectedTopic = await page.getAttr('#ytResultsList [data-use-topic]', 'data-use-topic');
        await page.click('#ytResultsList [data-use-topic]');
        await confirmDialogAccept(page);

        await page.waitForSelector(SELECTORS.viewRoadmap, { visible: true });
        assert.equal(await page.getAttr(SELECTORS.tabRoadmap, 'aria-selected'), 'true');
        assert.equal(await page.getValue(SELECTORS.nicheInput), expectedTopic);
        await waitForRoadmapHydrated(page);
        page.assertNoRuntimeErrors('T1-F12-05');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F13: Oráculo & Fuentes View (5 cases)
  // =========================================================================
  describe('F13: Oráculo & Fuentes View', () => {
    test('T1-F13-01: Oráculo view renders server health and uptime', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await switchTab(page, 'oracle');
        assert.equal(await page.isVisible(SELECTORS.oracleHealthCard), true);
        assert.match(await page.getText(SELECTORS.healthStatusText), /Operativo|ok/i);
        assert.match(await page.getText(SELECTORS.healthUptimeText), /\d+\s*(s|m|h)/i);
        page.assertNoRuntimeErrors('T1-F13-01');
      } finally {
        await page.close();
      }
    });

    test('T1-F13-02: Initial Last Oracle Run card displays no-prior-run state', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/oracle/status', async (route) => {
            await route.fulfill({
              status: 200,
              body: {
                success: true,
                lastExecution: 'Aún no se ha ejecutado ningún ciclo. Puedes dispararlo con POST /api/oracle/run-now',
              },
            });
          });
        },
      });
      try {
        await switchTab(page, 'oracle');
        await page.waitForFunction(
          (sel) => /Sin ejecución previa/i.test(document.querySelector(sel)?.textContent || ''),
          [SELECTORS.oracleLastStatus]
        );
        assert.match(await page.getText(SELECTORS.oracleLastDetails), /POST \/api\/oracle\/run-now|ciclo/i);
        page.assertNoRuntimeErrors('T1-F13-02');
      } finally {
        await page.close();
      }
    });

    test('T1-F13-03: Manual Oracle run from #btnOracleTabRun executes cycle and updates status', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await switchTab(page, 'oracle');
        await page.click(SELECTORS.btnOracleTabRun);
        await confirmDialogAccept(page);

        await page.waitForFunction(
          (sel) => /completado/i.test(document.querySelector(sel)?.textContent || ''),
          [SELECTORS.oracleLastStatus]
        );
        assert.ok((await page.getText(SELECTORS.oracleLastTimestamp)).length > 4);
        assert.match(await page.getText(SELECTORS.oracleLastDetails), /30/);
        assert.match(await page.getText(SELECTORS.statusOracleBadge), /Oráculo sincronizado/i);
        page.assertNoRuntimeErrors('T1-F13-03');
      } finally {
        await page.close();
      }
    });

    test('T1-F13-04: GET /api/oracle/status preserves last execution across page reload', async () => {
      await fetch(`${server.baseUrl}${ROUTES.ORACLE_RUN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: DEFAULT_NICHE, instagramAccount: DEFAULT_IG_ACCOUNT }),
      });
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await page.reload();
        await waitForRoadmapHydrated(page);
        await switchTab(page, 'oracle');

        await page.waitForFunction(
          (sel) => /completado/i.test(document.querySelector(sel)?.textContent || ''),
          [SELECTORS.oracleLastStatus]
        );
        assert.match(await page.getText(SELECTORS.statusOracleBadge), /Oráculo sincronizado/i);
        page.assertNoRuntimeErrors('T1-F13-04');
      } finally {
        await page.close();
      }
    });

    test('T1-F13-05: Data Sources Transparency Grid displays all 4 truth cards', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await switchTab(page, 'oracle');
        for (const sel of [
          SELECTORS.truthCardYoutube,
          SELECTORS.truthCardGemini,
          SELECTORS.truthCardSupabase,
          SELECTORS.truthCardInstagram,
        ]) {
          assert.equal(await page.isVisible(sel), true, `${sel} must be visible`);
          assert.ok((await page.getText(sel)).length > 10, `${sel} must have descriptive content`);
        }
        page.assertNoRuntimeErrors('T1-F13-05');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F14: M3 Snackbar Feedback & Offline Fallback (5 cases)
  // =========================================================================
  describe('F14: M3 Snackbar Feedback & Offline Fallback', () => {
    test('T1-F14-01: Snackbar renders inside #toastContainer on user action', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        assert.equal(await page.getAttr(SELECTORS.toastContainer, 'aria-live'), 'polite');
        await selectDay(page, 1);
        await page.click(SELECTORS.btnCopyHook);
        await page.waitForFunction(() => (document.querySelector('#toastContainer')?.textContent || '').trim().length > 0);
        assert.ok((await page.getText(SELECTORS.toastContainer)).length > 0);
        page.assertNoRuntimeErrors('T1-F14-01');
      } finally {
        await page.close();
      }
    });

    test('T1-F14-02: Snackbar uses M3 inverse-surface / inverse-on-surface styling', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await selectDay(page, 1);
        await page.click(SELECTORS.btnCopyHook);
        await page.waitForFunction(() => (document.querySelector('#toastContainer')?.children.length || 0) > 0);

        const colors = await page.evaluate(() => {
          const root = window.getComputedStyle(document.documentElement);
          const snack = document.querySelector('#toastContainer > *');
          const cs = snack ? window.getComputedStyle(snack) : null;
          return {
            invBg: root.getPropertyValue('--md-sys-color-inverse-surface').trim(),
            invFg: root.getPropertyValue('--md-sys-color-inverse-on-surface').trim(),
            snackBg: cs?.backgroundColor || '',
            snackFg: cs?.color || '',
          };
        });

        assert.deepEqual(parseCssColor(colors.snackBg), parseCssColor(colors.invBg));
        assert.deepEqual(parseCssColor(colors.snackFg), parseCssColor(colors.invFg));
        page.assertNoRuntimeErrors('T1-F14-02');
      } finally {
        await page.close();
      }
    });

    test('T1-F14-03: Offline fallback activates when GET /api/roadmap fails with 500', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        waitForCards: false,
        beforeNavigate: async (p) => {
          await p.mockError('/api/roadmap', { status: 500 });
        },
      });
      try {
        await waitForRoadmapHydrated(page);
        assert.equal(await page.isVisible(SELECTORS.roadmapSourceNotice), true);
        assert.match(await page.getText(SELECTORS.roadmapSourceNotice), /sin conexión|local|fallback|respaldo/i);
        assert.equal(await page.count(SELECTORS.dayCard), 30);
        page.assertNoPageErrors('T1-F14-03');
      } finally {
        await page.close();
      }
    });

    test('T1-F14-04: Offline fallback activates when network request aborts', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await page.mockError('/api/roadmap', { networkFail: true, errorReason: 'Failed' });
        await page.fill(SELECTORS.nicheInput, 'Fitness');
        await page.pressKey('Enter');

        await page.waitForSelector(SELECTORS.roadmapSourceNotice, { visible: true });
        await waitForRoadmapHydrated(page);
        assert.match(await page.getText(SELECTORS.dayCardByNum(1)), /Fitness/i);
        assert.ok((await page.getText(SELECTORS.toastContainer)).length > 0);
        page.assertNoPageErrors('T1-F14-04');
      } finally {
        await page.close();
      }
    });

    test('T1-F14-05: Fallback banner hides automatically when API recovers', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        waitForCards: false,
        beforeNavigate: async (p) => {
          await p.mockError('/api/roadmap', { status: 500 });
        },
      });
      try {
        await waitForRoadmapHydrated(page);
        assert.equal(await page.isVisible(SELECTORS.roadmapSourceNotice), true);

        await page.clearRoutes();
        await page.click(SELECTORS.btnLoadRoadmap);
        await page.waitForSelector(SELECTORS.roadmapSourceNotice, { hidden: true });
        assert.equal(await page.isVisible(SELECTORS.roadmapSourceNotice), false);
        assert.equal(await page.count(SELECTORS.dayCard), 30);
        page.assertNoPageErrors('T1-F14-05');
      } finally {
        await page.close();
      }
    });
  });
});
