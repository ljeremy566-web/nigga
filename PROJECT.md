# Project: Content Studio — Google Material Design 3 & Google Design Apps Redesign

## Original Request & Spec Context
- Original user request: `/home/antigravity/ljeremy566-web/nigga/.agents/teamwork/ORIGINAL_REQUEST.md`
- Note: The Windows path `c:\Users\Jeremy\Downloads\especificaciones_css_y_ui_ux_de_google_material_design_3.md` is not mounted in this Linux workspace and does not exist in git history. Per parent dispatch instructions, this project implements authentic **Google Material Design 3 (M3)** and **Google Design Apps** (Google Workspace / Google AI Studio / Gemini App) CSS, UI, and UX specifications while preserving 100% of existing functionality and Spanish (`lang="es"`) user copy.

## Architecture
- **Backend (Untouched)**: Node.js (`v24`) + Express (`^4.19.2`) + TypeScript (`^5.4.5`) serving static files from `public/` before API routes (`src/index.ts:23`). Target production deployment is a 1 GB RAM Oracle Cloud Micro VM (`NODE_OPTIONS=--max-old-space-size=1024`), so **zero frontend bundlers or heavy frameworks** may be added.
- **Frontend (Redesigned)**: Zero-build static HTML + modular native CSS layers (`public/styles/`) + native browser ES modules (`public/js/`, `<script type="module">`) served directly by Express.
- **M3 Aesthetic Direction**:
  - **Color System**: Authentic Google Blue editorial seed (`#0B57D0` Light / `#A8C7FA` Dark) with complete `--md-sys-color-*` tonal surface containers (`surface-container-lowest` through `surface-container-highest`), `primary-container`, `secondary-container`, `tertiary-container`, `outline`, `outline-variant`, `inverse-surface`, and semantic status containers (`pendiente`, `grabado`, `editado`, `publicado`). Light + Dark modes supported via `[data-theme="light"|"dark"]` + `prefers-color-scheme` fallback.
  - **Typography & Icons**: Google Fonts `'Google Sans'`, `'Roboto Flex'`, `'Roboto'`, `'Roboto Mono'`, and `'Material Symbols Rounded'` (`opsz=24`, `FILL=0` inactive / `FILL=1` active). Sentence-case M3 type scale (`--md-sys-typescale-*`), eliminating undersized uppercase clutter.
  - **Shape, Elevation & State Layers**: M3 shape scale (`xs: 4px`, `sm: 8px`, `md: 12px`, `lg: 16px`, `xl: 28px`, `full: 9999px`) replacing uniform `10px` radii; tonal surface separation replacing nested `1px` borders; 5-level elevation tokens; `::before`/`::after` state layers (`8%` hover, `12%` focus/pressed); M3 emphasized motion curves (`cubic-bezier(0.05, 0.7, 0.1, 1.0)`).
  - **Google Design Apps Layout**: Desktop (`>=840px`) left **M3 Navigation Rail** (`80px`) + **Top App Bar** (`64px`); Mobile (`<840px`) **Top App Bar** + **Bottom Navigation Bar** (`80px`); **List-Detail** workspace with Docked Side Sheet (`>=1024px`) / accessible Modal Sheet (`<1024px`) for `#dayInspector`.

