# Test Infrastructure (`TEST_INFRA.md`)

- **Owner**: `sub_orch_e2e` (E2E Testing Track)
- **Test Suite Location**: `/home/antigravity/ljeremy566-web/nigga/tests/e2e/`
- **Methodology**: Opaque-box, requirement-driven 4-tier E2E testing derived strictly from `ORIGINAL_REQUEST.md` and `PROJECT.md` (`§ Feature Inventory` F1–F14 & `§ Interface Contracts`).

## Runtime Stack & Zero-Dependency Policy
Because target production is a 1 GB RAM Oracle Cloud Micro VM (`package.json` uses zero frontend bundlers and no Playwright/Puppeteer packages), the E2E suite uses built-in system tools with **zero extra npm dependencies**:
1. **Test Runner**: Node.js `v24.22.2` built-in `node:test` and `node:assert/strict`.
2. **Browser Engine**: `/usr/bin/chromium` (`Chromium 156.0.8078.79`) launched in headless mode (`--headless --no-sandbox --disable-gpu --remote-debugging-port=0` with isolated `--user-data-dir` per run).
3. **Browser Automation Protocol**: Native Node `v24` `fetch` + global `WebSocket` communicating directly with Chromium's Chrome DevTools Protocol (CDP) (`Page`, `Runtime`, `DOM`, `Emulation`, `Fetch`, `Input`, `Network`, `Log`).
4. **Target Server Lifecycle**: Isolated child process `node dist/index.js` launched on an isolated test port (`TEST_PORT` or dynamic available port) with `GET /health` readiness polling and guaranteed `SIGTERM`/`SIGKILL` teardown in `finally` / `after()` hooks. Runs cleanly in built-in Supabase/YouTube fallback mode when `.env` is absent.

## Directory Layout (Planned)
```
tests/e2e/
├── run-e2e.mjs                  # CLI entrypoint supporting --tier=1|2|3|4|all and --filter=...
├── lib/
│   ├── server.mjs               # Isolated Express dist/index.js process manager & /health wait
│   ├── cdp.mjs                  # Raw WebSocket CDP client & Chromium process launcher
│   ├── page.mjs                 # High-level browser page helpers (goto, click, fill, keyboard, eval, waitFor, fetch intercept, screenshot, console/error capture)
│   └── fixtures.mjs             # Opaque-box contract constants (F1-F14 selectors, API schemas, M3 token lists)
├── tier1-features.test.mjs      # Tier 1: Feature Coverage (>=5 tests per feature F1-F14 => >=70 tests)
├── tier2-boundaries.test.mjs    # Tier 2: Boundary & Corner Cases (>=5 tests per feature F1-F14 => >=70 tests)
├── tier3-combinations.test.mjs  # Tier 3: Cross-Feature Combinations (>=14 pairwise interactions)
└── tier4-scenarios.test.mjs     # Tier 4: Real-World Creator Scenarios + M3 Visual/CSS/A11y/Screenshots (>=7 scenarios)
```

## Execution Commands
Once `npm ci && npm run build` has generated `dist/index.js`:
```bash
# Run full 4-tier E2E suite
node tests/e2e/run-e2e.mjs

# Run individual tiers
node tests/e2e/run-e2e.mjs --tier=1
node tests/e2e/run-e2e.mjs --tier=2
node tests/e2e/run-e2e.mjs --tier=3
node tests/e2e/run-e2e.mjs --tier=4

# Or directly via Node built-in test runner
node --test tests/e2e/tier*.test.mjs
```
