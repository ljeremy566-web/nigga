import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launchBrowser } from './lib/cdp.mjs';
import {
  CSV_HEADERS_COUNT,
  SELECTORS,
  STORAGE_KEYS,
  VIEWPORTS,
  makeMockRoadmap,
  makeMockVideos,
  makeUniqueNiche,
  parseCssColor,
  parseRfc4180Csv,
  relativeLuminance,
} from './lib/fixtures.mjs';
import {
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

describe('Tier 3: Cross-Feature Combinations (T3-01..T3-16, 16 cases)', () => {
  test('T3-01: Navigation + Hash + Dark Theme + Inspector persistence across reload', async () => {
    const page = await openAppPage(browser, server.baseUrl, { colorScheme: 'light' });
    try {
      await page.click(SELECTORS.btnThemeToggle);
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      await selectDay(page, 6);
      assert.equal(await page.getAttr(SELECTORS.dayCardByNum(6), 'aria-current'), 'true');

      await switchTab(page, 'youtube');
      assert.equal(await page.evaluate(() => window.location.hash), '#youtube');

      await switchTab(page, 'roadmap');
      assert.equal(await page.evaluate(() => window.location.hash), '#roadmap');

      await switchTab(page, 'youtube');
      await page.reload();
      await page.waitForSelector(SELECTORS.viewYoutube, { visible: true });

      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
      assert.equal(await page.getAttr(SELECTORS.tabYoutube, 'aria-selected'), 'true');
      page.assertNoRuntimeErrors('T3-01');
    } finally {
      await page.close();
    }
  });

  test('T3-02: Week Filter + Search + Inspector Sync (ArrowRight stays inside filtered subset)', async () => {
    const niche = makeUniqueNiche('T3-02');
    const roadmap = makeMockRoadmap(niche, {
      9: { title: 'MatchTokenAlpha Día 9' },
      12: { title: 'MatchTokenAlpha Día 12' },
      3: { title: 'MatchTokenAlpha Día 3 (Sem 1)' },
    });
    const page = await openAppPage(browser, server.baseUrl, {
      beforeNavigate: async (p) => {
        await p.interceptRoute('/api/roadmap?', async (route) => {
          await route.fulfill({ status: 200, body: { success: true, count: 30, niche, roadmap } });
        });
      },
    });
    try {
      await page.click(SELECTORS.btnWeek2);
      await page.fill(SELECTORS.searchRoadmapInput, 'MatchTokenAlpha');
      await page.waitForFunction(() => document.querySelectorAll('.day-card').length === 2);

      await selectDay(page, 9);
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.pressKey('ArrowRight');

      assert.equal(await page.getAttr(SELECTORS.dayCardByNum(12), 'aria-current'), 'true');
      assert.equal(await page.evaluate(() => document.querySelector('#btnNextDay').disabled), true);
      page.assertNoRuntimeErrors('T3-02');
    } finally {
      await page.close();
    }
  });

  test('T3-03: Filter + Status + Local Draft + CSV Export merges full 30 days', async () => {
    const page = await openAppPage(browser, server.baseUrl);
    try {
      await loadNiche(page, makeUniqueNiche('T3-03'));
      await setDayStatus(page, 2, 'grabado');
      await page.click(SELECTORS.btnToggleEditMode);
      await page.fill(SELECTORS.editHookInput, 'Hook Export CSV');
      await page.click(SELECTORS.btnSaveDraft);
      await page.waitForSelector(SELECTORS.draftEditorForm, { hidden: true });

      await page.selectOption(SELECTORS.statusFilterSelect, 'grabado');
      await page.waitForFunction(
        () =>
          Array.from(document.querySelectorAll('.day-card')).filter(
            (el) => !el.closest('.hidden') && window.getComputedStyle(el).display !== 'none'
          ).length === 1
      );
      assert.equal(await page.countVisible(SELECTORS.dayCard), 1);

      const dl = await page.waitForDownload(() => page.click(SELECTORS.btnExportCsv));
      const { hasBom, rows } = parseRfc4180Csv(dl.buffer);
      assert.equal(hasBom, true);
      assert.equal(rows.length, 31);
      for (const r of rows) assert.equal(r.length, CSV_HEADERS_COUNT);
      assert.ok(rows[2].includes('grabado'));
      assert.ok(rows[2].includes('Hook Export CSV'));
      page.assertNoRuntimeErrors('T3-03');
    } finally {
      await page.close();
    }
  });

  test('T3-04: Draft + Status + JSON Export', async () => {
    const page = await openAppPage(browser, server.baseUrl);
    try {
      await loadNiche(page, makeUniqueNiche('T3-04'));
      await selectDay(page, 4);
      await page.click(SELECTORS.btnToggleEditMode);
      await page.fill(SELECTORS.editScriptInput, 'Guion T3-04 JSON');
      await page.fill(SELECTORS.editCaptionInput, 'Caption T3-04 JSON');
      await page.click(SELECTORS.btnSaveDraft);
      await page.waitForSelector(SELECTORS.draftEditorForm, { hidden: true });
      await setDayStatus(page, 4, 'publicado');

      const dl = await page.waitForDownload(() => page.click(SELECTORS.btnExportJson));
      const items = JSON.parse(dl.content);
      assert.equal(items.length, 30);
      const day4 = items.find((d) => d.day_number === 4);
      assert.equal(day4.status, 'publicado');
      assert.equal(day4.script, 'Guion T3-04 JSON');
      assert.equal(day4.caption, 'Caption T3-04 JSON');
      page.assertNoRuntimeErrors('T3-04');
    } finally {
      await page.close();
    }
  });

  test('T3-05: Niche Switch + Draft Isolation + Inspector', async () => {
    const nicheA = makeUniqueNiche('NicheAlpha');
    const nicheB = makeUniqueNiche('NicheBeta');
    const page = await openAppPage(browser, server.baseUrl);
    try {
      await loadNiche(page, nicheA);
      await selectDay(page, 1);
      await page.click(SELECTORS.btnToggleEditMode);
      await page.fill(SELECTORS.editHookInput, 'Borrador Exclusivo Alpha');
      await page.click(SELECTORS.btnSaveDraft);
      await page.waitForSelector(SELECTORS.draftEditorForm, { hidden: true });
      assert.equal(await page.isVisible(SELECTORS.localDraftBadge), true);

      await loadNiche(page, nicheB);
      await selectDay(page, 1);
      assert.equal(await page.isVisible(SELECTORS.localDraftBadge), false);
      assert.notEqual(await page.getText(SELECTORS.inspectorHook), 'Borrador Exclusivo Alpha');

      await loadNiche(page, nicheA);
      await selectDay(page, 1);
      await page.waitForSelector(SELECTORS.localDraftBadge, { visible: true });
      assert.equal(await page.isVisible(SELECTORS.localDraftBadge), true);
      assert.equal(await page.getText(SELECTORS.inspectorHook), 'Borrador Exclusivo Alpha');
      page.assertNoRuntimeErrors('T3-05');
    } finally {
      await page.close();
    }
  });

  test('T3-06: YouTube History -> Search -> Topic Pivot -> Confirm -> Roadmap -> Inspector', async () => {
    const page = await openAppPage(browser, server.baseUrl);
    try {
      await switchTab(page, 'youtube');
      const query = `PivotTopic_${Date.now()}`;
      await page.fill(SELECTORS.ytSearchInput, query);
      await page.click(SELECTORS.btnYtSearch);
      await page.waitForSelector(`.history-chip[data-history-query="${query}"]`, { visible: true });

      await page.click(`.history-chip[data-history-query="${query}"]`);
      await page.waitForSelector('#ytResultsList [data-use-topic]', { visible: true });
      const chosenTopic = await page.getAttr('#ytResultsList [data-use-topic]', 'data-use-topic');

      await page.click('#ytResultsList [data-use-topic]');
      await confirmDialogAccept(page);

      await page.waitForSelector(SELECTORS.viewRoadmap, { visible: true });
      await waitForRoadmapHydrated(page);
      assert.equal(await page.getAttr(SELECTORS.tabRoadmap, 'aria-selected'), 'true');
      assert.equal(await page.getValue(SELECTORS.nicheInput), chosenTopic);
      assert.equal(await page.getAttr(SELECTORS.dayCardByNum(1), 'aria-current'), 'true');
      page.assertNoRuntimeErrors('T3-06');
    } finally {
      await page.close();
    }
  });

  test('T3-07: Oracle Run -> YouTube Cache Invalidation -> Status Badges', async () => {
    const page = await openAppPage(browser, server.baseUrl);
    try {
      await switchTab(page, 'youtube');
      await page.waitForSelector(SELECTORS.ytVideosGrid, { visible: true });

      await switchTab(page, 'oracle');
      await page.click(SELECTORS.btnOracleTabRun);
      await confirmDialogAccept(page);

      await page.waitForFunction(() => /completado/i.test(document.querySelector('#oracleLastStatus')?.textContent || ''));
      assert.match(await page.getText(SELECTORS.statusOracleBadge), /Oráculo sincronizado/i);

      page.clearRecordedRequests();
      await switchTab(page, 'youtube');
      await new Promise((r) => setTimeout(r, 200));
      const reqs = page.getRecordedRequests();
      assert.ok(reqs.some((r) => r.url.includes('/api/videos')), 'Revisiting YouTube tab after Oracle run must re-fetch /api/videos');
      assert.ok(reqs.some((r) => r.url.includes('/api/youtube/history')), 'Revisiting YouTube tab after Oracle run must re-fetch /api/youtube/history');
      page.assertNoRuntimeErrors('T3-07');
    } finally {
      await page.close();
    }
  });

  test('T3-08: Grid/List View Mode + Status Filter Re-evaluation', async () => {
    const page = await openAppPage(browser, server.baseUrl);
    try {
      await loadNiche(page, makeUniqueNiche('T3-08'));
      await setDayStatus(page, 1, 'grabado');
      await setDayStatus(page, 2, 'grabado');

      await page.click(SELECTORS.viewModeTimeline);
      await page.selectOption(SELECTORS.statusFilterSelect, 'grabado');
      await page.waitForFunction(
        () =>
          Array.from(document.querySelectorAll('.day-card')).filter(
            (el) => !el.closest('.hidden') && window.getComputedStyle(el).display !== 'none'
          ).length === 2
      );
      assert.equal(await page.countVisible(SELECTORS.dayCard), 2);

      await setDayStatus(page, 1, 'editado');
      await page.waitForFunction(
        () =>
          Array.from(document.querySelectorAll('.day-card')).filter(
            (el) => !el.closest('.hidden') && window.getComputedStyle(el).display !== 'none'
          ).length === 1
      );
      assert.equal(await page.countVisible(SELECTORS.dayCard), 1);
      assert.equal(await page.exists(SELECTORS.dayCardByNum(2)), true);
      assert.equal(await page.getText(SELECTORS.countGrabado), '1');
      assert.equal(await page.getText(SELECTORS.countEditado), '1');
      page.assertNoRuntimeErrors('T3-08');
    } finally {
      await page.close();
    }
  });

  test('T3-09: Draft Edit + Copy Buttons + Aspect Frame Preservation', async () => {
    const niche = makeUniqueNiche('T3-09');
    const roadmap = makeMockRoadmap(niche, { 2: { format: 'Carrusel' } });
    const page = await openAppPage(browser, server.baseUrl, {
      beforeNavigate: async (p) => {
        await p.interceptRoute('/api/roadmap?', async (route) => {
          await route.fulfill({ status: 200, body: { success: true, count: 30, niche, roadmap } });
        });
      },
    });
    try {
      await selectDay(page, 2);
      assert.equal(await page.getAttr(SELECTORS.visualAspectFrame, 'data-ratio'), '1:1');

      await page.click(SELECTORS.btnToggleEditMode);
      await page.fill(SELECTORS.editHookInput, 'Nuevo Hook Carrusel 1:1');
      await page.fill(SELECTORS.editPromptInput, 'Nuevo Prompt Carrusel 1:1');
      await page.click(SELECTORS.btnSaveDraft);
      await page.waitForSelector(SELECTORS.draftEditorForm, { hidden: true });
      await page.waitForFunction(() => document.querySelector('#inspectorHook')?.textContent?.includes('Nuevo Hook Carrusel 1:1'));

      assert.equal(await page.getAttr(SELECTORS.visualAspectFrame, 'data-ratio'), '1:1');
      await page.click(SELECTORS.btnCopyHook);
      assert.equal(await page.readClipboard(), 'Nuevo Hook Carrusel 1:1');
      await page.click(SELECTORS.btnCopyPrompt);
      assert.equal(await page.readClipboard(), 'Nuevo Prompt Carrusel 1:1');
      page.assertNoRuntimeErrors('T3-09');
    } finally {
      await page.close();
    }
  });

  test('T3-10: Mobile Dark Mode + Modal Sheet + Snackbar Feedback', async () => {
    const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.MOBILE, colorScheme: 'dark' });
    try {
      await loadNiche(page, makeUniqueNiche('T3-10'));
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');

      await page.click(SELECTORS.dayCardByNum(3));
      await page.waitForSelector(SELECTORS.inspectorBackdrop, { visible: true });

      await page.click(SELECTORS.statusBtn('editado'));
      await page.click(SELECTORS.btnCopyScript);
      await page.waitForFunction(() => (document.querySelector('#toastContainer')?.textContent || '').trim().length > 0);
      assert.equal(await page.isVisible(SELECTORS.toastContainer), true);

      await page.click(SELECTORS.btnCloseDrawer);
      await page.waitForSelector(SELECTORS.inspectorBackdrop, { hidden: true });
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'day-card-3');
      page.assertNoRuntimeErrors('T3-10');
    } finally {
      await page.close();
    }
  });

  test('T3-11: Roadmap Regenerate Confirm Cancel Preserves Status & Progress', async () => {
    const page = await openAppPage(browser, server.baseUrl);
    try {
      await loadNiche(page, makeUniqueNiche('T3-11'));
      await setDayStatus(page, 1, 'publicado');
      assert.match(await page.getText(SELECTORS.progressSummaryText), /1 \/ 30 publicados/);

      page.clearRecordedRequests();
      await page.click(SELECTORS.btnGenerateRoadmap);
      await confirmDialogCancel(page);

      assert.equal(page.getRecordedRequests().filter((r) => r.url.includes('/api/roadmap/generate')).length, 0);
      assert.equal(await page.getText(SELECTORS.cardStatusByNum(1)), 'Publicado');
      assert.match(await page.getText(SELECTORS.progressSummaryText), /1 \/ 30 publicados/);
      page.assertNoRuntimeErrors('T3-11');
    } finally {
      await page.close();
    }
  });

  test('T3-12: Search Filtering + Empty State + Inspector Stability', async () => {
    const page = await openAppPage(browser, server.baseUrl);
    try {
      await page.type(SELECTORS.searchRoadmapInput, 'xyznonexistent999');
      await page.waitForSelector(SELECTORS.roadmapEmptyState, { visible: true });
      assert.equal(await page.countVisible(SELECTORS.dayCard), 0);

      await page.click(SELECTORS.btnEmptyResetFilters);
      await waitForRoadmapHydrated(page);
      await selectDay(page, 5);
      assert.match(await page.getText(SELECTORS.inspectorDayBadge), /0?5/);
      page.assertNoRuntimeErrors('T3-12');
    } finally {
      await page.close();
    }
  });

  test('T3-13: Stored Video Thumbnail Hydration into Inspector', async () => {
    const niche = makeUniqueNiche('T3-13-Productividad');
    const roadmap = makeMockRoadmap(niche, { 1: { reference_video_id: 'dQw4w9WgXcQ' } });
    const videos = makeMockVideos(2, 'Productividad Real');

    const page = await openAppPage(browser, server.baseUrl, {
      beforeNavigate: async (p) => {
        await p.interceptRoute('/api/roadmap?', async (route) => {
          await route.fulfill({ status: 200, body: { success: true, count: 30, niche, roadmap } });
        });
        await p.interceptRoute('/api/videos', async (route) => {
          await route.fulfill({ status: 200, body: { success: true, count: 2, videos } });
        });
      },
    });
    try {
      await selectDay(page, 1);
      assert.equal(await page.isVisible(SELECTORS.visualRefThumb), true);
      assert.match(await page.getAttr(SELECTORS.visualRefThumb, 'src'), /dQw4w9WgXcQ/);
      assert.match(await page.getAttr(SELECTORS.inspectorRefLink, 'href'), /dQw4w9WgXcQ/);
      page.assertNoRuntimeErrors('T3-13');
    } finally {
      await page.close();
    }
  });

  test('T3-14: Reset Filters Does Not Destroy Local Drafts', async () => {
    const page = await openAppPage(browser, server.baseUrl);
    try {
      await selectDay(page, 3);
      await page.click(SELECTORS.btnToggleEditMode);
      await page.fill(SELECTORS.editHookInput, 'Borrador Sobrevive Reset');
      await page.click(SELECTORS.btnSaveDraft);
      await page.waitForSelector(SELECTORS.draftEditorForm, { hidden: true });

      await page.click(SELECTORS.btnWeek1);
      await page.selectOption(SELECTORS.formatFilterSelect, 'Reel');
      await page.fill(SELECTORS.searchRoadmapInput, 'xyz');
      await page.click(SELECTORS.btnResetFilters);

      await waitForRoadmapHydrated(page);
      await selectDay(page, 3);
      assert.equal(await page.getText(SELECTORS.inspectorHook), 'Borrador Sobrevive Reset');
      assert.match(await page.getText(SELECTORS.dayCardByNum(3)), /Borrador/);
      page.assertNoRuntimeErrors('T3-14');
    } finally {
      await page.close();
    }
  });

  test('T3-15: Theme Toggle Reflects Across All 3 Views & Oracle Cards', async () => {
    const page = await openAppPage(browser, server.baseUrl, { colorScheme: 'light' });
    try {
      await page.click(SELECTORS.btnThemeToggle);
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');

      const roadmapLum = relativeLuminance(parseCssColor(await page.getComputedStyle('body', 'background-color')));
      assert.ok(roadmapLum < 0.2);

      await switchTab(page, 'youtube');
      await page.waitForSelector(SELECTORS.ytVideosGrid, { visible: true });
      const ytCardBg = parseCssColor(await page.getComputedStyle('#ytVideosGrid .video-card, #view-youtube', 'background-color'));
      assert.ok(relativeLuminance(ytCardBg) < 0.25);

      await switchTab(page, 'oracle');
      const truthBg = parseCssColor(await page.getComputedStyle(SELECTORS.truthCardYoutube, 'background-color'));
      const truthColor = parseCssColor(await page.getComputedStyle(SELECTORS.truthCardYoutube, 'color'));
      assert.ok(relativeLuminance(truthBg) < 0.25);
      assert.ok(relativeLuminance(truthColor) > 0.5);
      page.assertNoRuntimeErrors('T3-15');
    } finally {
      await page.close();
    }
  });

  test('T3-16: Status Optimistic Rollback + Draft Editor Open Interaction', async () => {
    const page = await openAppPage(browser, server.baseUrl);
    try {
      await loadNiche(page, makeUniqueNiche('T3-16'));
      await selectDay(page, 1);
      await page.click(SELECTORS.btnToggleEditMode);
      await page.fill(SELECTORS.editHookInput, 'Unsaved Edit During Rollback');

      await page.mockError('/status', { status: 500 });
      await page.click(SELECTORS.statusBtn('grabado'));

      await page.waitForFunction(() => document.querySelector('#statusBtn-pendiente')?.getAttribute('aria-pressed') === 'true');
      assert.equal(await page.getText(SELECTORS.cardStatusByNum(1)), 'Pendiente');
      assert.equal(await page.getValue(SELECTORS.editHookInput), 'Unsaved Edit During Rollback');
      page.assertNoPageErrors('T3-16');
    } finally {
      await page.close();
    }
  });
});