## Feature Inventory
Every feature discovered in the Survey phase is assigned to a milestone below (0 unassigned features).

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | App Shell, Navigation Rail/Bar & Top App Bar | Navigation Rail (`>=840px`) + Bottom Navigation Bar (`<840px`) + Top App Bar (`64px`), 3 views (`Roadmap 30 Días`, `YouTube Research`, `Oráculo & Fuentes`), URL hash sync (`#roadmap`, `#youtube`, `#oracle`) | M2, M3, M4 | Survey 1 & 2 |
| F2 | M3 Design System, Tonal Surfaces & Light/Dark Theme | Full `--md-sys-color-*` Light/Dark tokens, tonal surfaces, Google Sans/Roboto/Roboto Mono, Material Symbols Rounded, M3 shape/elevation/state-layer/motion tokens, persistent theme toggle | M1, M2, M4 | Survey 1 & 3 |
| F3 | Live System & Source Status Indicators | Top App Bar & Oracle view status chips/cards reflecting live `GET /health`, `GET /api/oracle/status`, and data source truth badge | M3, M4 | Survey 2 |
| F4 | Roadmap Command Bar, Load, Generate & AI Oracle | `#nicheInput` (+ Enter), `#igAccountInput`, `Cargar` (`GET /api/roadmap`), `Generar 30 días` (`POST /api/roadmap/generate` + UUID re-hydration), `Ejecutar Oráculo IA` (`POST /api/oracle/run-now`), M3 Confirmation Dialogs before overwrite, Linear Progress & offline fallback banner | M2, M3, M4 | Survey 2 |
| F5 | Roadmap CSV & JSON Export | UTF-8 BOM RFC-4180 CSV (14 columns) and pretty JSON export merging `localStorage` draft overrides, accessed cleanly via M3 Export Menu / action controls | M2, M3, M4 | Survey 2 |
| F6 | Progress Tracking & Multi-Dimensional Filtering | `#progressSummaryText` + M3 Linear Progress Indicator, 5 status counters (`Total`, `Pendiente`, `Grabado`, `Editado`, `Publicado`), Week Filter Chips (`Todas`, `Sem 1..4`), debounced non-flickering Search (`#searchRoadmapInput`), Format & Status filters, Grid/List Segmented Toggle, Reset & Empty State | M2, M3, M4 | Survey 1 & 2 |
| F7 | 30-Day Roadmap Master List & Day Cards | Days grouped by `WEEK_LABELS` (1–4), M3 tonal Day Cards without nested border clutter, active selection state, boot loading skeletons | M2, M3, M4 | Survey 1 & 2 |
| F8 | Day Inspector Side/Bottom Sheet & Keyboard Nav | Desktop Docked Side Sheet (`>=1024px`), Mobile accessible Modal Sheet (`<1024px`) with `role="dialog"`, `aria-modal="true"`, Tab focus trap, body scroll lock, focus restoration, Prev/Next Day buttons, `ArrowLeft`/`ArrowRight`/`Escape` shortcuts | M2, M3, M4 | Survey 2 |
| F9 | Production Status Tracking & Optimistic Sync | M3 Segmented Button status selector (`Pendiente`, `Grabado`, `Editado`, `Publicado`) with optimistic UI update, `PATCH /api/roadmap/:id/status`, rollback on error, consistent capitalized labels | M2, M3, M4 | Survey 2 |
| F10 | Day Content Details, Visual `9:16`/`1:1` Safe-Zone & Copy | Hook, `9:16`/`1:1` visual safe-zone frame + composition tips + stored YouTube thumbnail, Image Prompt, Script, Caption + Hashtags, YouTube Ref link (non-link for `demo_yt_*`), 4 copy buttons with Snackbar feedback | M3, M4 | Survey 2 |
| F11 | Local Draft Editor (`localStorage`) | `Editar`/`Ver detalle`, Hook/Prompt/Script/Caption form, `Guardar borrador` (`content_studio_drafts_v1`), `Borrador`/`Editado localmente` indicators, `Restaurar original` with M3 Confirmation Dialog | M2, M3, M4 | Survey 2 |
| F12 | YouTube Research View & Topic Pivot | Search form (`GET /api/youtube/search`, `maxResults` `6\|10\|15`), clickable History Chips (`GET /api/youtube/history`), Results & Stored Catalog 16:9 Media Cards, loading/error states, `"Usar tema en Roadmap"` with M3 Confirmation/Niche-Edit Dialog before regeneration | M3, M4 | Survey 2 |
| F13 | Oráculo & Fuentes View | Server Health & Uptime card, Last Oracle Run card + manual `"Ejecutar ciclo del Oráculo ahora"` (with M3 Confirmation Dialog), 4 Data Truth transparency cards | M3, M4 | Survey 2 |
| F14 | M3 Snackbar Feedback & Offline Fallback | Single-slot M3 Snackbar queue (`inverse-surface`) replacing stacked generic toasts, plus `generateClientFallbackRoadmap` warning banner on API failure | M2, M3, M4 | Survey 1 & 2 |
| F15 | Full E2E Verification & Visual Hardening | Automated Tier 1–4 opaque-box E2E tests (`TEST_READY.md`), headless Chromium Desktop/Mobile Light/Dark visual verification, Tier 5 adversarial white-box coverage hardening | M5 & E2E Track | Project Pattern |

