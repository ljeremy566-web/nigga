import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { launchBrowser } from './lib/cdp.mjs';
import {
  CSV_HEADERS_COUNT,
  DEFAULT_NICHE,
  M3_TOKENS,
  SELECTORS,
  STORAGE_KEYS,
  VIEWPORTS,
  WEEK_LABELS,
  makeMockVideos,
  makeUniqueNiche,
  parseCssColor,
  parseRfc4180Csv,
  relativeLuminance,
} from './lib/fixtures.mjs';
import {
  assertNoHorizontalOverflow,
  confirmDialogAccept,
  loadNiche,
  openAppPage,
  selectDay,
  setDayStatus,
  switchTab,
  waitForRoadmapHydrated,
} from './lib/helpers.mjs';
import { startServer } from './lib/server.mjs';

const ARTIFACTS_DIR = path.resolve(import.meta.dirname, 'artifacts');
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

let server;
let browser;

before(async () => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  server = await startServer();
  browser = await launchBrowser();
});

after(async () => {
  await browser?.close();
  await server?.close();
});

describe('Tier 4: Real-World Creator Scenarios & M3 Visual Verification (14 cases)', () => {
  // =========================================================================
  // 5.1 End-to-End Creator Workflows (8 workflows)
  // =========================================================================
  test('T4-01: New Creator Onboarding & First 30-Day Plan', async () => {
    await fetch(`${server.baseUrl}/api/roadmap/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niche: DEFAULT_NICHE }),
    });
    const page = await openAppPage(browser, server.baseUrl);
    try {
      await page.waitForFunction(() => /Servidor OK/i.test(document.querySelector('#statusHealthBadge')?.textContent || ''));

      const listText = await page.getText(SELECTORS.roadmapList);
      for (const label of WEEK_LABELS) {
        assert.ok(listText.includes(label), `Missing week heading: ${label}`);
      }

      // Inspect aspect ratios across Reel, Carrusel, Story days
      const dayFormats = await page.evaluate(() => {
        const out = {};
        for (let d = 1; d <= 10; d++) {
          const txt = document.querySelector(`#day-card-${d}`)?.textContent || '';
          if (txt.includes('Reel') && !out.Reel) out.Reel = d;
          if (txt.includes('Carrusel') && !out.Carrusel) out.Carrusel = d;
          if (txt.includes('Story') && !out.Story) out.Story = d;
        }
        return out;
      });

      assert.ok(dayFormats.Reel && dayFormats.Carrusel && dayFormats.Story, 'Expected Reel, Carrusel, and Story formats in first 10 days');

      await selectDay(page, dayFormats.Reel);
      assert.equal(await page.getAttr(SELECTORS.visualAspectFrame, 'data-ratio'), '9:16');
      await selectDay(page, dayFormats.Carrusel);
      assert.equal(await page.getAttr(SELECTORS.visualAspectFrame, 'data-ratio'), '1:1');
      await selectDay(page, dayFormats.Story);
      assert.equal(await page.getAttr(SELECTORS.visualAspectFrame, 'data-ratio'), '9:16');

      await setDayStatus(page, 1, 'grabado');
      await page.reload();
      await waitForRoadmapHydrated(page);

      assert.equal(await page.getText(SELECTORS.cardStatusByNum(1)), 'Grabado');
      assert.equal(await page.getText(SELECTORS.progressSummaryText), '0 / 30 publicados · 0%');
      page.assertNoRuntimeErrors('T4-01');
    } finally {
      await page.close();
    }
  });

  test('T4-02: Trend Discovery to Roadmap Pivot (YouTube -> Confirm -> 30 Days)', async () => {
    const query = `Agentes IA ${Date.now()}`;
    const page = await openAppPage(browser, server.baseUrl, {
      beforeNavigate: async (p) => {
        await p.interceptRoute('/api/youtube/search', async (route) => {
          const url = new URL(route.url);
          if (url.searchParams.get('maxResults') === '10') {
            await route.fulfill({
              status: 200,
              body: {
                success: true,
                query,
                count: 10,
                savedToDb: true,
                videos: makeMockVideos(10, query),
              },
            });
          } else {
            await route.continue();
          }
        });
      },
    });
    try {
      await switchTab(page, 'youtube');
      await page.selectOption(SELECTORS.ytMaxResultsSelect, '10');
      await page.fill(SELECTORS.ytSearchInput, query);
      await page.click(SELECTORS.btnYtSearch);

      await page.waitForFunction(() => document.querySelectorAll('#ytResultsList [data-use-topic]').length === 10);
      const topic = await page.getAttr('#ytResultsList [data-use-topic]', 'data-use-topic');

      await page.click('#ytResultsList [data-use-topic]');
      await confirmDialogAccept(page);

      await page.waitForSelector(SELECTORS.viewRoadmap, { visible: true });
      await waitForRoadmapHydrated(page);
      assert.equal(await page.getValue(SELECTORS.nicheInput), topic);
      assert.equal(await page.count(SELECTORS.dayCard), 30);
      page.assertNoRuntimeErrors('T4-02');
    } finally {
      await page.close();
    }
  });

  test('T4-03: Weekly Batch Filming & Production Tracking', async () => {
    const page = await openAppPage(browser, server.baseUrl);
    try {
      await loadNiche(page, makeUniqueNiche('T4-03-Batch'));
      await page.click(SELECTORS.btnWeek1);
      await page.waitForFunction(
        () =>
          Array.from(document.querySelectorAll('.day-card')).filter(
            (el) => !el.closest('.hidden') && window.getComputedStyle(el).display !== 'none'
          ).length === 7
      );
      assert.equal(await page.countVisible(SELECTORS.dayCard), 7);

      await setDayStatus(page, 1, 'grabado');
      await setDayStatus(page, 2, 'grabado');
      await setDayStatus(page, 3, 'editado');
      await setDayStatus(page, 4, 'publicado');

      assert.equal(await page.getText(SELECTORS.progressSummaryText), '1 / 30 publicados · 3%');
      assert.equal(await page.getText(SELECTORS.countGrabado), '2');
      assert.equal(await page.getText(SELECTORS.countEditado), '1');
      assert.equal(await page.getText(SELECTORS.countPublicado), '1');
      assert.equal(await page.getText(SELECTORS.countPendiente), '26');

      await page.click(SELECTORS.viewModeTimeline);
      await page.selectOption(SELECTORS.statusFilterSelect, 'publicado');
      await page.waitForFunction(
        () =>
          Array.from(document.querySelectorAll('.day-card')).filter(
            (el) => !el.closest('.hidden') && window.getComputedStyle(el).display !== 'none'
          ).length === 1
      );
      assert.equal(await page.countVisible(SELECTORS.dayCard), 1);
      assert.equal(await page.isVisible(SELECTORS.dayCardByNum(4)), true);

      await page.click(SELECTORS.btnResetFilters);
      await page.waitForFunction(
        () =>
          Array.from(document.querySelectorAll('.day-card')).filter(
            (el) => !el.closest('.hidden') && window.getComputedStyle(el).display !== 'none'
          ).length === 30
      );
      assert.equal(await page.countVisible(SELECTORS.dayCard), 30);
      page.assertNoRuntimeErrors('T4-03');
    } finally {
      await page.close();
    }
  });

  test('T4-04: Script Refinement, Copy-to-Teleprompter, Export CSV/JSON & Restore Original', async () => {
    const page = await openAppPage(browser, server.baseUrl);
    try {
      await loadNiche(page, makeUniqueNiche('T4-04-Refine'));
      await selectDay(page, 2);
      const originalHook = await page.getText(SELECTORS.inspectorHook);

      await page.click(SELECTORS.btnToggleEditMode);
      await page.waitForSelector(SELECTORS.draftEditorForm, { visible: true });
      await page.fill(SELECTORS.editHookInput, 'Gancho Teleprompter T4');
      await page.fill(SELECTORS.editScriptInput, 'Guion Teleprompter T4 completo');
      await page.click(SELECTORS.btnSaveDraft);
      await page.waitForSelector(SELECTORS.draftEditorForm, { hidden: true });
      await page.waitForFunction(() => document.querySelector('#inspectorScript')?.textContent?.includes('Guion Teleprompter T4 completo'));

      await page.click(SELECTORS.btnCopyScript);
      assert.equal(await page.readClipboard(), 'Guion Teleprompter T4 completo');

      const csvDl = await page.waitForDownload(() => page.click(SELECTORS.btnExportCsv));
      const parsed = parseRfc4180Csv(csvDl.buffer);
      assert.equal(parsed.hasBom, true);
      assert.equal(parsed.rows.length, 31);
      assert.equal(parsed.rows[2].length, CSV_HEADERS_COUNT);
      assert.ok(parsed.rows[2].includes('Gancho Teleprompter T4'));

      const jsonDl = await page.waitForDownload(() => page.click(SELECTORS.btnExportJson));
      const jsonItems = JSON.parse(jsonDl.content);
      assert.equal(jsonItems[1].script, 'Guion Teleprompter T4 completo');

      await page.click(SELECTORS.btnToggleEditMode);
      await page.click(SELECTORS.btnResetDraft);
      await confirmDialogAccept(page);

      assert.equal(await page.isVisible(SELECTORS.localDraftBadge), false);
      assert.equal(await page.getText(SELECTORS.inspectorHook), originalHook);
      page.assertNoRuntimeErrors('T4-04');
    } finally {
      await page.close();
    }
  });

  test('T4-05: Autonomous AI Oracle Audit & Execution', async () => {
    const page = await openAppPage(browser, server.baseUrl);
    try {
      await switchTab(page, 'oracle');
      await page.waitForFunction(() => /Sin ejecución previa/i.test(document.querySelector('#oracleLastStatus')?.textContent || ''));
      assert.match(await page.getText(SELECTORS.healthStatusText), /Operativo|ok/i);

      for (const card of [
        SELECTORS.truthCardYoutube,
        SELECTORS.truthCardGemini,
        SELECTORS.truthCardSupabase,
        SELECTORS.truthCardInstagram,
      ]) {
        assert.equal(await page.isVisible(card), true);
      }

      await page.click(SELECTORS.btnOracleTabRun);
      await confirmDialogAccept(page);

      await page.waitForFunction(() => /completado/i.test(document.querySelector('#oracleLastStatus')?.textContent || ''));
      assert.ok((await page.getText(SELECTORS.oracleLastTimestamp)).length > 4);
      assert.match(await page.getText(SELECTORS.statusOracleBadge), /Oráculo sincronizado/i);

      await switchTab(page, 'youtube');
      await page.waitForSelector(SELECTORS.ytVideosGrid, { visible: true });
      await switchTab(page, 'roadmap');
      assert.equal(await page.count(SELECTORS.dayCard), 30);
      page.assertNoRuntimeErrors('T4-05');
    } finally {
      await page.close();
    }
  });

  test('T4-06: Mobile Creator On-Set Workflow (390x844)', async () => {
    const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.MOBILE, colorScheme: 'light' });
    try {
      await loadNiche(page, makeUniqueNiche('T4-06-Mobile'));
      await page.click(SELECTORS.btnThemeToggle);
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');

      await switchTab(page, 'youtube');
      await assertNoHorizontalOverflow(page, 'T4-06-youtube-mobile');
      await switchTab(page, 'roadmap');
      await assertNoHorizontalOverflow(page, 'T4-06-roadmap-mobile');

      await page.click(SELECTORS.dayCardByNum(5));
      await page.waitForSelector(SELECTORS.inspectorBackdrop, { visible: true });
      assert.equal(await page.getAttr(SELECTORS.dayInspector, 'role'), 'dialog');
      assert.equal(await page.getAttr(SELECTORS.dayInspector, 'aria-modal'), 'true');

      await page.click(SELECTORS.statusBtn('publicado'));
      await new Promise((r) => setTimeout(r, 120));
      assert.equal(await page.getText(SELECTORS.cardStatusByNum(5)), 'Publicado');

      for (let i = 0; i < 6; i++) {
        await page.pressKey('Tab');
        assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('#dayInspector'))), true);
      }

      await page.pressKey('Escape');
      await page.waitForSelector(SELECTORS.inspectorBackdrop, { hidden: true });
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'day-card-5');
      page.assertNoRuntimeErrors('T4-06');
    } finally {
      await page.close();
    }
  });

  test('T4-07: Resilient Offline / Degraded Network Recovery', async () => {
    const page = await openAppPage(browser, server.baseUrl);
    try {
      await page.mockError('/api/roadmap', { status: 500 });
      await page.fill(SELECTORS.nicheInput, 'Diseño UI');
      await page.click(SELECTORS.btnLoadRoadmap);

      await page.waitForSelector(SELECTORS.roadmapSourceNotice, { visible: true });
      await waitForRoadmapHydrated(page);
      assert.equal(await page.count(SELECTORS.dayCard), 30);

      await selectDay(page, 1);
      await page.click(SELECTORS.btnToggleEditMode);
      await page.waitForSelector(SELECTORS.draftEditorForm, { visible: true });
      await page.fill(SELECTORS.editCaptionInput, 'Caption Offline Guardado');
      await page.click(SELECTORS.btnSaveDraft);
      await page.waitForSelector(SELECTORS.draftEditorForm, { hidden: true });
      await page.waitForFunction(() => document.querySelector('#inspectorCaption')?.textContent?.includes('Caption Offline Guardado'));
      await page.click(SELECTORS.btnCopyCaption);
      assert.match(await page.readClipboard(), /Caption Offline Guardado/);

      await page.clearRoutes();
      await page.click(SELECTORS.btnLoadRoadmap);
      await page.waitForSelector(SELECTORS.roadmapSourceNotice, { hidden: true });
      assert.equal(await page.count(SELECTORS.dayCard), 30);
      page.assertNoPageErrors('T4-07');
    } finally {
      await page.close();
    }
  });

  test('T4-08: Multi-Niche Agency Management (Isolated Status & Drafts)', async () => {
    const niche1 = makeUniqueNiche('AgencyFitness');
    const niche2 = makeUniqueNiche('AgencyFinanzas');
    const page = await openAppPage(browser, server.baseUrl);
    try {
      await loadNiche(page, niche1);
      await setDayStatus(page, 1, 'grabado');
      assert.equal(await page.getText(SELECTORS.cardStatusByNum(1)), 'Grabado');
      await page.click(SELECTORS.btnToggleEditMode);
      await page.fill(SELECTORS.editHookInput, 'Hook Agencia Fitness');
      await page.click(SELECTORS.btnSaveDraft);
      await page.waitForSelector(SELECTORS.draftEditorForm, { hidden: true });

      await page.fill(SELECTORS.nicheInput, niche2);
      await page.click(SELECTORS.btnGenerateRoadmap);
      await confirmDialogAccept(page);
      await waitForRoadmapHydrated(page);

      await selectDay(page, 1);
      assert.equal(await page.getText(SELECTORS.cardStatusByNum(1)), 'Pendiente');
      assert.equal(await page.isVisible(SELECTORS.localDraftBadge), false);
      assert.notEqual(await page.getText(SELECTORS.inspectorHook), 'Hook Agencia Fitness');

      await loadNiche(page, niche1);
      await selectDay(page, 1);
      assert.equal(await page.isVisible(SELECTORS.localDraftBadge), true);
      assert.equal(await page.getText(SELECTORS.inspectorHook), 'Hook Agencia Fitness');

      const drafts = JSON.parse(await page.getLocalStorage(STORAGE_KEYS.DRAFTS));
      assert.equal(drafts[`${niche1.toLowerCase()}::1`]?.hook, 'Hook Agencia Fitness');
      assert.equal(drafts[`${niche2.toLowerCase()}::1`], undefined);
      page.assertNoRuntimeErrors('T4-08');
    } finally {
      await page.close();
    }
  });

  // =========================================================================
  // 5.2 Real Chromium M3 Visual, CSS Token, Font, Overflow & A11y Checks (6)
  // =========================================================================
  test('T4-M3-01: M3 Color Tokens (--md-sys-color-*) Light & Dark verification', async () => {
    const page = await openAppPage(browser, server.baseUrl, { colorScheme: 'light' });
    try {
      const tokenList = [
        '--md-sys-color-primary',
        '--md-sys-color-primary-container',
        '--md-sys-color-secondary-container',
        '--md-sys-color-surface',
        '--md-sys-color-surface-container-low',
        '--md-sys-color-surface-container',
        '--md-sys-color-surface-container-high',
        '--md-sys-color-on-surface',
        '--md-sys-color-outline-variant',
        '--md-sys-color-inverse-surface',
        ...M3_TOKENS.statusColors,
      ];

      const readTokens = () =>
        page.evaluate((names) => {
          const cs = window.getComputedStyle(document.documentElement);
          const out = {};
          for (const n of names) out[n] = cs.getPropertyValue(n).trim();
          return out;
        }, tokenList);

      const light = await readTokens();
      for (const n of tokenList) assert.ok(light[n], `Missing light token ${n}`);
      const lightPrimary = parseCssColor(light['--md-sys-color-primary']);
      assert.deepEqual({ r: lightPrimary.r, g: lightPrimary.g, b: lightPrimary.b }, { r: 11, g: 87, b: 208 });

      await page.click(SELECTORS.btnThemeToggle);
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');

      const dark = await readTokens();
      for (const n of tokenList) assert.ok(dark[n], `Missing dark token ${n}`);
      const darkPrimary = parseCssColor(dark['--md-sys-color-primary']);
      assert.deepEqual({ r: darkPrimary.r, g: darkPrimary.g, b: darkPrimary.b }, { r: 168, g: 199, b: 250 });

      assert.notEqual(light['--md-sys-color-surface'], dark['--md-sys-color-surface']);
      assert.ok(
        relativeLuminance(parseCssColor(light['--md-sys-color-surface'])) >
          relativeLuminance(parseCssColor(dark['--md-sys-color-surface']))
      );
      page.assertNoRuntimeErrors('T4-M3-01');
    } finally {
      await page.close();
    }
  });

  test('T4-M3-02: Google Fonts & Material Symbols Rounded Loaded', async () => {
    const page = await openAppPage(browser, server.baseUrl);
    try {
      const info = await page.evaluate(async () => {
        await document.fonts.ready;
        const loaded = Array.from(document.fonts)
          .filter((f) => f.status === 'loaded')
          .map((f) => f.family.replace(/['"]/g, ''));
        const iconEl = document.querySelector('.material-symbols-rounded');
        const iconFont = iconEl ? window.getComputedStyle(iconEl).fontFamily : '';
        const monoFont = window.getComputedStyle(document.querySelector('#inspectorImagePrompt')).fontFamily;
        const bodyFont = window.getComputedStyle(document.body).fontFamily;
        const fontLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((l) => l.href);
        return { loaded: [...new Set(loaded)], hasIconEl: Boolean(iconEl), iconFont, monoFont, bodyFont, fontLinks };
      });

      assert.equal(info.hasIconEl, true, 'Expected .material-symbols-rounded icon element in DOM');
      assert.match(info.iconFont, /Material Symbols Rounded/i);
      assert.match(info.monoFont, /Roboto Mono/i);
      assert.match(info.bodyFont, /Roboto|Google Sans/i);
      assert.ok(
        info.fontLinks.some((h) => h.includes('fonts.googleapis.com') && /Material\+Symbols\+Rounded/i.test(h)),
        'Expected Google Fonts stylesheet link with Material Symbols Rounded'
      );
      const fontsBlockedBySandboxCert = page.logErrors.some(
        (e) => e.url?.includes('fonts.googleapis.com') && e.text?.includes('ERR_CERT_AUTHORITY_INVALID')
      );
      if (!fontsBlockedBySandboxCert) {
        assert.ok(info.loaded.length >= 1, `Expected loaded webfont faces, got ${JSON.stringify(info.loaded)}`);
      }
      page.assertNoRuntimeErrors('T4-M3-02');
    } finally {
      await page.close();
    }
  });

  test('T4-M3-03: Desktop (1440x900) Zero Horizontal Overflow + Nav Rail + Light/Dark Screenshots', async () => {
    const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.DESKTOP, colorScheme: 'light' });
    try {
      await assertNoHorizontalOverflow(page, 'Desktop-Roadmap-Light');
      await switchTab(page, 'youtube');
      await assertNoHorizontalOverflow(page, 'Desktop-Youtube-Light');
      await switchTab(page, 'oracle');
      await assertNoHorizontalOverflow(page, 'Desktop-Oracle-Light');
      await switchTab(page, 'roadmap');

      const lightPng = await page.screenshot({ fullPage: false });
      assert.deepEqual([...lightPng.subarray(0, 8)], PNG_MAGIC);
      assert.ok(lightPng.length > 10_000, 'Desktop light screenshot unexpectedly small');
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'desktop-light.png'), lightPng);

      await page.click(SELECTORS.btnThemeToggle);
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      await new Promise((r) => setTimeout(r, 80));

      const darkPng = await page.screenshot({ fullPage: false });
      assert.deepEqual([...darkPng.subarray(0, 8)], PNG_MAGIC);
      assert.ok(darkPng.length > 10_000, 'Desktop dark screenshot unexpectedly small');
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'desktop-dark.png'), darkPng);

      page.assertNoRuntimeErrors('T4-M3-03');
    } finally {
      await page.close();
    }
  });

  test('T4-M3-04: Mobile (390x844) Zero Horizontal Overflow + Bottom Nav Bar + Light/Dark Screenshots', async () => {
    const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.MOBILE, colorScheme: 'light' });
    try {
      await assertNoHorizontalOverflow(page, 'Mobile-Roadmap-Light');
      await switchTab(page, 'youtube');
      await assertNoHorizontalOverflow(page, 'Mobile-Youtube-Light');
      await switchTab(page, 'oracle');
      await assertNoHorizontalOverflow(page, 'Mobile-Oracle-Light');
      await switchTab(page, 'roadmap');

      const navBottom = await page.evaluate(() =>
        document.querySelector('#tab-roadmap').closest('nav').getBoundingClientRect().bottom
      );
      assert.ok(navBottom >= 820, `Mobile bottom bar expected near viewport bottom, got ${navBottom}`);

      const lightPng = await page.screenshot({ fullPage: false });
      assert.deepEqual([...lightPng.subarray(0, 8)], PNG_MAGIC);
      assert.ok(lightPng.length > 10_000);
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'mobile-light.png'), lightPng);

      await page.click(SELECTORS.dayCardByNum(1));
      await page.waitForSelector(SELECTORS.inspectorBackdrop, { visible: true });
      await assertNoHorizontalOverflow(page, 'Mobile-Modal-Open');
      await page.pressKey('Escape');
      await page.waitForSelector(SELECTORS.inspectorBackdrop, { hidden: true });

      await page.click(SELECTORS.btnThemeToggle);
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      await new Promise((r) => setTimeout(r, 80));

      const darkPng = await page.screenshot({ fullPage: false });
      assert.deepEqual([...darkPng.subarray(0, 8)], PNG_MAGIC);
      assert.ok(darkPng.length > 10_000);
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'mobile-dark.png'), darkPng);

      page.assertNoRuntimeErrors('T4-M3-04');
    } finally {
      await page.close();
    }
  });

  test('T4-M3-05: M3 Shape, Tonal Surfaces & Accessibility Attributes', async () => {
    const page = await openAppPage(browser, server.baseUrl);
    try {
      const shapeCheck = await page.evaluate((shapeNames) => {
        const cs = window.getComputedStyle(document.documentElement);
        const tokens = {};
        for (const n of shapeNames) tokens[n] = cs.getPropertyValue(n).trim();
        const cardRadius = window.getComputedStyle(document.querySelector('#day-card-1')).borderTopLeftRadius;
        const btnRadius = window.getComputedStyle(document.querySelector('#btnGenerateRoadmap')).borderTopLeftRadius;
        return {
          tokens,
          cardRadius,
          btnRadius,
          dialogModal: document.querySelector('#m3ConfirmDialog')?.getAttribute('aria-modal'),
          toastLive: document.querySelector('#toastContainer')?.getAttribute('aria-live'),
          unnamedButtons: Array.from(
            document.querySelectorAll('#tab-roadmap, #tab-youtube, #tab-oracle, #inspectorStatusGroup button, #btnThemeToggle')
          )
            .filter((el) => !el.textContent.trim() && !el.getAttribute('aria-label'))
            .map((el) => el.id),
        };
      }, M3_TOKENS.shapes);

      assert.equal(shapeCheck.tokens['--md-sys-shape-corner-extra-small'], '4px');
      assert.equal(shapeCheck.tokens['--md-sys-shape-corner-small'], '8px');
      assert.equal(shapeCheck.tokens['--md-sys-shape-corner-medium'], '12px');
      assert.equal(shapeCheck.tokens['--md-sys-shape-corner-large'], '16px');
      assert.equal(shapeCheck.tokens['--md-sys-shape-corner-extra-large'], '28px');
      assert.notEqual(shapeCheck.cardRadius, '10px');
      assert.notEqual(shapeCheck.cardRadius, shapeCheck.btnRadius);
      assert.equal(shapeCheck.dialogModal, 'true');
      assert.equal(shapeCheck.toastLive, 'polite');
      assert.deepEqual(shapeCheck.unnamedButtons, []);
      page.assertNoRuntimeErrors('T4-M3-05');
    } finally {
      await page.close();
    }
  });

  test('T4-M3-06: Zero Console Errors & Uncaught Page Errors Across Full Sweep', async () => {
    const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.DESKTOP });
    try {
      await page.click(SELECTORS.btnThemeToggle);
      await page.click(SELECTORS.btnWeek2);
      await page.click(SELECTORS.viewModeTimeline);
      await page.click(SELECTORS.viewModeGrid);
      await page.click(SELECTORS.btnResetFilters);
      await selectDay(page, 3);
      await page.click(SELECTORS.btnCopyHook);
      await switchTab(page, 'youtube');
      await switchTab(page, 'oracle');
      await switchTab(page, 'roadmap');

      await page.setViewport(VIEWPORTS.MOBILE);
      await page.click(SELECTORS.dayCardByNum(2));
      await page.waitForSelector(SELECTORS.inspectorBackdrop, { visible: true });
      await page.pressKey('Escape');
      await page.waitForSelector(SELECTORS.inspectorBackdrop, { hidden: true });

      page.assertNoRuntimeErrors('T4-M3-06');
    } finally {
      await page.close();
    }
  });
});
