import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launchBrowser } from './lib/cdp.mjs';
import { SELECTORS, STORAGE_KEYS, VIEWPORTS } from './lib/fixtures.mjs';
import {
  assertNoHorizontalOverflow,
  confirmDialogAccept,
  openAppPage,
} from './lib/helpers.mjs';
import { startServer } from './lib/server.mjs';

// Tiny valid 1x1 PNG data URL for Vision/Thumbnail testing without external assets
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2Z0AAAAASUVORK5CYII=';

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

describe('Instagram Reels Capture (Antigravity Browser / CDP) + Independent Roadmap IG', () => {
  test('API: Capture Reels, Gemini Vision fallback, Generate 30-day IG Roadmap & strict YouTube isolation', async () => {
    const statusRes0 = await fetch(`${server.baseUrl}/api/instagram/status`);
    assert.equal(statusRes0.status, 200);
    const status0 = await statusRes0.json();
    assert.equal(status0.success, true);
    assert.equal(status0.reelsCount, 0);

    // 1. Capture Reels payload (mimicking Antigravity Browser / CDP script)
    const capturePayload = {
      sourceQuery: 'ia automatizacion',
      capturedVia: 'antigravity_browser',
      reels: [
        {
          reelUrl: 'https://www.instagram.com/reel/CxAiTest001/',
          authorHandle: 'creador_ia',
          caption: '3 automatizaciones con IA que ahorran 10 horas #ia #productividad #reels',
          audioName: 'Sonido Viral IA',
          viewCount: '48.2K',
          likeCount: '3.1K',
          commentCount: '240',
          frameImageBase64: TINY_PNG_DATA_URL,
        },
        {
          shortcode: 'CxAiTest002',
          authorHandle: '@marketing_lab',
          caption: 'Deja de editar manual tus guiones con esta plantilla #marketing #contenido',
          viewCount: '1.2M',
          likeCount: 54200,
          commentCount: 890,
        },
      ],
    };

    const capRes = await fetch(`${server.baseUrl}/api/instagram/reels/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(capturePayload),
    });
    assert.equal(capRes.status, 200);
    const capData = await capRes.json();
    assert.equal(capData.success, true);
    assert.equal(capData.count, 2);

    const firstReel = capData.reels.find((r) => r.shortcode === 'CxAiTest001');
    const secondReel = capData.reels.find((r) => r.shortcode === 'CxAiTest002');
    assert.ok(firstReel, 'First captured reel should extract shortcode from reelUrl');
    assert.equal(firstReel.author_handle, '@creador_ia');
    assert.equal(firstReel.view_count, 48200);
    assert.equal(firstReel.like_count, 3100);
    assert.equal(firstReel.comment_count, 240);
    assert.equal(firstReel.thumbnail_data_url, TINY_PNG_DATA_URL);
    assert.ok(firstReel.visual_hook_text.length > 0, 'Vision fallback should extract visual_hook_text');
    assert.ok(firstReel.detected_angle.length > 0, 'Vision fallback should assign detected_angle');

    assert.ok(secondReel);
    assert.equal(secondReel.view_count, 1200000);
    assert.equal(secondReel.author_handle, '@marketing_lab');

    // 2. Verify GET /api/instagram/reels & status count
    const listRes = await fetch(`${server.baseUrl}/api/instagram/reels`);
    const listData = await listRes.json();
    assert.equal(listRes.status, 200);
    assert.equal(listData.count, 2);

    const statusRes1 = await fetch(`${server.baseUrl}/api/instagram/status`);
    const status1 = await statusRes1.json();
    assert.equal(status1.reelsCount, 2);

    // 3. Generate independent 30-day IG Roadmap fed by captured Reels
    const niche = 'IA y Automatización IG Test';
    const genRes = await fetch(`${server.baseUrl}/api/instagram/roadmap/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niche, sourceQuery: 'ia automatizacion' }),
    });
    assert.equal(genRes.status, 200);
    const genData = await genRes.json();
    assert.equal(genData.success, true);
    assert.equal(genData.count, 30);
    assert.equal(genData.reelsUsed, 2);
    assert.equal(genData.roadmap.length, 30);

    const day1Ig = genData.roadmap[0];
    assert.equal(day1Ig.day_number, 1);
    assert.equal(day1Ig.week_number, 1);
    assert.ok(['Reel', 'Carrusel', 'Story'].includes(day1Ig.format));
    assert.ok(day1Ig.hook && day1Ig.script && day1Ig.image_prompt && day1Ig.caption);
    assert.ok(['CxAiTest001', 'CxAiTest002'].includes(day1Ig.reference_reel_shortcode));
    assert.match(day1Ig.reference_reel_url, /^https:\/\/www\.instagram\.com\/reel\//);

    // 4. Verify complete isolation from main YouTube roadmap (/api/roadmap)
    const ytGet0 = await fetch(`${server.baseUrl}/api/roadmap?niche=${encodeURIComponent(niche)}`);
    const ytData0 = await ytGet0.json();
    assert.equal(ytData0.roadmap[0].status, 'pendiente');

    const patchIg = await fetch(`${server.baseUrl}/api/instagram/roadmap/1/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'grabado', niche }),
    });
    assert.equal(patchIg.status, 200);

    const ytGet1 = await fetch(`${server.baseUrl}/api/roadmap?niche=${encodeURIComponent(niche)}`);
    const ytData1 = await ytGet1.json();
    assert.equal(ytData1.roadmap[0].status, 'pendiente', 'Updating IG Roadmap status must NEVER mutate YouTube Roadmap');

    const patchYt = await fetch(`${server.baseUrl}/api/roadmap/1/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'publicado' }),
    });
    assert.equal(patchYt.status, 200);

    const igGet1 = await fetch(`${server.baseUrl}/api/instagram/roadmap?niche=${encodeURIComponent(niche)}`);
    const igData1 = await igGet1.json();
    assert.equal(igData1.roadmap[0].status, 'grabado', 'Updating YouTube Roadmap status must NEVER mutate IG Roadmap');

    // 5. Delete one captured Reel
    const delRes = await fetch(`${server.baseUrl}/api/instagram/reels/CxAiTest002`, {
      method: 'DELETE',
    });
    assert.equal(delRes.status, 200);
    const listAfterDel = await (await fetch(`${server.baseUrl}/api/instagram/reels`)).json();
    assert.equal(listAfterDel.count, 1);
  });

  test('UI E2E (Chromium): IG Reels JSON import, separate 30-day Roadmap IG, filters, drafts & isolation', async () => {
    const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.DESKTOP });
    try {
      // Main YouTube roadmap should have 30 .day-card items
      const initialMainCards = await page.count(SELECTORS.dayCard);
      assert.equal(initialMainCards, 30);

      // Navigate to IG Reels tab
      await page.click('#tab-ig-reels');
      await page.waitForSelector('#view-ig-reels', { visible: true });
      assert.equal(await page.evaluate(() => window.location.hash), '#ig-reels');

      // Open JSON import panel and import a fresh Reel
      await page.click('#btnToggleIgImport');
      await page.waitForSelector('#igImportPanel', { visible: true });
      await page.fill('#igImportSourceInput', 'productividad_e2e');
      await page.fill(
        '#igImportJsonInput',
        JSON.stringify([
          {
            shortcode: 'UiTestReel99',
            authorHandle: '@ui_creator',
            caption: 'Sistema diario de 3 bloques para creadores #productividad #reels',
            viewCount: '95.4K',
            likeCount: '7.2K',
            commentCount: '310',
            frameImageBase64: TINY_PNG_DATA_URL,
          },
        ])
      );
      await page.click('#btnSubmitIgImport');

      // Wait for rendered IG Reel card
      await page.waitForSelector('.ig-reel-card[data-ig-shortcode="UiTestReel99"]', { visible: true });
      const reelsBadgeText = await page.getText('#igReelsCountBadge');
      assert.match(reelsBadgeText, /Reels capturados/i);

      // Check Oracle tab truth badge updates cleanly
      await page.click('#tab-oracle');
      await page.waitForSelector('#view-oracle', { visible: true });
      const igTruthText = await page.getText('#truthCard-instagram');
      assert.match(igTruthText, /Real\s*·\s*\d+\s*Reels?/i);

      // Navigate to Roadmap IG tab
      await page.click('#tab-ig-roadmap');
      await page.waitForSelector('#view-ig-roadmap', { visible: true });
      assert.equal(await page.evaluate(() => window.location.hash), '#ig-roadmap');

      // Generate independent 30-day IG Roadmap for a clean test niche
      const uiNiche = 'Nicho IG E2E UI';
      await page.fill('#igRoadmapNicheInput', uiNiche);
      await page.click('#btnGenerateIgRoadmap');
      await confirmDialogAccept(page);

      // Wait for 30 .ig-day-card items
      await page.waitForFunction(
        () => document.querySelectorAll('#igRoadmapList .ig-day-card').length === 30,
        [],
        { timeout: 10000 }
      );

      // Crucial: main roadmap .day-card count must still be strictly 30 (no selector collision)
      assert.equal(await page.count('.day-card'), 30);
      assert.equal(await page.count('#igRoadmapList .ig-day-card'), 30);
      assert.equal(await page.count('#igDayDotsStrip [data-ig-dot-day]'), 30);

      // Test Week Filter
      await page.click('#btnIgWeek2');
      await page.waitForFunction(
        () => document.querySelectorAll('#igRoadmapList .ig-day-card').length === 7
      );
      await page.click('#btnResetIgFilters');
      await page.waitForFunction(
        () => document.querySelectorAll('#igRoadmapList .ig-day-card').length === 30
      );

      // Select Day 3 (or find a Carrusel day) and verify Inspector + Safe-Zone
      await page.click('#ig-day-card-3');
      await page.waitForFunction(() =>
        (document.querySelector('#igInspectorDayBadge')?.textContent || '').includes('03')
      );
      const reelRefText = await page.getText('#igInspectorReelLink');
      assert.ok(reelRefText.length > 0, 'IG Inspector must display reference Reel link');

      // Test Expand Inspector + Escape collapse
      await page.click('#btnIgExpandInspector');
      assert.equal(
        await page.evaluate(() => document.querySelector('#igRoadmapWorkspace')?.classList.contains('is-inspector-expanded')),
        true
      );
      await page.pressKey('Escape');
      assert.equal(
        await page.evaluate(() => document.querySelector('#igRoadmapWorkspace')?.classList.contains('is-inspector-expanded')),
        false
      );

      // Test Inspector Subtabs (Visual & Caption)
      await page.click('[data-ig-inspector-tab="visual"]');
      assert.equal(
        await page.evaluate(() =>
          document.querySelector('[data-ig-inspector-panel="visual"]')?.classList.contains('is-active')
        ),
        true
      );
      await page.click('[data-ig-inspector-tab="script"]');

      // Test Status persistence & isolation (compact dropdown updates segmented buttons + card badge)
      await page.selectOption('#igInspectorStatusSelect', 'editado');
      await page.waitForFunction(
        () =>
          document
            .querySelector('#igInspectorStatusGroup .status-btn[data-status="editado"]')
            ?.getAttribute('aria-pressed') === 'true'
      );
      const card3Status = await page.getText('[data-ig-card-status="3"]');
      assert.equal(card3Status.trim(), 'Editado');

      // Test Local Draft Save into isolated localStorage key
      await page.click('#btnIgToggleEditMode');
      await page.waitForSelector('#igDraftEditorForm', { visible: true });
      await page.fill('#igEditHookInput', 'Gancho editado solo en Roadmap IG');
      await page.click('#btnIgSaveDraft');
      await page.waitForSelector('#igLocalDraftBadge', { visible: true });

      const storageState = await page.evaluate((ytKey) => ({
        igDrafts: localStorage.getItem('content_studio_ig_drafts_v1') || '',
        ytDrafts: localStorage.getItem(ytKey) || '',
      }), STORAGE_KEYS.drafts);

      assert.match(storageState.igDrafts, /Gancho editado solo en Roadmap IG/);
      assert.equal(storageState.ytDrafts, '', 'IG drafts must stay isolated from YouTube drafts storage');

      // Restore original draft
      await page.click('#btnIgToggleEditMode');
      await page.click('#btnIgResetDraft');
      await confirmDialogAccept(page);
      assert.equal(await page.isVisible('#igLocalDraftBadge'), false);

      // Test Grid / Timeline view toggle
      await page.click('#igViewModeGrid');
      assert.equal(
        await page.evaluate(() => document.querySelector('#igRoadmapList')?.classList.contains('roadmap-list--grid')),
        true
      );
      await page.click('#igViewModeTimeline');
      assert.equal(
        await page.evaluate(() => document.querySelector('#igRoadmapList')?.classList.contains('roadmap-list--timeline')),
        true
      );

      // Mobile layout & overflow check
      await page.setViewport(VIEWPORTS.MOBILE);
      await assertNoHorizontalOverflow(page, 'IG Roadmap mobile');
      await page.click('#ig-day-card-5');
      await page.waitForSelector('#igDayInspector', { visible: true });
      await page.click('#btnIgCloseDrawer');

      page.assertNoRuntimeErrors('IG Roadmap UI E2E');
    } finally {
      await page.close();
    }
  });

  test('Regression: Empty default #nicheInput/#igAccountInput and fenced/messy JSON import with duplicate shortcodes & invalid postedAt', async () => {
    const page = await openAppPage(browser, server.baseUrl, { viewport: VIEWPORTS.DESKTOP });
    try {
      assert.equal(await page.getValue(SELECTORS.nicheInput), '');
      assert.equal(await page.getValue(SELECTORS.igAccountInput), '');

      await page.click('#tab-ig-reels');
      await page.waitForSelector('#view-ig-reels', { visible: true });
      await page.click('#btnToggleIgImport');
      await page.waitForSelector('#igImportPanel', { visible: true });

      const messyPastedJson = `Aquí tienes la captura:
\`\`\`json
{
  "sourceQuery": "cosmetologia @ssabeaute",
  "items": [
    {
      "link": "https://www.instagram.com/reel/FencedDup01/",
      "username": "ssabeaute",
      "description": "Rutina facial de limpieza profunda #cosmetologia",
      "views": "18.4K",
      "likes": "1.2K",
      "postedAt": "hace 2 días",
    },
    {
      "shortcode": "FencedDup01",
      "handle": "@ssabeaute",
      "text": "Rutina facial actualizada #skincare",
      "viewsCount": "19K",
    },
  ],
}
\`\`\`
Listo!`;

      await page.fill('#igImportJsonInput', messyPastedJson);
      await page.click('#btnSubmitIgImport');

      await page.waitForSelector('.ig-reel-card[data-ig-shortcode="FencedDup01"]', { visible: true });
      const cardText = await page.getText('.ig-reel-card[data-ig-shortcode="FencedDup01"]');
      assert.match(cardText, /@ssabeaute/);
      assert.match(cardText, /Rutina facial actualizada/);

      page.assertNoRuntimeErrors('Regression fenced JSON & empty defaults');
    } finally {
      await page.close();
    }
  });
});