## Milestones

| # | Name | Scope & Owned Files | Dependencies | Status |
|---|------|---------------------|--------------|--------|
| M1 | Design System & Environment Foundation | Run `npm ci && npm run build` to verify TypeScript build; implement `public/styles/tokens.css` & `public/styles/base.css` (Light+Dark M3 tokens, typography, shapes, elevation, state layers, motion) | none | DONE (e15619cb136e50de5eb026ad4ee3e743) |
| M2 | App Shell & M3 Component Library | Implement `public/styles/shell.css` & `public/styles/components.css` (Top App Bar, Nav Rail/Bar, Buttons, Extended FAB, Filter Chips, Segmented Buttons, Text Fields, Linear Progress, Cards, Side/Bottom Sheet, Dialogs, Menu, Snackbar, Skeletons) | M1 | IN_PROGRESS (7e91c4cae874f3802fa5af1def1d18f2) |
| M3 | HTML Refactor & Feature View Styles | Refactor `public/index.html` (preserving DOM ID/`data-*` contracts + adding theme toggle, nav rail/bar, M3 dialogs, snackbar, Material Symbols Rounded) & create `public/styles/views/{roadmap,youtube,oracle}.css`; remove obsolete `public/styles.css` | M1, M2 | PLANNED |
| M4 | Modular Frontend ES Modules & UX Fixes | Split `public/app.js` into `public/js/{main,state,api,utils}.js`, `public/js/ui/{snackbar,dialog,theme,motion}.js`, `public/js/views/{roadmap-list,day-inspector,youtube-view,oracle-view}.js`; implement debounced search, skeletons, linear progress, M3 confirmation dialogs, accessible modal sheet focus trap, URL hash sync, theme toggle; remove obsolete `public/app.js` | M3 | PLANNED |
| M5 | Final Milestone: E2E Pass & Tier 5 Hardening | Phase 1: Wait for `TEST_READY.md` and pass 100% of E2E Tiers 1–4 + Chromium Light/Dark visual checks. Phase 2: Tier 5 white-box adversarial coverage hardening (`Challenger -> Worker -> Reviewer`) | M1, M2, M3, M4, TEST_READY.md | PLANNED |
| E2E | E2E Testing Track (Parallel) | Build opaque-box requirement-driven E2E test infra (`tests/e2e/`) & Tier 1–4 tests against `PROJECT.md § Feature Inventory` & `§ Interface Contracts`; publish `TEST_INFRA.md` and `TEST_READY.md` | none | IN_PROGRESS (52e9a0158caffd336d5914cba123f240) |

## Interface Contracts

### 1. Backend REST Endpoints (Preserved Unchanged)
- `GET /health` → `200 { status: 'ok', timestamp, uptime }`
- `GET /api/roadmap?niche=...` → `200 { success, count, niche, roadmap: RoadmapDayItem[] }` (auto-generates 30 days if none exist)
- `POST /api/roadmap/generate` (`{ niche }`) → `200 { success, message, count, roadmap: RoadmapDayItem[] }` (frontend MUST subsequently call `GET /api/roadmap?niche=...` to hydrate UUIDs)
- `PATCH /api/roadmap/:id/status` (`{ status: 'pendiente'|'grabado'|'editado'|'publicado' }`) → `200 { success, message }` (optimistic UI with rollback on non-2xx)
- `GET /api/youtube/search?q=...&maxResults=6|10|15&saveToDb=true` → `200 { success, query, count, savedToDb, videos: YouTubeVideoItem[] }`
- `GET /api/youtube/history` → `200 { success, count, history }`
- `GET /api/videos` → `200 { success, count, videos }`
- `POST /api/oracle/run-now` (`{ niche, instagramAccount }`) → `200 { success, report }`
- `GET /api/oracle/status` → `200 { success, lastExecution }`

