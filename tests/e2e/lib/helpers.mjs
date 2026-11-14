import assert from 'node:assert/strict';
import { SELECTORS, VIEWPORTS } from './fixtures.mjs';

/**
 * Opens an isolated page, navigates to baseUrl (plus optional hash/query),
 * and waits until the 30-day roadmap cards have hydrated (unless waitForCards=false).
 */
export async function openAppPage(
  browser,
  baseUrl,
  {
    pathAndHash = '/',
    viewport = VIEWPORTS.DESKTOP,
    colorScheme,
    initScripts = [],
    waitForCards = true,
    beforeNavigate,
  } = {}
) {
  const page = await browser.newPage({ baseUrl, viewport, colorScheme, initScripts });
  if (beforeNavigate) {
    await beforeNavigate(page);
  }
  const targetUrl = `${baseUrl}${pathAndHash.startsWith('/') ? pathAndHash : `/${pathAndHash}`}`;
  await page.goto(targetUrl);
  if (waitForCards) {
    await waitForRoadmapHydrated(page);
  }
  return page;
}

export async function waitForRoadmapHydrated(page, expectedCount = 30, timeoutMs = 10000) {
  await page.waitForFunction(
    (sel, expected) => document.querySelectorAll(sel).length === expected,
    [SELECTORS.dayCard, expectedCount],
    { timeoutMs }
  );
  await page.waitForSelector(SELECTORS.roadmapLinearProgress, { hidden: true, timeoutMs }).catch(() => {});
}

export async function loadNiche(page, niche) {
  await page.evaluate(() => {
    window.__e2ePrevCard1 = document.querySelector('#day-card-1');
  });
  await page.fill(SELECTORS.nicheInput, niche);
  await page.click(SELECTORS.btnLoadRoadmap);
  await page.waitForFunction(
    () => {
      const cards = document.querySelectorAll('.day-card');
      const curCard1 = document.querySelector('#day-card-1');
      return cards.length === 30 && curCard1 && curCard1 !== window.__e2ePrevCard1;
    },
    [],
    { timeoutMs: 10000 }
  ).catch(() => {});
  await waitForRoadmapHydrated(page);
}

export async function confirmDialogAccept(page, { timeoutMs = 5000 } = {}) {
  await page.waitForSelector(SELECTORS.m3ConfirmDialog, { visible: true, timeoutMs });
  const modal = await page.getAttr(SELECTORS.m3ConfirmDialog, 'aria-modal');
  assert.equal(modal, 'true', 'M3 confirmation dialog must have aria-modal="true"');
  await page.click(SELECTORS.m3ConfirmAccept);
  await page.waitForSelector(SELECTORS.m3ConfirmDialog, { hidden: true, timeoutMs });
}

export async function confirmDialogCancel(page, { timeoutMs = 5000 } = {}) {
  await page.waitForSelector(SELECTORS.m3ConfirmDialog, { visible: true, timeoutMs });
  await page.click(SELECTORS.m3ConfirmCancel);
  await page.waitForSelector(SELECTORS.m3ConfirmDialog, { hidden: true, timeoutMs });
}

export async function selectDay(page, dayNum) {
  const cardSel = SELECTORS.dayCardByNum(dayNum);
  await page.click(cardSel);
  await page.waitForFunction(
    (sel, badgeSel, num) => {
      const cardOk = document.querySelector(sel)?.getAttribute('aria-current') === 'true';
      const badgeText = document.querySelector(badgeSel)?.textContent || '';
      const padded = String(num).padStart(2, '0');
      const badgeOk = badgeText.includes(padded) || new RegExp(`\\b${num}\\b`).test(badgeText);
      return cardOk && badgeOk;
    },
    [cardSel, SELECTORS.inspectorDayBadge, dayNum]
  );
}

export async function setDayStatus(page, dayNum, status) {
  await selectDay(page, dayNum);
  const btnSel = SELECTORS.statusBtn(status);
  await page.click(btnSel);
  await page.waitForFunction(
    (bSel) => document.querySelector(bSel)?.getAttribute('aria-pressed') === 'true',
    [btnSel]
  );
  // Allow PATCH /api/roadmap/:id/status to settle
  await new Promise((r) => setTimeout(r, 120));
}

export async function switchTab(page, tabName) {
  const tabSel =
    tabName === 'youtube'
      ? SELECTORS.tabYoutube
      : tabName === 'oracle'
        ? SELECTORS.tabOracle
        : SELECTORS.tabRoadmap;
  const viewSel =
    tabName === 'youtube'
      ? SELECTORS.viewYoutube
      : tabName === 'oracle'
        ? SELECTORS.viewOracle
        : SELECTORS.viewRoadmap;

  await page.click(tabSel);
  await page.waitForSelector(viewSel, { visible: true });
}

export async function assertNoHorizontalOverflow(page, label = '') {
  const dims = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  assert.ok(
    dims.scrollWidth <= dims.innerWidth,
    `${label ? `${label}: ` : ''}Horizontal overflow detected (scrollWidth=${dims.scrollWidth} > innerWidth=${dims.innerWidth})`
  );
}
