import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launchBrowser } from './lib/cdp.mjs';
import {
  CSV_HEADERS_COUNT,
  DEFAULT_NICHE,
  ROUTES,
  SELECTORS,
  STATUS_LABELS,
  STORAGE_KEYS,
  VIEWPORTS,
  makeMockRoadmap,
  makeMockVideos,
  makeUniqueNiche,
  parseCssColor,
  parseRfc4180Csv,
  rectsOverlap,
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

describe('Tier 2: Boundary & Corner Cases (F1–F14, 79 cases)', () => {
  // =========================================================================
  // F1 Boundaries (6 cases)
  // =========================================================================
  describe('F1 Boundaries', () => {
    test('T2-F1-01: Invalid, empty & XSS-like URL hash fragments', async () => {
      for (const hash of ['#unknown_tab', '#day=999', '#<img src=x onerror=alert(1)>', '#']) {
        const page = await openAppPage(browser, server.baseUrl, { pathAndHash: `/${hash}` });
        try {
          assert.equal(await page.getAttr(SELECTORS.tabRoadmap, 'aria-selected'), 'true');
          assert.equal(await page.isVisible(SELECTORS.viewRoadmap), true);
          assert.equal(await page.isVisible(SELECTORS.viewYoutube), false);
          assert.equal(await page.isVisible(SELECTORS.viewOracle), false);
          const injected = await page.evaluate(() => Boolean(document.querySelector('img[onerror]')));
          assert.equal(injected, false);
          page.assertNoRuntimeErrors(`T2-F1-01(${hash})`);
        } finally {
          await page.close();
        }
      }
    });

    test('T2-F1-02: Dynamic resize across 840px Rail/Bar breakpoint (839px <-> 840px)', async () => {
      const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.BAR_MAX });
      try {
        assert.equal(await page.count(SELECTORS.tabRoadmap), 1);
        const barRect = await page.evaluate(() => {
          const r = document.querySelector('#tab-roadmap').closest('nav').getBoundingClientRect();
          return { left: r.left, bottom: r.bottom, width: r.width, height: r.height };
        });
        assert.ok(barRect.bottom >= 780 && barRect.width > barRect.height, `Expected bottom nav bar at 839px, got ${JSON.stringify(barRect)}`);
        await assertNoHorizontalOverflow(page, '839px');

        await page.setViewport(VIEWPORTS.RAIL_MIN);
        await new Promise((r) => setTimeout(r, 80));
        assert.equal(await page.count(SELECTORS.tabRoadmap), 1);
        const railRect = await page.evaluate(() => {
          const r = document.querySelector('#tab-roadmap').closest('nav').getBoundingClientRect();
          return { left: r.left, bottom: r.bottom, width: r.width, height: r.height };
        });
        assert.ok(railRect.left <= 24 && railRect.height > railRect.width, `Expected left nav rail at 840px, got ${JSON.stringify(railRect)}`);
        await assertNoHorizontalOverflow(page, '840px');

        await page.setViewport(VIEWPORTS.BAR_MAX);
        await new Promise((r) => setTimeout(r, 80));
        await assertNoHorizontalOverflow(page, '839px-return');
        page.assertNoRuntimeErrors('T2-F1-02');
      } finally {
        await page.close();
      }
    });

    test('T2-F1-03: Rapid repeated clicks on active tab preserve filter state', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await page.click(SELECTORS.btnWeek2);
        assert.equal(await page.countVisible(SELECTORS.dayCard), 7);

        for (let i = 0; i < 5; i++) {
          await page.click(SELECTORS.tabRoadmap);
        }
        assert.equal(await page.isVisible(SELECTORS.viewRoadmap), true);
        assert.equal(await page.countVisible(SELECTORS.dayCard), 7);
        page.assertNoRuntimeErrors('T2-F1-03');
      } finally {
        await page.close();
      }
    });

    test('T2-F1-04: Extreme viewports 320x568 & 1920x1080', async () => {
      const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.NARROW_MOBILE });
      try {
        await assertNoHorizontalOverflow(page, '320x568');
        const tabRects = await page.evaluate(() =>
          ['#tab-roadmap', '#tab-youtube', '#tab-oracle'].map((s) => {
            const r = document.querySelector(s).getBoundingClientRect();
            return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
          })
        );
        for (const r of tabRects) {
          assert.ok(r.width >= 40 && r.height >= 40, `Tab button too small on 320px: ${JSON.stringify(r)}`);
        }
        assert.equal(rectsOverlap(tabRects[0], tabRects[1]), false);
        assert.equal(rectsOverlap(tabRects[1], tabRects[2]), false);

        await page.setViewport(VIEWPORTS.WIDE_DESKTOP);
        await new Promise((r) => setTimeout(r, 80));
        await assertNoHorizontalOverflow(page, '1920x1080');
        page.assertNoRuntimeErrors('T2-F1-04');
      } finally {
        await page.close();
      }
    });

    test('T2-F1-05: Keyboard tab activation (Enter / Space)', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await page.focus(SELECTORS.tabYoutube);
        await page.pressKey('Enter');
        await page.waitForSelector(SELECTORS.viewYoutube, { visible: true });
        assert.equal(await page.getAttr(SELECTORS.tabYoutube, 'aria-selected'), 'true');
        assert.equal(await page.evaluate(() => window.location.hash), '#youtube');

        await page.focus(SELECTORS.tabOracle);
        await page.pressKey('Space');
        await page.waitForSelector(SELECTORS.viewOracle, { visible: true });
        assert.equal(await page.getAttr(SELECTORS.tabOracle, 'aria-selected'), 'true');
        assert.equal(await page.evaluate(() => window.location.hash), '#oracle');
        page.assertNoRuntimeErrors('T2-F1-05');
      } finally {
        await page.close();
      }
    });

    test('T2-F1-06: Programmatic hashchange while mobile drawer (#dayInspector) is open', async () => {
      const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.MOBILE });
      try {
        await page.click(SELECTORS.dayCardByNum(1));
        await page.waitForSelector(SELECTORS.inspectorBackdrop, { visible: true });

        await page.evaluate(() => {
          window.location.hash = '#youtube';
        });
        await page.waitForSelector(SELECTORS.viewYoutube, { visible: true });
        assert.equal(await page.isVisible(SELECTORS.inspectorBackdrop), false);

        const bodyOverflow = await page.getComputedStyle('body', 'overflow');
        assert.notEqual(bodyOverflow, 'hidden');
        page.assertNoRuntimeErrors('T2-F1-06');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F2 Boundaries (6 cases)
  // =========================================================================
  describe('F2 Boundaries', () => {
    test('T2-F2-01: Corrupt / invalid localStorage content_studio_theme_v1 values', async () => {
      for (const bad of ['invalid_neon', 'null', '{}', '']) {
        const page = await openAppPage(browser, server.baseUrl, {
          initScripts: [`localStorage.setItem(${JSON.stringify(STORAGE_KEYS.THEME)}, ${JSON.stringify(bad)});`],
        });
        try {
          const theme = await page.evaluate(() => document.documentElement.dataset.theme);
          assert.ok(theme === 'light' || theme === 'dark', `Expected valid fallback theme for "${bad}", got "${theme}"`);
          assert.ok((await page.getCssVar('--md-sys-color-primary')).length > 0);
          page.assertNoRuntimeErrors(`T2-F2-01(${bad})`);
        } finally {
          await page.close();
        }
      }
    });

    test('T2-F2-02: localStorage read/write throws SecurityError', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        initScripts: [
          `Object.defineProperty(window, 'localStorage', {
            configurable: true,
            get() { throw new DOMException('Blocked', 'SecurityError'); }
          });`,
        ],
      });
      try {
        const beforeTheme = await page.evaluate(() => document.documentElement.dataset.theme);
        await page.click(SELECTORS.btnThemeToggle);
        const afterTheme = await page.evaluate(() => document.documentElement.dataset.theme);
        assert.notEqual(afterTheme, beforeTheme, 'Theme toggle must still work in-memory when localStorage throws');
        page.assertNoRuntimeErrors('T2-F2-02');
      } finally {
        await page.close();
      }
    });

    test('T2-F2-03: Rapid toggle stress test (5 clicks on #btnThemeToggle)', async () => {
      const page = await openAppPage(browser, server.baseUrl, { colorScheme: 'light' });
      try {
        for (let i = 0; i < 5; i++) {
          await page.click(SELECTORS.btnThemeToggle);
        }
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
        assert.equal(await page.getLocalStorage(STORAGE_KEYS.THEME), 'dark');
        const bg = parseCssColor(await page.getComputedStyle('body', 'background-color'));
        assert.ok(relativeLuminance(bg) < 0.2);
        page.assertNoRuntimeErrors('T2-F2-03');
      } finally {
        await page.close();
      }
    });

    test('T2-F2-04: Light & Dark foreground/background separation across statuses', async () => {
      const page = await openAppPage(browser, server.baseUrl, { colorScheme: 'light' });
      try {
        await loadNiche(page, makeUniqueNiche('ThemeContrast'));
        await setDayStatus(page, 2, 'grabado');
        await setDayStatus(page, 3, 'editado');
        await setDayStatus(page, 4, 'publicado');

        const inspectTheme = async (expectedTheme) => {
          assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), expectedTheme);
          const items = await page.evaluate(() => {
            const sels = [
              'body',
              '#btnGenerateRoadmap',
              '[data-card-status="1"]',
              '[data-card-status="2"]',
              '[data-card-status="3"]',
              '[data-card-status="4"]',
            ];
            return sels.map((s) => {
              const cs = window.getComputedStyle(document.querySelector(s));
              return { sel: s, color: cs.color, bg: cs.backgroundColor };
            });
          });
          for (const item of items) {
            assert.notEqual(item.color, item.bg, `${expectedTheme}: ${item.sel} color === backgroundColor`);
          }
          return relativeLuminance(parseCssColor(items[0].bg));
        };

        const lightLum = await inspectTheme('light');
        await page.click(SELECTORS.btnThemeToggle);
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
        const darkLum = await inspectTheme('dark');
        assert.ok(lightLum - darkLum > 0.4, `Expected >0.4 luminance contrast gap between Light (${lightLum}) and Dark (${darkLum})`);
        page.assertNoRuntimeErrors('T2-F2-04');
      } finally {
        await page.close();
      }
    });

    test('T2-F2-05: prefers-reduced-motion: reduce media query', async () => {
      const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.MOBILE });
      try {
        await page.setEmulatedMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
        await switchTab(page, 'youtube');
        assert.equal(await page.isVisible(SELECTORS.viewYoutube), true);
        await switchTab(page, 'roadmap');

        await page.click(SELECTORS.dayCardByNum(1));
        await page.waitForSelector(SELECTORS.dayInspector, { visible: true });
        await page.click(SELECTORS.btnCloseDrawer);
        await page.waitForSelector(SELECTORS.inspectorBackdrop, { hidden: true });
        page.assertNoRuntimeErrors('T2-F2-05');
      } finally {
        await page.close();
      }
    });

    test('T2-F2-06: Google Fonts CDN blocked / offline fallback', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.interceptRoute(/fonts\.google(apis|static)\.com/, async (route) => {
            await route.fail('Failed');
          });
        },
      });
      try {
        await assertNoHorizontalOverflow(page, 'T2-F2-06');
        assert.equal(await page.count(SELECTORS.dayCard), 30);
        page.assertNoPageErrors('T2-F2-06');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F3 Boundaries (6 cases)
  // =========================================================================
  describe('F3 Boundaries', () => {
    test('T2-F3-01: GET /health returns HTTP 500 or network failure', async () => {
      for (const mode of ['500', 'fail']) {
        const page = await openAppPage(browser, server.baseUrl, {
          beforeNavigate: async (p) => {
            await p.mockError('/health', mode === 'fail' ? { networkFail: true } : { status: 500 });
          },
        });
        try {
          await page.waitForFunction(
            (sel) => /Sin conexión/i.test(document.querySelector(sel)?.textContent || ''),
            [SELECTORS.statusHealthBadge]
          );
          assert.equal(await page.count(SELECTORS.dayCard), 30);
          page.assertNoPageErrors(`T2-F3-01(${mode})`);
        } finally {
          await page.close();
        }
      }
    });

    test('T2-F3-02: GET /health returns 200 with non-ok status or invalid JSON', async () => {
      for (const body of [{ status: 'error' }, 'not-json']) {
        const page = await openAppPage(browser, server.baseUrl, {
          beforeNavigate: async (p) => {
            await p.interceptRoute('/health', async (route) => {
              await route.fulfill({ status: 200, body });
            });
          },
        });
        try {
          await page.waitForFunction(
            (sel) => /Sin conexión/i.test(document.querySelector(sel)?.textContent || ''),
            [SELECTORS.statusHealthBadge]
          );
          assert.doesNotMatch(await page.getText(SELECTORS.statusHealthBadge), /Servidor OK/i);
          page.assertNoPageErrors('T2-F3-02');
        } finally {
          await page.close();
        }
      }
    });

    test('T2-F3-03: GET /api/oracle/status returns 500 or network abort', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.mockError('/api/oracle/status', { status: 500 });
        },
      });
      try {
        await page.waitForFunction(
          (sel) => /Oráculo con error/i.test(document.querySelector(sel)?.textContent || ''),
          [SELECTORS.statusOracleBadge]
        );
        assert.equal(await page.count(SELECTORS.dayCard), 30);
        page.assertNoPageErrors('T2-F3-03');
      } finally {
        await page.close();
      }
    });

    test('T2-F3-04: GET /api/oracle/status returns lastExecution.status === error', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/oracle/status', async (route) => {
            await route.fulfill({
              status: 200,
              body: {
                success: true,
                lastExecution: { status: 'error', timestamp: '2026-11-14T20:00:00Z', details: 'Gemini timeout' },
              },
            });
          });
        },
      });
      try {
        await page.waitForFunction(
          (sel) => /Oráculo con error/i.test(document.querySelector(sel)?.textContent || ''),
          [SELECTORS.statusOracleBadge]
        );
        page.assertNoRuntimeErrors('T2-F3-04');
      } finally {
        await page.close();
      }
    });

    test('T2-F3-05: Health outage followed by live recovery', async () => {
      let healthDown = true;
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.interceptRoute('/health', async (route) => {
            if (healthDown) {
              await route.fulfill({ status: 500, body: { error: 'Down' } });
            } else {
              await route.continue();
            }
          });
        },
      });
      try {
        await page.waitForFunction(
          (sel) => /Sin conexión/i.test(document.querySelector(sel)?.textContent || ''),
          [SELECTORS.statusHealthBadge]
        );

        healthDown = false;
        await page.click(SELECTORS.btnRunOracle);
        await confirmDialogAccept(page);
        await page.waitForFunction(
          (sel) => /Servidor OK/i.test(document.querySelector(sel)?.textContent || ''),
          [SELECTORS.statusHealthBadge]
        );
        page.assertNoPageErrors('T2-F3-05');
      } finally {
        await page.close();
      }
    });

    test('T2-F3-06: Slow /health & /api/oracle/status (1200ms delay) does not block roadmap', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        waitForCards: false,
        beforeNavigate: async (p) => {
          await p.interceptRoute((u) => u.includes('/health') || u.includes('/api/oracle/status'), async (route) => {
            await new Promise((r) => setTimeout(r, 1200));
            await route.continue();
          });
        },
      });
      try {
        await waitForRoadmapHydrated(page);
        assert.equal(await page.count(SELECTORS.dayCard), 30);
        await page.waitForFunction(
          (sel) => /Servidor OK/i.test(document.querySelector(sel)?.textContent || ''),
          [SELECTORS.statusHealthBadge]
        );
        page.assertNoRuntimeErrors('T2-F3-06');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F4 Boundaries (6 cases)
  // =========================================================================
  describe('F4 Boundaries', () => {
    test('T2-F4-01: Empty / whitespace-only #nicheInput', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        page.clearRecordedRequests();
        await page.fill(SELECTORS.nicheInput, '   ');
        await page.click(SELECTORS.btnLoadRoadmap);
        await new Promise((r) => setTimeout(r, 250));

        const reqs = page.getRecordedRequests().filter((r) => r.url.includes('/api/roadmap'));
        for (const r of reqs) {
          assert.doesNotMatch(r.url, /niche=undefined/);
        }
        assert.equal(await page.count(SELECTORS.dayCard), 30);
        page.assertNoRuntimeErrors('T2-F4-01');
      } finally {
        await page.close();
      }
    });

    test('T2-F4-02: Ultra-long niche string (260 chars + &, ?, =, emoji)', async () => {
      const longNiche = `Automatización & IA?key=1 "Pro" 🚀 ${'x'.repeat(225)}`;
      const page = await openAppPage(browser, server.baseUrl);
      try {
        page.clearRecordedRequests();
        await loadNiche(page, longNiche);

        const req = page.getRecordedRequests().find((r) => r.url.includes('/api/roadmap?'));
        assert.ok(req);
        assert.ok(req.url.includes(encodeURIComponent('&')));
        assert.equal(await page.count(SELECTORS.dayCard), 30);
        await assertNoHorizontalOverflow(page, 'T2-F4-02');
        page.assertNoRuntimeErrors('T2-F4-02');
      } finally {
        await page.close();
      }
    });

    test('T2-F4-03: Offline / 500 fallback on GET /api/roadmap (#roadmapSourceNotice)', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        waitForCards: false,
        beforeNavigate: async (p) => {
          await p.mockError('/api/roadmap', { status: 500 });
        },
      });
      try {
        await waitForRoadmapHydrated(page);
        assert.equal(await page.isVisible(SELECTORS.roadmapSourceNotice), true);
        assert.equal(await page.count(SELECTORS.dayCard), 30);
        assert.equal(await page.isVisible(SELECTORS.roadmapLinearProgress), false);
        assert.ok((await page.getText(SELECTORS.toastContainer)).length > 0);
        page.assertNoPageErrors('T2-F4-03');
      } finally {
        await page.close();
      }
    });

    test('T2-F4-04: 500 error on POST /api/roadmap/generate preserves existing 30 cards', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await page.mockError('/api/roadmap/generate', { status: 500 });
        await page.click(SELECTORS.btnGenerateRoadmap);
        await confirmDialogAccept(page);

        await page.waitForFunction(() => (document.querySelector('#toastContainer')?.textContent || '').trim().length > 0);
        assert.equal(await page.isVisible(SELECTORS.roadmapLinearProgress), false);
        const disabled = await page.evaluate(() => document.querySelector('#btnGenerateRoadmap').disabled);
        assert.equal(disabled, false);
        assert.equal(await page.count(SELECTORS.dayCard), 30);
        page.assertNoPageErrors('T2-F4-04');
      } finally {
        await page.close();
      }
    });

    test('T2-F4-05: Concurrent double-submit / busy lock on #btnGenerateRoadmap', async () => {
      let postCount = 0;
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/roadmap/generate', async (route) => {
            postCount++;
            await new Promise((r) => setTimeout(r, 800));
            await route.continue();
          });
        },
      });
      try {
        await page.fill(SELECTORS.nicheInput, makeUniqueNiche('BusyLock'));
        await page.click(SELECTORS.btnGenerateRoadmap);
        await confirmDialogAccept(page);

        await new Promise((r) => setTimeout(r, 100));
        const isDisabledWhileInFlight = await page.evaluate(() => document.querySelector('#btnGenerateRoadmap').disabled);
        assert.equal(isDisabledWhileInFlight, true, '#btnGenerateRoadmap must disable while generation is in-flight');

        await page.evaluate(() => document.querySelector('#btnGenerateRoadmap').click());
        await new Promise((r) => setTimeout(r, 950));
        assert.equal(postCount, 1, 'Busy lock must prevent duplicate POST /api/roadmap/generate');
        assert.equal(await page.evaluate(() => document.querySelector('#btnGenerateRoadmap').disabled), false);
        page.assertNoRuntimeErrors('T2-F4-05');
      } finally {
        await page.close();
      }
    });

    test('T2-F4-06: Empty #igAccountInput & special-char account on Oracle run', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await page.fill(SELECTORS.igAccountInput, '');
        await page.click(SELECTORS.btnRunOracle);
        await confirmDialogAccept(page);
        await page.waitForFunction(() => /Oráculo/i.test(document.querySelector('#toastContainer')?.textContent || ''));

        await page.fill(SELECTORS.igAccountInput, '@user.name_123');
        await page.click(SELECTORS.btnRunOracle);
        await confirmDialogAccept(page);
        await page.waitForFunction(() => (document.querySelector('#toastContainer')?.textContent || '').trim().length > 0);
        page.assertNoRuntimeErrors('T2-F4-06');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F5 Boundaries (6 cases)
  // =========================================================================
  describe('F5 Boundaries', () => {
    test('T2-F5-01: RFC-4180 CSV escaping: quotes, commas, newlines, accents, emoji', async () => {
      const trickyHook = 'Gancho "viral", paso 1\nlínea 2 áéíóú 🔥';
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await selectDay(page, 1);
        await page.click(SELECTORS.btnToggleEditMode);
        await page.fill(SELECTORS.editHookInput, trickyHook);
        await page.click(SELECTORS.btnSaveDraft);
        await page.waitForSelector(SELECTORS.draftEditorForm, { hidden: true });

        const dl = await page.waitForDownload(() => page.click(SELECTORS.btnExportCsv));
        const { rows } = parseRfc4180Csv(dl.buffer);
        assert.equal(rows.length, 31);
        for (const r of rows) assert.equal(r.length, CSV_HEADERS_COUNT);
        assert.ok(rows[1].includes(trickyHook), `Expected exact unescaped multi-line hook in row 1, got ${JSON.stringify(rows[1])}`);
        page.assertNoRuntimeErrors('T2-F5-01');
      } finally {
        await page.close();
      }
    });

    test('T2-F5-02: UTF-8 BOM byte integrity & quoted niche across all 30 rows', async () => {
      const trickyNiche = 'IA, Prompts & "Reels"';
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await loadNiche(page, trickyNiche);
        const dl = await page.waitForDownload(() => page.click(SELECTORS.btnExportCsv));
        assert.deepEqual([...dl.buffer.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
        assert.equal(dl.content.includes('\uFFFD'), false);

        const { rows } = parseRfc4180Csv(dl.buffer);
        assert.equal(rows.length, 31);
        for (const r of rows) assert.equal(r.length, CSV_HEADERS_COUNT);
        page.assertNoRuntimeErrors('T2-F5-02');
      } finally {
        await page.close();
      }
    });

    test('T2-F5-03: Export while filter shows 0 visible cards (#roadmapEmptyState active)', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await page.type(SELECTORS.searchRoadmapInput, '__NO_MATCH__');
        await page.waitForSelector(SELECTORS.roadmapEmptyState, { visible: true });

        const csvDl = await page.waitForDownload(() => page.click(SELECTORS.btnExportCsv));
        const { rows } = parseRfc4180Csv(csvDl.buffer);
        assert.equal(rows.length, 31);

        const jsonDl = await page.waitForDownload(() => page.click(SELECTORS.btnExportJson));
        assert.equal(JSON.parse(jsonDl.content).length, 30);
        page.assertNoRuntimeErrors('T2-F5-03');
      } finally {
        await page.close();
      }
    });

    test('T2-F5-04: Export of offline client-fallback roadmap', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        waitForCards: false,
        beforeNavigate: async (p) => {
          await p.mockError('/api/roadmap', { status: 500 });
        },
      });
      try {
        await waitForRoadmapHydrated(page);
        const csvDl = await page.waitForDownload(() => page.click(SELECTORS.btnExportCsv));
        const { rows } = parseRfc4180Csv(csvDl.buffer);
        assert.equal(rows.length, 31);
        for (const r of rows) assert.equal(r.length, CSV_HEADERS_COUNT);

        const jsonDl = await page.waitForDownload(() => page.click(SELECTORS.btnExportJson));
        const items = JSON.parse(jsonDl.content);
        assert.equal(items.length, 30);
        page.assertNoPageErrors('T2-F5-04');
      } finally {
        await page.close();
      }
    });

    test('T2-F5-05: Missing/null optional fields (hashtags: undefined, reference_video_id: null)', async () => {
      const niche = makeUniqueNiche('MissingOpt');
      const roadmap = makeMockRoadmap(niche, {
        1: { hashtags: undefined, reference_video_id: null },
      });
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/roadmap?', async (route) => {
            await route.fulfill({ status: 200, body: { success: true, count: 30, niche, roadmap } });
          });
        },
      });
      try {
        const csvDl = await page.waitForDownload(() => page.click(SELECTORS.btnExportCsv));
        const { rows } = parseRfc4180Csv(csvDl.buffer);
        assert.equal(rows[1].length, CSV_HEADERS_COUNT);
        assert.equal(rows[1].some((cell) => cell === 'undefined'), false);

        const jsonDl = await page.waitForDownload(() => page.click(SELECTORS.btnExportJson));
        assert.equal(JSON.parse(jsonDl.content).length, 30);
        page.assertNoRuntimeErrors('T2-F5-05');
      } finally {
        await page.close();
      }
    });

    test('T2-F5-06: Rapid consecutive CSV + JSON export clicks', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        const csvDl = await page.waitForDownload(() => page.click(SELECTORS.btnExportCsv));
        const jsonDl = await page.waitForDownload(() => page.click(SELECTORS.btnExportJson));
        assert.equal(parseRfc4180Csv(csvDl.buffer).rows.length, 31);
        assert.equal(JSON.parse(jsonDl.content).length, 30);
        assert.ok((await page.evaluate(() => document.querySelector('#toastContainer').children.length)) <= 1);
        page.assertNoRuntimeErrors('T2-F5-06');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F6 Boundaries (6 cases)
  // =========================================================================
  describe('F6 Boundaries', () => {
    test('T2-F6-01: Zero-match combined filters -> #roadmapEmptyState & #btnEmptyResetFilters', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await page.type(SELECTORS.searchRoadmapInput, 'xyznonexistent987');
        await page.waitForSelector(SELECTORS.roadmapEmptyState, { visible: true });
        assert.equal(await page.countVisible(SELECTORS.dayCard), 0);
        assert.match(await page.getText(SELECTORS.roadmapEmptyState), /Sin resultados/i);

        await page.click(SELECTORS.btnEmptyResetFilters);
        await waitForRoadmapHydrated(page);
        assert.equal(await page.isVisible(SELECTORS.roadmapEmptyState), false);
        page.assertNoRuntimeErrors('T2-F6-01');
      } finally {
        await page.close();
      }
    });

    test('T2-F6-02: Rapid typing & clearing in #searchRoadmapInput (debounce & zero flicker)', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await page.type(SELECTORS.searchRoadmapInput, 'Tutorial', { delayMs: 20 });
        const opacityDuringTyping = await page.getComputedStyle(SELECTORS.roadmapList, 'opacity');
        assert.equal(opacityDuringTyping, '1');

        await new Promise((r) => setTimeout(r, 400));
        const filteredCount = await page.countVisible(SELECTORS.dayCard);
        assert.ok(filteredCount < 30, 'Debounced search should filter cards');

        await page.fill(SELECTORS.searchRoadmapInput, '');
        await page.waitForFunction(() => document.querySelectorAll('.day-card').length === 30);
        page.assertNoRuntimeErrors('T2-F6-02');
      } finally {
        await page.close();
      }
    });

    test('T2-F6-03: Case-insensitive, whitespace-padded & regex-metacharacter search queries', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await page.fill(SELECTORS.searchRoadmapInput, '  REEL  ');
        await page.waitForFunction(() => document.querySelectorAll('.day-card').length > 0 && document.querySelectorAll('.day-card').length < 30);

        await page.fill(SELECTORS.searchRoadmapInput, '.*+?^${}()|[]');
        await page.waitForSelector(SELECTORS.roadmapEmptyState, { visible: true });
        assert.equal(await page.countVisible(SELECTORS.dayCard), 0);
        page.assertNoRuntimeErrors('T2-F6-03');
      } finally {
        await page.close();
      }
    });

    test('T2-F6-04: Search matches locally edited draft text', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await selectDay(page, 4);
        await page.click(SELECTORS.btnToggleEditMode);
        await page.fill(SELECTORS.editHookInput, 'TokenUnicoBorrador777');
        await page.click(SELECTORS.btnSaveDraft);
        await page.waitForSelector(SELECTORS.draftEditorForm, { hidden: true });

        await page.fill(SELECTORS.searchRoadmapInput, 'TokenUnicoBorrador777');
        await page.waitForFunction(() => document.querySelectorAll('.day-card').length === 1);
        assert.equal(await page.exists(SELECTORS.dayCardByNum(4)), true);
        page.assertNoRuntimeErrors('T2-F6-04');
      } finally {
        await page.close();
      }
    });

    test('T2-F6-05: 100% completion boundary (30/30 publicado)', async () => {
      const niche = makeUniqueNiche('AllDone');
      const overrides = {};
      for (let d = 1; d <= 30; d++) overrides[d] = { status: 'publicado' };
      const roadmap = makeMockRoadmap(niche, overrides);

      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/roadmap?', async (route) => {
            await route.fulfill({ status: 200, body: { success: true, count: 30, niche, roadmap } });
          });
        },
      });
      try {
        assert.equal(await page.getText(SELECTORS.progressSummaryText), '30 / 30 publicados · 100%');
        assert.equal(await page.getText(SELECTORS.countTotal), '30');
        assert.equal(await page.getText(SELECTORS.countPublicado), '30');
        assert.equal(await page.getText(SELECTORS.countPendiente), '0');

        const widths = await page.evaluate(() => {
          const fill = document.querySelector('#progressFill');
          const track = fill.parentElement;
          return { fillW: fill.getBoundingClientRect().width, trackW: track.getBoundingClientRect().width };
        });
        assert.ok(widths.fillW > 0 && widths.fillW <= widths.trackW + 1, `Progress fill overflowed track: ${JSON.stringify(widths)}`);
        page.assertNoRuntimeErrors('T2-F6-05');
      } finally {
        await page.close();
      }
    });

    test('T2-F6-06: Week 4 9-day boundary (Days 22-30) & partition sum invariant', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        const counts = [];
        for (const btn of [SELECTORS.btnWeek1, SELECTORS.btnWeek2, SELECTORS.btnWeek3, SELECTORS.btnWeek4]) {
          await page.click(btn);
          counts.push(await page.countVisible(SELECTORS.dayCard));
        }
        assert.deepEqual(counts, [7, 7, 7, 9]);
        assert.equal(counts.reduce((a, b) => a + b, 0), 30);
        assert.equal(await page.exists(SELECTORS.dayCardByNum(22)), true);
        assert.equal(await page.exists(SELECTORS.dayCardByNum(29)), true);
        assert.equal(await page.exists(SELECTORS.dayCardByNum(30)), true);
        page.assertNoRuntimeErrors('T2-F6-06');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F7 Boundaries (6 cases)
  // =========================================================================
  describe('F7 Boundaries', () => {
    test('T2-F7-01: Empty week headers suppressed when filtering', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await page.click(SELECTORS.btnWeek3);
        const listText = await page.getText(SELECTORS.roadmapList);
        assert.match(listText, /Semana 3/);
        assert.doesNotMatch(listText, /Semana 1/);
        assert.doesNotMatch(listText, /Semana 2/);
        assert.doesNotMatch(listText, /Semana 4/);
        page.assertNoRuntimeErrors('T2-F7-01');
      } finally {
        await page.close();
      }
    });

    test('T2-F7-02: Long title (300 chars) & long hook (400 chars) containment', async () => {
      const niche = makeUniqueNiche('LongCard');
      const roadmap = makeMockRoadmap(niche, {
        1: { title: 'TituloMuyLargo_' + 'A'.repeat(285), hook: 'GanchoMuyLargo ' + 'palabra '.repeat(50) },
      });
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/roadmap?', async (route) => {
            await route.fulfill({ status: 200, body: { success: true, count: 30, niche, roadmap } });
          });
        },
      });
      try {
        for (const vp of [VIEWPORTS.DESKTOP, VIEWPORTS.MOBILE]) {
          await page.setViewport(vp);
          await new Promise((r) => setTimeout(r, 60));
          await assertNoHorizontalOverflow(page, `T2-F7-02-${vp.width}`);
          const geom = await page.evaluate(() => {
            const c1 = document.querySelector('#day-card-1');
            const c2 = document.querySelector('#day-card-2');
            const rect1 = c1.getBoundingClientRect();
            const rect2 = c2.getBoundingClientRect();
            return {
              c1ScrollW: c1.scrollWidth,
              c1ClientW: c1.clientWidth,
              r1: { left: rect1.left, top: rect1.top, right: rect1.right, bottom: rect1.bottom, width: rect1.width, height: rect1.height },
              r2: { left: rect2.left, top: rect2.top, right: rect2.right, bottom: rect2.bottom, width: rect2.width, height: rect2.height },
            };
          });
          assert.ok(geom.c1ScrollW <= geom.c1ClientW + 2, `Card 1 horizontal scroll overflow: ${geom.c1ScrollW} > ${geom.c1ClientW}`);
          assert.equal(rectsOverlap(geom.r1, geom.r2), false, 'Card 1 must not overlap Card 2');
        }
        page.assertNoRuntimeErrors('T2-F7-02');
      } finally {
        await page.close();
      }
    });

    test('T2-F7-03: Empty roadmap array (200 roadmap: [])', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        waitForCards: false,
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/roadmap?', async (route) => {
            await route.fulfill({ status: 200, body: { success: true, count: 0, niche: 'Empty', roadmap: [] } });
          });
        },
      });
      try {
        await page.waitForSelector(SELECTORS.roadmapEmptyState, { visible: true });
        assert.equal(await page.count(SELECTORS.dayCard), 0);
        assert.equal(await page.getText(SELECTORS.countTotal), '0');
        assert.equal(await page.getText(SELECTORS.progressSummaryText), '0 / 0 publicados · 0%');
        page.assertNoRuntimeErrors('T2-F7-03');
      } finally {
        await page.close();
      }
    });

    test('T2-F7-04: Keyboard focus & activation on .day-card', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await page.focus(SELECTORS.dayCardByNum(3));
        assert.equal(await page.evaluate(() => document.activeElement?.id), 'day-card-3');
        await page.pressKey('Enter');
        assert.equal(await page.getAttr(SELECTORS.dayCardByNum(3), 'aria-current'), 'true');
        assert.match(await page.getText(SELECTORS.inspectorDayBadge), /0?3/);

        await page.focus(SELECTORS.dayCardByNum(4));
        await page.pressKey('Space');
        assert.equal(await page.getAttr(SELECTORS.dayCardByNum(4), 'aria-current'), 'true');
        page.assertNoRuntimeErrors('T2-F7-04');
      } finally {
        await page.close();
      }
    });

    test('T2-F7-05: Grid vs Timeline/List geometry without card overlap', async () => {
      const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.DESKTOP });
      try {
        const checkNonOverlapping = async () => {
          const rects = await page.evaluate(() =>
            [1, 2, 3, 4, 5, 6].map((n) => {
              const r = document.querySelector(`#day-card-${n}`).getBoundingClientRect();
              return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
            })
          );
          for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
              assert.equal(rectsOverlap(rects[i], rects[j]), false, `Cards ${i + 1} and ${j + 1} overlap`);
            }
          }
          return rects;
        };

        await checkNonOverlapping();
        await page.click(SELECTORS.viewModeTimeline);
        const timelineRects = await checkNonOverlapping();
        for (let i = 0; i < timelineRects.length - 1; i++) {
          assert.ok(timelineRects[i + 1].top >= timelineRects[i].bottom - 1, 'Timeline cards must stack vertically');
        }
        await page.setViewport(VIEWPORTS.MOBILE);
        await new Promise((r) => setTimeout(r, 60));
        await checkNonOverlapping();
        page.assertNoRuntimeErrors('T2-F7-05');
      } finally {
        await page.close();
      }
    });

    test('T2-F7-06: Boot skeleton cleanup on initial GET /api/roadmap failure (500)', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        waitForCards: false,
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/roadmap', async (route) => {
            await new Promise((r) => setTimeout(r, 400));
            await route.fulfill({ status: 500, body: { success: false, error: 'Down' } });
          });
        },
      });
      try {
        await new Promise((r) => setTimeout(r, 150));
        const skeletonsWhilePending = await page.evaluate(
          () => document.querySelectorAll('#roadmapList [class*="skeleton"], #roadmapList .skeleton-card').length
        );
        assert.ok(skeletonsWhilePending > 0, 'Expected boot skeletons while GET /api/roadmap is pending');

        await waitForRoadmapHydrated(page);
        const skeletonsAfter = await page.evaluate(
          () => document.querySelectorAll('#roadmapList [class*="skeleton"], #roadmapList .skeleton-card').length
        );
        assert.equal(skeletonsAfter, 0);
        assert.equal(await page.isVisible(SELECTORS.roadmapSourceNotice), true);
        page.assertNoPageErrors('T2-F7-06');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F8 Boundaries (6 cases)
  // =========================================================================
  describe('F8 Boundaries', () => {
    test('T2-F8-01: Mobile <1024px modal sheet accessibility contract (Focus trap + scroll lock + focus return)', async () => {
      const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.MOBILE });
      try {
        await page.click(SELECTORS.dayCardByNum(4));
        await page.waitForSelector(SELECTORS.inspectorBackdrop, { visible: true });

        assert.equal(await page.getAttr(SELECTORS.dayInspector, 'role'), 'dialog');
        assert.equal(await page.getAttr(SELECTORS.dayInspector, 'aria-modal'), 'true');

        const overflowLocked = await page.evaluate(() => {
          const ov = window.getComputedStyle(document.body).overflow;
          return ov === 'hidden' || document.body.classList.contains('modal-open') || document.body.style.overflow === 'hidden';
        });
        assert.equal(overflowLocked, true, 'Mobile modal sheet must lock body scroll');

        for (let i = 0; i < 15; i++) {
          await page.pressKey('Tab');
          const inside = await page.evaluate(() => Boolean(document.activeElement?.closest('#dayInspector')));
          assert.equal(inside, true, `Tab #${i + 1} escaped #dayInspector focus trap`);
        }

        await page.pressKey('Tab', { shiftKey: true });
        assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('#dayInspector'))), true);

        await page.pressKey('Escape');
        await page.waitForSelector(SELECTORS.inspectorBackdrop, { hidden: true });

        const overflowAfter = await page.getComputedStyle('body', 'overflow');
        assert.notEqual(overflowAfter, 'hidden');
        assert.equal(await page.evaluate(() => document.activeElement?.id), 'day-card-4');
        page.assertNoRuntimeErrors('T2-F8-01');
      } finally {
        await page.close();
      }
    });

    test('T2-F8-02: Mobile backdrop click closes modal sheet and restores scroll', async () => {
      const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.MOBILE });
      try {
        await page.click(SELECTORS.dayCardByNum(7));
        await page.waitForSelector(SELECTORS.inspectorBackdrop, { visible: true });

        // Click top-left corner of backdrop outside the centered/bottom modal sheet
        await page.evaluate(() => {
          document.querySelector('#inspectorBackdrop').click();
        });
        await page.waitForSelector(SELECTORS.inspectorBackdrop, { hidden: true });
        assert.notEqual(await page.getComputedStyle('body', 'overflow'), 'hidden');
        page.assertNoRuntimeErrors('T2-F8-02');
      } finally {
        await page.close();
      }
    });

    test('T2-F8-03: ArrowLeft/ArrowRight ignored while typing in INPUT, TEXTAREA, SELECT', async () => {
      const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.DESKTOP });
      try {
        await selectDay(page, 5);

        await page.focus(SELECTORS.searchRoadmapInput);
        await page.pressKey('ArrowRight');
        assert.equal(await page.getAttr(SELECTORS.dayCardByNum(5), 'aria-current'), 'true');

        await page.focus(SELECTORS.formatFilterSelect);
        await page.pressKey('ArrowLeft');
        assert.equal(await page.getAttr(SELECTORS.dayCardByNum(5), 'aria-current'), 'true');

        await page.click(SELECTORS.btnToggleEditMode);
        await page.focus(SELECTORS.editHookInput);
        await page.pressKey('ArrowRight');
        assert.equal(await page.getAttr(SELECTORS.dayCardByNum(5), 'aria-current'), 'true');
        page.assertNoRuntimeErrors('T2-F8-03');
      } finally {
        await page.close();
      }
    });

    test('T2-F8-04: Day 1 #btnPrevDay disabled & Day 30 #btnNextDay disabled (+ arrow bounds)', async () => {
      const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.DESKTOP });
      try {
        await selectDay(page, 1);
        assert.equal(await page.evaluate(() => document.querySelector('#btnPrevDay').disabled), true);
        await page.evaluate(() => document.activeElement?.blur?.());
        await page.pressKey('ArrowLeft');
        assert.equal(await page.getAttr(SELECTORS.dayCardByNum(1), 'aria-current'), 'true');

        await selectDay(page, 30);
        assert.equal(await page.evaluate(() => document.querySelector('#btnNextDay').disabled), true);
        await page.evaluate(() => document.activeElement?.blur?.());
        await page.pressKey('ArrowRight');
        assert.equal(await page.getAttr(SELECTORS.dayCardByNum(30), 'aria-current'), 'true');
        page.assertNoRuntimeErrors('T2-F8-04');
      } finally {
        await page.close();
      }
    });

    test('T2-F8-05: Prev/Next navigation respects active filter subset', async () => {
      const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.DESKTOP });
      try {
        await page.click(SELECTORS.btnWeek2);
        await selectDay(page, 8);
        assert.equal(await page.evaluate(() => document.querySelector('#btnPrevDay').disabled), true);

        await selectDay(page, 14);
        assert.equal(await page.evaluate(() => document.querySelector('#btnNextDay').disabled), true);

        await page.click(SELECTORS.btnPrevDay);
        assert.equal(await page.getAttr(SELECTORS.dayCardByNum(13), 'aria-current'), 'true');
        page.assertNoRuntimeErrors('T2-F8-05');
      } finally {
        await page.close();
      }
    });

    test('T2-F8-06: Viewport resize across 1024px threshold cleans up modal state', async () => {
      const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.MOBILE });
      try {
        await page.click(SELECTORS.dayCardByNum(3));
        await page.waitForSelector(SELECTORS.inspectorBackdrop, { visible: true });

        await page.setViewport(VIEWPORTS.DESKTOP);
        await new Promise((r) => setTimeout(r, 80));
        assert.equal(await page.isVisible(SELECTORS.inspectorBackdrop), false);
        assert.notEqual(await page.getComputedStyle('body', 'overflow'), 'hidden');
        assert.equal(await page.isVisible(SELECTORS.dayInspector), true);

        await page.setViewport(VIEWPORTS.MOBILE);
        await new Promise((r) => setTimeout(r, 80));
        assert.equal(await page.isVisible(SELECTORS.inspectorBackdrop), false);
        page.assertNoRuntimeErrors('T2-F8-06');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F9 Boundaries (5 cases)
  // =========================================================================
  describe('F9 Boundaries', () => {
    test('T2-F9-01: Invalid status value sent to PATCH /api/roadmap/:id/status returns 400', async () => {
      const res = await fetch(`${server.baseUrl}${ROUTES.ROADMAP_STATUS('1')}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'invalido' }),
      });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.match(body.error, /Estado inválido/);
    });

    test('T2-F9-02: Non-existent ID sent to PATCH /api/roadmap/:id/status returns 404', async () => {
      for (const badId of ['00000000-0000-0000-0000-000000000999', '999']) {
        const res = await fetch(`${server.baseUrl}${ROUTES.ROADMAP_STATUS(badId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'grabado' }),
        });
        assert.equal(res.status, 404);
        const body = await res.json();
        assert.equal(body.success, false);
        assert.equal(body.error, 'Elemento no encontrado');
      }
    });

    test('T2-F9-03: Optimistic rollback when PATCH /api/roadmap/:id/status returns 500', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await loadNiche(page, makeUniqueNiche('F9-Rollback'));
        await selectDay(page, 1);

        await page.mockError('/status', { status: 500, body: { success: false, error: 'DB fail' } });
        await page.click(SELECTORS.statusBtn('publicado'));

        await page.waitForFunction(() => document.querySelector('#statusBtn-pendiente')?.getAttribute('aria-pressed') === 'true');
        assert.equal(await page.getAttr(SELECTORS.statusBtn('publicado'), 'aria-pressed'), 'false');
        assert.equal(await page.getText(SELECTORS.cardStatusByNum(1)), 'Pendiente');
        assert.equal(await page.getText(SELECTORS.countPublicado), '0');
        assert.equal(await page.getText(SELECTORS.countPendiente), '30');
        assert.ok((await page.getText(SELECTORS.toastContainer)).length > 0);
        page.assertNoPageErrors('T2-F9-03');
      } finally {
        await page.close();
      }
    });

    test('T2-F9-04: Consistent capitalized labels on cards AND inspector buttons', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await loadNiche(page, makeUniqueNiche('F9-Labels'));
        await setDayStatus(page, 2, 'grabado');
        await setDayStatus(page, 3, 'editado');
        await setDayStatus(page, 4, 'publicado');

        assert.equal(await page.getText(SELECTORS.cardStatusByNum(1)), STATUS_LABELS.pendiente);
        assert.equal(await page.getText(SELECTORS.cardStatusByNum(2)), STATUS_LABELS.grabado);
        assert.equal(await page.getText(SELECTORS.cardStatusByNum(3)), STATUS_LABELS.editado);
        assert.equal(await page.getText(SELECTORS.cardStatusByNum(4)), STATUS_LABELS.publicado);

        for (const [k, label] of Object.entries(STATUS_LABELS)) {
          assert.equal(await page.getText(SELECTORS.statusBtn(k)), label);
        }
        page.assertNoRuntimeErrors('T2-F9-04');
      } finally {
        await page.close();
      }
    });

    test('T2-F9-05: Clicking currently active status button is idempotent', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await loadNiche(page, makeUniqueNiche('F9-Idempotent'));
        await setDayStatus(page, 1, 'grabado');
        await page.click(SELECTORS.statusBtn('grabado'));
        await new Promise((r) => setTimeout(r, 150));

        assert.equal(await page.getText(SELECTORS.countGrabado), '1');
        assert.equal(await page.getText(SELECTORS.countTotal), '30');
        assert.equal(await page.getText(SELECTORS.cardStatusByNum(1)), 'Grabado');
        page.assertNoRuntimeErrors('T2-F9-05');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F10 Boundaries (5 cases)
  // =========================================================================
  describe('F10 Boundaries', () => {
    test('T2-F10-01: demo_yt_* reference renders non-link #inspectorRefLink without href', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await selectDay(page, 1);
        assert.equal(await page.getAttr(SELECTORS.inspectorRefLink, 'href'), null);
        assert.match(await page.getText(SELECTORS.inspectorRefLink), /demo/i);
        assert.notEqual(await page.getComputedStyle(SELECTORS.inspectorRefLink, 'text-decoration-line'), 'underline');
        page.assertNoRuntimeErrors('T2-F10-01');
      } finally {
        await page.close();
      }
    });

    test('T2-F10-02: #visualRefThumb visible when thumbnail matches stored video vs hidden when absent', async () => {
      const niche = makeUniqueNiche('F10-Thumb');
      const roadmap = makeMockRoadmap(niche, {
        1: { reference_video_id: 'dQw4w9WgXcQ' },
        2: { reference_video_id: null },
      });
      const videos = makeMockVideos(1, 'Thumb Match');

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
        assert.equal(await page.isVisible(SELECTORS.visualRefThumb), true);
        assert.match(await page.getAttr(SELECTORS.visualRefThumb, 'src'), /dQw4w9WgXcQ/);

        await selectDay(page, 2);
        assert.equal(await page.isVisible(SELECTORS.visualRefThumb), false);
        page.assertNoRuntimeErrors('T2-F10-02');
      } finally {
        await page.close();
      }
    });

    test('T2-F10-03: Clipboard failure fallback shows graceful Snackbar error', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        initScripts: [
          `Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: () => Promise.reject(new Error('Denied')) }
          });`,
        ],
      });
      try {
        await selectDay(page, 1);
        await page.click(SELECTORS.btnCopyHook);
        await page.waitForFunction(() => (document.querySelector('#toastContainer')?.textContent || '').trim().length > 0);
        page.assertNoPageErrors('T2-F10-03');
      } finally {
        await page.close();
      }
    });

    test('T2-F10-04: Missing/empty hashtags array renders cleanly and Copy Caption trims whitespace', async () => {
      const niche = makeUniqueNiche('F10-NoHash');
      const roadmap = makeMockRoadmap(niche, { 1: { hashtags: [], caption: 'Caption sin tags' } });
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/roadmap?', async (route) => {
            await route.fulfill({ status: 200, body: { success: true, count: 30, niche, roadmap } });
          });
        },
      });
      try {
        await selectDay(page, 1);
        assert.doesNotMatch(await page.getText(SELECTORS.inspectorHashtags), /undefined/);
        await page.click(SELECTORS.btnCopyCaption);
        assert.equal(await page.readClipboard(), 'Caption sin tags');
        page.assertNoRuntimeErrors('T2-F10-04');
      } finally {
        await page.close();
      }
    });

    test('T2-F10-05: Carrusel (1:1) vs Reel/Story (9:16) CSS geometry ratio verification', async () => {
      const niche = makeUniqueNiche('F10-Geom');
      const roadmap = makeMockRoadmap(niche, { 1: { format: 'Reel' }, 2: { format: 'Carrusel' } });
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/roadmap?', async (route) => {
            await route.fulfill({ status: 200, body: { success: true, count: 30, niche, roadmap } });
          });
        },
      });
      try {
        await selectDay(page, 1);
        const reelRect = await page.getBoundingRect(SELECTORS.visualAspectFrame);
        assert.ok(reelRect.height > reelRect.width, `Reel 9:16 must be portrait: ${JSON.stringify(reelRect)}`);
        assert.ok(Math.abs(reelRect.width / reelRect.height - 9 / 16) < 0.12, `Unexpected 9:16 ratio: ${reelRect.width / reelRect.height}`);

        await selectDay(page, 2);
        const carRect = await page.getBoundingRect(SELECTORS.visualAspectFrame);
        assert.ok(Math.abs(carRect.width / carRect.height - 1.0) < 0.08, `Unexpected 1:1 ratio: ${carRect.width / carRect.height}`);
        page.assertNoRuntimeErrors('T2-F10-05');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F11 Boundaries (6 cases)
  // =========================================================================
  describe('F11 Boundaries', () => {
    test('T2-F11-01: content_studio_drafts_v1 exact key format niche.toLowerCase()::day', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await selectDay(page, 7);
        await page.click(SELECTORS.btnToggleEditMode);
        await page.fill(SELECTORS.editHookInput, 'Hook Day 7 Key');
        await page.click(SELECTORS.btnSaveDraft);
        await page.waitForSelector(SELECTORS.draftEditorForm, { hidden: true });

        const drafts = JSON.parse(await page.getLocalStorage(STORAGE_KEYS.DRAFTS));
        assert.equal(drafts[`${DEFAULT_NICHE.toLowerCase()}::7`]?.hook, 'Hook Day 7 Key');
        page.assertNoRuntimeErrors('T2-F11-01');
      } finally {
        await page.close();
      }
    });

    test('T2-F11-02: Saving empty/whitespace-only edits is handled safely', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await selectDay(page, 1);
        await page.click(SELECTORS.btnToggleEditMode);
        await page.fill(SELECTORS.editHookInput, '   ');
        await page.fill(SELECTORS.editScriptInput, '');
        await page.click(SELECTORS.btnSaveDraft);
        await page.waitForSelector(SELECTORS.draftEditorForm, { hidden: true });

        await new Promise((r) => setTimeout(r, 100));
        assert.doesNotMatch(await page.getText(SELECTORS.inspectorHook), /undefined/);
        page.assertNoRuntimeErrors('T2-F11-02');
      } finally {
        await page.close();
      }
    });

    test('T2-F11-03: Cancelling edit discards unsaved input changes', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await selectDay(page, 1);
        const origHook = await page.getText(SELECTORS.inspectorHook);

        await page.click(SELECTORS.btnToggleEditMode);
        await page.fill(SELECTORS.editHookInput, 'Temp Unsaved');
        await page.fill(SELECTORS.editPromptInput, 'Temp Prompt');
        await page.click(SELECTORS.btnCancelDraft);

        await page.waitForSelector(SELECTORS.draftEditorForm, { hidden: true });
        assert.equal(await page.getText(SELECTORS.inspectorHook), origHook);
        assert.equal(await page.getLocalStorage(STORAGE_KEYS.DRAFTS), null);

        await page.click(SELECTORS.btnToggleEditMode);
        assert.equal(await page.getValue(SELECTORS.editHookInput), origHook);
        page.assertNoRuntimeErrors('T2-F11-03');
      } finally {
        await page.close();
      }
    });

    test('T2-F11-04: Cancelling #btnResetDraft in #m3ConfirmDialog keeps local draft intact', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await selectDay(page, 1);
        await page.click(SELECTORS.btnToggleEditMode);
        await page.fill(SELECTORS.editHookInput, 'Mi Gancho Protegido');
        await page.click(SELECTORS.btnSaveDraft);
        await page.waitForSelector(SELECTORS.draftEditorForm, { hidden: true });

        await page.click(SELECTORS.btnToggleEditMode);
        await page.click(SELECTORS.btnResetDraft);
        await confirmDialogCancel(page);

        assert.equal(await page.isVisible(SELECTORS.localDraftBadge), true);
        const drafts = JSON.parse(await page.getLocalStorage(STORAGE_KEYS.DRAFTS));
        assert.equal(drafts[`${DEFAULT_NICHE.toLowerCase()}::1`]?.hook, 'Mi Gancho Protegido');
        page.assertNoRuntimeErrors('T2-F11-04');
      } finally {
        await page.close();
      }
    });

    test('T2-F11-05: #btnResetDraft is disabled when day has no local draft', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await selectDay(page, 10);
        await page.click(SELECTORS.btnToggleEditMode);
        assert.equal(await page.evaluate(() => document.querySelector('#btnResetDraft').disabled), true);
        page.assertNoRuntimeErrors('T2-F11-05');
      } finally {
        await page.close();
      }
    });

    test('T2-F11-06: Corrupt JSON in localStorage content_studio_drafts_v1 does not crash app boot', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        initScripts: [`localStorage.setItem(${JSON.stringify(STORAGE_KEYS.DRAFTS)}, '{broken-json');`],
      });
      try {
        assert.equal(await page.count(SELECTORS.dayCard), 30);
        await selectDay(page, 1);
        await page.click(SELECTORS.btnToggleEditMode);
        await page.fill(SELECTORS.editHookInput, 'Recovered Draft');
        await page.click(SELECTORS.btnSaveDraft);
        await page.waitForSelector(SELECTORS.draftEditorForm, { hidden: true });
        await page.waitForFunction(() => document.querySelector('#inspectorHook')?.textContent?.includes('Recovered Draft'));
        assert.equal(await page.getText(SELECTORS.inspectorHook), 'Recovered Draft');
        page.assertNoRuntimeErrors('T2-F11-06');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F12 Boundaries (5 cases)
  // =========================================================================
  describe('F12 Boundaries', () => {
    test('T2-F12-01: Empty or whitespace YouTube search validation', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await switchTab(page, 'youtube');
        page.clearRecordedRequests();
        await page.fill(SELECTORS.ytSearchInput, '   ');
        await page.click(SELECTORS.btnYtSearch);
        await new Promise((r) => setTimeout(r, 150));

        const searchCalls = page.getRecordedRequests().filter((r) => r.url.includes('/api/youtube/search'));
        assert.equal(searchCalls.length, 0);
        page.assertNoRuntimeErrors('T2-F12-01');
      } finally {
        await page.close();
      }
    });

    test('T2-F12-02: maxResults selector supports 6, 10, 15 and passes exact param', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/youtube/search', async (route) => {
            const url = new URL(route.url);
            const max = Number(url.searchParams.get('maxResults') || 6);
            await route.fulfill({
              status: 200,
              body: { success: true, query: url.searchParams.get('q'), count: max, savedToDb: true, videos: makeMockVideos(max, 'StubYT') },
            });
          });
        },
      });
      try {
        await switchTab(page, 'youtube');
        for (const maxVal of ['10', '15']) {
          page.clearRecordedRequests();
          await page.selectOption(SELECTORS.ytMaxResultsSelect, maxVal);
          await page.fill(SELECTORS.ytSearchInput, 'AI Agents');
          await page.click(SELECTORS.btnYtSearch);
          await page.waitForFunction(
            (n) => document.querySelectorAll('#ytResultsList [data-use-topic]').length === n,
            [Number(maxVal)]
          );
          const req = page.getRecordedRequests().find((r) => r.url.includes('/api/youtube/search'));
          assert.ok(req.url.includes(`maxResults=${maxVal}`));
        }
        page.assertNoRuntimeErrors('T2-F12-02');
      } finally {
        await page.close();
      }
    });

    test('T2-F12-03: demo_yt_* badge (Demo local) vs real YouTube video Abrir video external link', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/youtube/search', async (route) => {
            await route.fulfill({
              status: 200,
              body: {
                success: true,
                query: 'mix',
                count: 2,
                savedToDb: true,
                videos: [
                  { videoId: 'demo_yt_01', title: 'Demo Card', channelTitle: 'Demo', publishedAt: '2026-11-10T00:00:00Z', thumbnailUrl: '', viewCount: 100 },
                  { videoId: 'dQw4w9WgXcQ', title: 'Real Card', channelTitle: 'Real', publishedAt: '2026-11-10T00:00:00Z', thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', viewCount: 999 },
                ],
              },
            });
          });
        },
      });
      try {
        await switchTab(page, 'youtube');
        await page.fill(SELECTORS.ytSearchInput, 'mix');
        await page.click(SELECTORS.btnYtSearch);
        await page.waitForSelector('#ytResultsList [data-use-topic]', { visible: true });

        const info = await page.evaluate(() => {
          const cards = Array.from(document.querySelectorAll('#ytResultsList .video-card, #ytResultsList article'));
          const demoCard = cards.find((c) => c.textContent.includes('Demo Card'));
          const realCard = cards.find((c) => c.textContent.includes('Real Card'));
          return {
            demoText: demoCard?.textContent || '',
            demoHasExtLink: Boolean(demoCard?.querySelector('a[href*="youtube.com"]')),
            realLinkHref: realCard?.querySelector('a[href*="youtube.com/watch?v=dQw4w9WgXcQ"][target="_blank"]')?.getAttribute('href') || null,
          };
        });
        assert.match(info.demoText, /Demo local/i);
        assert.equal(info.demoHasExtLink, false);
        assert.match(info.realLinkHref || '', /dQw4w9WgXcQ/);
        page.assertNoRuntimeErrors('T2-F12-03');
      } finally {
        await page.close();
      }
    });

    test('T2-F12-04: Empty history & empty video catalog states', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/youtube/history', async (route) => {
            await route.fulfill({ status: 200, body: { success: true, count: 0, history: [] } });
          });
          await p.interceptRoute('/api/videos', async (route) => {
            await route.fulfill({ status: 200, body: { success: true, count: 0, videos: [] } });
          });
        },
      });
      try {
        await switchTab(page, 'youtube');
        await page.waitForFunction(
          () => /Sin búsquedas recientes/i.test(document.querySelector('#ytHistoryList')?.textContent || '')
        );
        assert.match(await page.getText(SELECTORS.ytVideosGrid), /Sin videos disponibles/i);
        page.assertNoRuntimeErrors('T2-F12-04');
      } finally {
        await page.close();
      }
    });

    test('T2-F12-05: "Usar tema en Roadmap" cancel & API error handling', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await switchTab(page, 'youtube');
        await page.fill(SELECTORS.ytSearchInput, 'Marketing Digital');
        await page.click(SELECTORS.btnYtSearch);
        await page.waitForSelector('#ytResultsList [data-use-topic]', { visible: true });

        page.clearRecordedRequests();
        await page.click('#ytResultsList [data-use-topic]');
        await confirmDialogCancel(page);
        assert.equal(await page.isVisible(SELECTORS.viewYoutube), true);
        assert.equal(page.getRecordedRequests().filter((r) => r.url.includes('/api/roadmap/generate')).length, 0);

        await page.mockError('/api/roadmap/generate', { status: 500 });
        await page.click('#ytResultsList [data-use-topic]');
        await confirmDialogAccept(page);
        await page.waitForFunction(() => (document.querySelector('#toastContainer')?.textContent || '').trim().length > 0);
        page.assertNoPageErrors('T2-F12-05');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F13 Boundaries (5 cases)
  // =========================================================================
  describe('F13 Boundaries', () => {
    test('T2-F13-01: /health error state sets #statusHealthBadge and #healthStatusText to offline/error', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.mockError('/health', { status: 503 });
        },
      });
      try {
        await switchTab(page, 'oracle');
        await page.waitForFunction(() => /Sin conexión/i.test(document.querySelector('#statusHealthBadge')?.textContent || ''));
        assert.match(await page.getText(SELECTORS.healthStatusText), /Sin respuesta|Error/i);
        assert.equal(await page.getText(SELECTORS.healthUptimeText), '—');
        page.assertNoPageErrors('T2-F13-01');
      } finally {
        await page.close();
      }
    });

    test('T2-F13-02: GET /api/oracle/status failure sets #statusOracleBadge error state', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.mockError('/api/oracle/status', { status: 500 });
        },
      });
      try {
        await switchTab(page, 'oracle');
        await page.waitForFunction(() => /Oráculo con error/i.test(document.querySelector('#statusOracleBadge')?.textContent || ''));
        page.assertNoPageErrors('T2-F13-02');
      } finally {
        await page.close();
      }
    });

    test('T2-F13-03: Manual Oracle run confirmation dialog cancel aborts cycle', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await switchTab(page, 'oracle');
        page.clearRecordedRequests();
        await page.click(SELECTORS.btnOracleTabRun);
        await confirmDialogCancel(page);
        await new Promise((r) => setTimeout(r, 150));

        assert.equal(page.getRecordedRequests().filter((r) => r.url.includes('/api/oracle/run-now')).length, 0);
        page.assertNoRuntimeErrors('T2-F13-03');
      } finally {
        await page.close();
      }
    });

    test('T2-F13-04: Manual Oracle run failure (HTTP 500) restores button & shows error', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await switchTab(page, 'oracle');
        await page.mockError('/api/oracle/run-now', { status: 500 });
        await page.click(SELECTORS.btnOracleTabRun);
        await confirmDialogAccept(page);

        await page.waitForFunction(() => (document.querySelector('#toastContainer')?.textContent || '').trim().length > 0);
        assert.equal(await page.evaluate(() => document.querySelector('#btnOracleTabRun').disabled), false);
        page.assertNoPageErrors('T2-F13-04');
      } finally {
        await page.close();
      }
    });

    test('T2-F13-05: Busy lock prevents duplicate Oracle run requests while in-flight', async () => {
      let postCount = 0;
      const page = await openAppPage(browser, server.baseUrl, {
        beforeNavigate: async (p) => {
          await p.interceptRoute('/api/oracle/run-now', async (route) => {
            postCount++;
            await new Promise((r) => setTimeout(r, 650));
            await route.fulfill({
              status: 200,
              body: { success: true, report: { status: 'completado', timestamp: new Date().toISOString(), details: 'OK 30 contenidos' } },
            });
          });
        },
      });
      try {
        await switchTab(page, 'oracle');
        await page.click(SELECTORS.btnOracleTabRun);
        await confirmDialogAccept(page);

        await new Promise((r) => setTimeout(r, 80));
        assert.equal(await page.evaluate(() => document.querySelector('#btnOracleTabRun').disabled), true);
        await page.evaluate(() => document.querySelector('#btnOracleTabRun').click());
        await new Promise((r) => setTimeout(r, 750));

        assert.equal(postCount, 1);
        assert.equal(await page.evaluate(() => document.querySelector('#btnOracleTabRun').disabled), false);
        page.assertNoRuntimeErrors('T2-F13-05');
      } finally {
        await page.close();
      }
    });
  });

  // =========================================================================
  // F14 Boundaries (5 cases)
  // =========================================================================
  describe('F14 Boundaries', () => {
    test('T2-F14-01: Single-slot M3 Snackbar replaces previous toast instead of stacking', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await selectDay(page, 1);
        await page.click(SELECTORS.btnCopyHook);
        await page.click(SELECTORS.btnCopyPrompt);
        await page.click(SELECTORS.btnCopyScript);
        await new Promise((r) => setTimeout(r, 80));

        const info = await page.evaluate(() => ({
          count: document.querySelector('#toastContainer').children.length,
          text: document.querySelector('#toastContainer').textContent.trim(),
        }));
        assert.ok(info.count <= 1, `Single-slot snackbar must not stack, found ${info.count}`);
        assert.match(info.text, /Guion|Script/i);
        page.assertNoRuntimeErrors('T2-F14-01');
      } finally {
        await page.close();
      }
    });

    test('T2-F14-02: Snackbar auto-dismisses after timeout and has aria-live="polite"', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        assert.equal(await page.getAttr(SELECTORS.toastContainer, 'aria-live'), 'polite');
        await selectDay(page, 1);
        await page.click(SELECTORS.btnCopyHook);
        await page.waitForFunction(() => document.querySelector('#toastContainer').children.length === 1);

        await page.waitForFunction(
          () => document.querySelector('#toastContainer').children.length === 0 || document.querySelector('#toastContainer').textContent.trim() === '',
          [],
          { timeoutMs: 5000 }
        );
        page.assertNoRuntimeErrors('T2-F14-02');
      } finally {
        await page.close();
      }
    });

    test('T2-F14-03: Offline fallback interpolates custom niche name safely without XSS', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await page.mockError('/api/roadmap', { status: 500 });
        await page.fill(SELECTORS.nicheInput, 'Café & Panadería 100% <img src=x>');
        await page.click(SELECTORS.btnLoadRoadmap);

        await page.waitForSelector(SELECTORS.roadmapSourceNotice, { visible: true });
        await waitForRoadmapHydrated(page);
        assert.match(await page.getText(SELECTORS.dayCardByNum(1)), /Café & Panadería 100%/);
        assert.equal(await page.evaluate(() => Boolean(document.querySelector('#roadmapList img'))), false);
        page.assertNoPageErrors('T2-F14-03');
      } finally {
        await page.close();
      }
    });

    test('T2-F14-04: POST /api/roadmap/generate failure falls back gracefully without clearing roadmap', async () => {
      const page = await openAppPage(browser, server.baseUrl);
      try {
        await page.mockError('/api/roadmap/generate', { status: 500 });
        await page.click(SELECTORS.btnGenerateRoadmap);
        await confirmDialogAccept(page);

        await page.waitForFunction(() => (document.querySelector('#toastContainer')?.textContent || '').trim().length > 0);
        assert.equal(await page.count(SELECTORS.dayCard), 30);
        assert.equal(await page.evaluate(() => document.querySelector('#btnGenerateRoadmap').disabled), false);
        page.assertNoPageErrors('T2-F14-04');
      } finally {
        await page.close();
      }
    });

    test('T2-F14-05: Offline fallback supports local draft editing client-side', async () => {
      const page = await openAppPage(browser, server.baseUrl, {
        waitForCards: false,
        beforeNavigate: async (p) => {
          await p.mockError('/api/roadmap', { status: 500 });
        },
      });
      try {
        await waitForRoadmapHydrated(page);
        await selectDay(page, 1);
        await page.click(SELECTORS.btnToggleEditMode);
        await page.fill(SELECTORS.editHookInput, 'Borrador Offline');
        await page.click(SELECTORS.btnSaveDraft);
        await page.waitForSelector(SELECTORS.draftEditorForm, { hidden: true });

        assert.equal(await page.isVisible(SELECTORS.localDraftBadge), true);
        assert.equal(await page.getText(SELECTORS.inspectorHook), 'Borrador Offline');
        assert.ok(await page.getLocalStorage(STORAGE_KEYS.DRAFTS));
        page.assertNoPageErrors('T2-F14-05');
      } finally {
        await page.close();
      }
    });
  });
});