### 2. DOM IDs, Attributes & Storage Contracts (Preserved for Parity & E2E Tests)
- **Theme**: `document.documentElement.dataset.theme` (`"light"` | `"dark"`), persisted in `localStorage` key `content_studio_theme_v1`; toggle button `#btnThemeToggle`.
- **Navigation Tabs**: `#tab-roadmap` (`data-tab="roadmap"`), `#tab-youtube` (`data-tab="youtube"`), `#tab-oracle` (`data-tab="oracle"`), panels `#view-roadmap`, `#view-youtube`, `#view-oracle` (`.hidden` on inactive, `aria-selected="true"|"false"`), synced with `window.location.hash` (`#roadmap`, `#youtube`, `#oracle`). Note: Desktop Nav Rail and Mobile Nav Bar may either share a single responsive `<nav>` element with those exact IDs `#tab-roadmap`, `#tab-youtube`, `#tab-oracle` (recommended — zero duplicate IDs!) so selectors are 100% unique and valid HTML.
- **Status Badges**: `#statusHealthBadge`, `#statusOracleBadge`, `#statusSourceBadge`.
- **Roadmap Command & Progress**: `#nicheInput`, `#igAccountInput`, `#btnLoadRoadmap`, `#btnGenerateRoadmap`, `#btnRunOracle`, `#btnExportCsv`, `#btnExportJson`, `#roadmapSourceNotice`, `#roadmapLinearProgress` (visible during async load/generate/oracle), `#progressSummaryText`, `#progressFill`, `#countTotal`, `#countPendiente`, `#countGrabado`, `#countEditado`, `#countPublicado`.
- **Roadmap Filters & List**: `#weekFilterGroup` (`#btnWeekAll`, `#btnWeek1`..`#btnWeek4` with `data-week="all|1|2|3|4"`), `#searchRoadmapInput`, `#formatFilterSelect`, `#statusFilterSelect`, `#viewModeGrid`, `#viewModeTimeline`, `#btnResetFilters`, `#roadmapList`, `#roadmapEmptyState`, `#btnEmptyResetFilters`, `.day-card` (`#day-card-{n}`, `data-day="{n}"`, `[data-card-status="{n}"]`).
- **Day Inspector Sheet**: `#dayInspector`, `#inspectorBackdrop`, `#inspectorDayBadge`, `#inspectorWeekBadge`, `#inspectorFormatBadge`, `#inspectorPillarBadge`, `#localDraftBadge`, `#btnPrevDay`, `#btnNextDay`, `#btnToggleEditMode`, `#btnCloseDrawer`, `#dayInspectorContent`, `#inspectorStatusGroup` (`#statusBtn-pendiente`, `#statusBtn-grabado`, `#statusBtn-editado`, `#statusBtn-publicado` with `data-status`), `#inspectorTitle`, `#btnCopyHook`, `#inspectorHook`, `#btnCopyPrompt`, `#visualAspectFrame` (`data-ratio="9:16"|"1:1"`), `#visualFrameDay`, `#visualFrameFormat`, `#visualRatioLabel`, `#visualCompositionTip`, `#visualRefThumb`, `#inspectorImagePrompt`, `#btnCopyScript`, `#inspectorScript`, `#btnCopyCaption`, `#inspectorCaption`, `#inspectorHashtags`, `#inspectorYoutubeRef`, `#inspectorRefLink`, `#draftEditorForm` (`#editHookInput`, `#editPromptInput`, `#editScriptInput`, `#editCaptionInput`, `#btnResetDraft`, `#btnCancelDraft`, `#btnSaveDraft`). Draft storage key: `content_studio_drafts_v1` keyed by `${niche.toLowerCase()}::${day_number}`.
- **M3 Confirm Dialog & Snackbar**: `#m3ConfirmDialog` (`role="alertdialog"` / `role="dialog"`, `aria-modal="true"`, `#m3ConfirmTitle`, `#m3ConfirmBody`, `#m3ConfirmCancel`, `#m3ConfirmAccept`), `#toastContainer` (M3 Snackbar slot).
- **YouTube Research**: `#ytSearchForm`, `#ytSearchInput`, `#ytMaxResultsSelect`, `#btnYtSearch`, `#ytHistoryList` (`.history-chip[data-history-query]`), `#ytResultsSection`, `#ytResultsList`, `#ytVideosGrid`, `[data-use-topic]`.
- **Oráculo & Fuentes**: `#oracleHealthCard`, `#healthStatusText`, `#healthUptimeText`, `#oracleLastRunCard`, `#oracleLastStatus`, `#oracleLastTimestamp`, `#oracleLastDetails`, `#btnOracleTabRun`, `#dataTruthGrid` (`#truthCard-youtube`, `#truthCard-gemini`, `#truthCard-supabase`, `#truthCard-instagram`).

### 3. CSS Token Naming Contract (`public/styles/tokens.css` -> downstream CSS)
- Color roles: `--md-sys-color-{primary,on-primary,primary-container,on-primary-container,secondary,on-secondary,secondary-container,on-secondary-container,tertiary,on-tertiary,tertiary-container,on-tertiary-container,error,on-error,error-container,on-error-container,surface,surface-dim,surface-bright,surface-container-lowest,surface-container-low,surface-container,surface-container-high,surface-container-highest,on-surface,on-surface-variant,outline,outline-variant,inverse-surface,inverse-on-surface,inverse-primary,scrim}`
- Semantic status roles: `--md-ext-color-status-{pendiente,grabado,editado,publicado}-{bg,fg}`
- Shape scale: `--md-sys-shape-corner-{none,extra-small,small,medium,large,extra-large,full}`
- Elevation: `--md-sys-elevation-level{0..5}`
- Typography: `--md-sys-typescale-{display,headline,title,body,label}-{large,medium,small}-{font,size,line-height,weight,tracking}`
- Motion: `--md-sys-motion-easing-{standard,emphasized,emphasized-decelerate,emphasized-accelerate}`, `--md-sys-motion-duration-{short1..4,medium1..4,long1..2}`
- State layers: `--md-sys-state-{hover,focus,pressed,dragged}-opacity`

## Code Layout

```
/home/antigravity/ljeremy566-web/nigga/
├── src/                         # Backend Express + TypeScript (DO NOT MODIFY)
├── sql/                         # Supabase schema (DO NOT MODIFY)
├── oracle/                      # VPS deploy configs (DO NOT MODIFY)
├── public/                      # Frontend static files (M1-M4 target)
│   ├── index.html               # M3 owns
│   ├── styles/
│   │   ├── tokens.css           # M1 owns
│   │   ├── base.css             # M1 owns
│   │   ├── shell.css            # M2 owns
│   │   ├── components.css       # M2 owns
│   │   └── views/
│   │       ├── roadmap.css      # M3 owns
│   │       ├── youtube.css      # M3 owns
│   │       └── oracle.css       # M3 owns
│   └── js/                      # M4 owns
│       ├── main.js
│       ├── state.js
│       ├── api.js
│       ├── utils.js
│       ├── ui/
│       │   ├── snackbar.js
│       │   ├── dialog.js
│       │   ├── theme.js
│       │   └── motion.js
│       └── views/
│           ├── roadmap-list.js
│           ├── day-inspector.js
│           ├── youtube-view.js
│           └── oracle-view.js
├── tests/
│   └── e2e/                     # E2E Testing Track owns (never inside .agents/teamwork/)
├── PROJECT.md                   # Project Orchestrator owns
├── TEST_INFRA.md                # E2E Testing Orchestrator owns
└── TEST_READY.md                # E2E Testing Orchestrator publishes on completion
```
