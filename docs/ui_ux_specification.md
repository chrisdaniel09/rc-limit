# RCLimit: UI/UX Specification

**Document Type:** UI/UX Specification (design target, not implementation)
**Scope:** `rclimit-ui` (React 19, Vite 8, Tailwind CSS v4, React Router 7)
**Builds on:** [`ui_ux_design_system_standards.md`](./ui_ux_design_system_standards.md) (the "Standards")
**Date:** 30 October 2026
**Status:** Draft for review

---

## 0. How to Read This Document

| Part | Contents |
|---|---|
| §1 | Audit of the current screens: what exists today and what this spec changes |
| §2 | Design principles |
| §3 | Theming architecture: tenant branding, light/dark, density |
| §4 | Foundations: color, type, spacing, radius, elevation, motion, icons |
| §5 | Data formatting rules (currency, dates, enums, nulls) |
| §6 | The domain status registry (every status → tone, label, icon) |
| §7 | Layout: app shell and page templates |
| §8 | Component specifications |
| §9 | HATEOAS-driven action rules |
| §10 | Screen-by-screen specifications |
| §11 | Interaction patterns (feedback, confirmation, keyboard) |
| §12 | Accessibility |
| §13 | Content and voice |
| §14 | Migration roadmap |
| §15 | Open decisions |
| Appendix A | Per-screen acceptance checklist |

Keywords **MUST**, **SHOULD** and **MAY** have their RFC 2119 meanings.

### 0.1 Where this spec departs from the Standards

The Standards were written against Tailwind v3 (`tailwind.config.js`) and HSL triplets. The codebase uses **Tailwind v4**, which has no JS config file and is configured in CSS. This spec keeps every intent of the Standards and changes only the mechanism:

| Standards say | This spec says | Why |
|---|---|---|
| Map variables in `tailwind.config.js` | Map variables with `@theme inline` in `src/index.css` | Tailwind v4 is CSS-first; there is no config file in the repo. |
| HSL triplets (`--primary: 243 75% 59%`) | Full color values in **OKLCH** (`--primary: oklch(0.55 0.22 275)`) | Tailwind v4 and current Shadcn use OKLCH. It gives even lightness steps, which makes the contrast checks on tenant colors (§3.6) reliable. HSL input stays accepted in the tenant theme file and is converted at build/upload time. |
| 48×48 px touch target on every clickable element | 48 px on coarse pointers (touch) and below `md`; 36 px (32 px in compact density) on fine pointers | A 48 px row height on desktop halves the rows visible in ledgers and goes against the high-density goal in Standards §1. WCAG 2.2 AA (2.5.8) needs only 24 px. Field agents on phones still get 48 px. |
| `font-mono` for currency | `tabular-nums` on the sans font is the default; mono only for identifiers | Monospaced amounts look heavy in dense tables. `tnum` gives the same vertical alignment. Mono is kept for IDs, reg numbers and transaction IDs, where telling characters apart matters (0/O, 1/l). |

---

## 1. Current-State Audit

### 1.1 Screen inventory

| Area | Route | File | Pattern today |
|---|---|---|---|
| Auth | `/login` | `pages/auth/LoginPage.tsx` | Centered card |
| Dashboard | `/` | `pages/dashboard/DashboardPage.tsx` + `widgets/*` | Stacked widgets picked by rights (`LoanStats`, `MyLeads`, `RcAging`) |
| Leads | `/leads` | `pages/leads/LeadsPage.tsx` | Server table, scope toggle, status filter, Add Lead modal |
| | `/leads/:id` | `pages/leads/LeadDetailPage.tsx` (1,159 lines) | Full-height page, action tiles, three hand-built modals (action panel, comments, convert) |
| Customers | `/customers` | `pages/customers/CustomersPage.tsx` | Server table with sub-limit bar, type filter |
| | `/customers/:id` | `pages/customers/CustomerDetailPage.tsx` | Summary card, vehicles table, lead history table |
| Loans | `/loans` | `pages/loans/LoansPage.tsx` | Server table, Create Loan modal |
| | `/loans/:id` | `pages/loans/LoanDetailPage.tsx` | Summary grid, payout breakdown, ledger table, four modals |
| | `/rc-limit-ledger` | `pages/loans/RcLimitLedgerPage.tsx` | Five-field filter form, hand-built table, totals |
| Partners | `/partners` | `pages/partners/PartnersPage.tsx` | Server table + modal |
| Masters | `/lenders`, `/accounting/particular-types`, `/lead-product-types` | `LendersPage`, `ParticularTypesPage`, `ProductTypesPage` | Table + modal; Product Types has a field-schema builder |
| Access | `/admin/users`, `/admin/roles`, `/admin/rights` | `pages/admin/*` | Table + modal; Roles has a rights checklist |
| Accounting (hidden) | `/accounting/*` | `pages/accounting/*` | Hidden by `SHOW_ACCOUNTING = false` in `Sidebar.tsx` |

Shared components: `Badge`, `CommentsPanel`, `DataTable`, `FormField`, `Modal`, `Pagination`, `PhoneInput`, `Sidebar`, `StatCard`, `Topbar`.

### 1.2 Findings

What already works and MUST be kept: the server-mode `DataTable` (search/sort/page owned by the API, header stays mounted while loading), page-size persistence in `useListState`, right-based widget registry, the `PhoneInput` with `+91` prefix and `inputMode="numeric"`, inline helper text explaining business rules (e.g. "A credit straight to the customer is recorded but does not change the Anna Finance balance"), and the disabled-debit guard when a debit exceeds the balance.

| # | Finding | Evidence | Fix in this spec |
|---|---|---|---|
| F1 | **No theming layer.** `src/index.css` is one line (`@import "tailwindcss"`). Raw palette classes are used everywhere: `indigo-600` alone appears 62 times. A tenant rebrand would touch every file. | `src/index.css`, all pages | §3 tokens; §14 phase 1 |
| F2 | **Brand is hardcoded** to one tenant: "RC Limit" wordmark in `Sidebar.tsx` and `LoginPage.tsx`; login placeholder `admin@annafinance.in`; "Anna Finance Balance" labels in `LoanDetailPage.tsx`. | Sidebar.tsx:722, LoginPage.tsx, LoanDetailPage.tsx | §3.4 tenant theme contract (`brand.name`, `terminology`) |
| F3 | **No dark mode.** | — | §3.3 |
| F4 | **Blocking browser dialogs.** 17 `alert()` / `confirm()` calls (13 in `LeadDetailPage.tsx`). They can't be themed, block the thread, and break on some mobile browsers. | grep | §8.14 Toast, §8.12 ConfirmDialog |
| F5 | **Four modal implementations.** `Modal.tsx` plus three hand-built `fixed inset-0 z-50` overlays in `LeadDetailPage.tsx`. None trap focus, close on `Esc`, or restore focus. None become bottom sheets on mobile (Standards §5B). | Modal.tsx, LeadDetailPage.tsx:716, 832, 855 | §8.11 ResponsiveDialog |
| F6 | **Currency formatting is duplicated and inconsistent.** 8 local `formatCurrency` copies; 4 show 0 decimals, 4 show 2. The same loan's amount is ₹15,00,000 on the list and ₹15,00,000.00 on the detail. No `tabular-nums`, so ledger columns don't line up. | grep | §5.1 |
| F7 | **Status colors are inconsistent and incomplete.** `DEBIT` renders `neutral` (Standards say danger). `CLOSED` is green like `ACTIVE`. `WITHDRAWN` falls through to neutral by accident. `DISBURSED`, `PENDING`, `NEW` and `CREDIT_REVIEW` all share one blue. Lead detail uses its own `TONE_CLASSES` table. | badgeVariants.ts, LeadDetailPage.tsx | §6 |
| F8 | **Status shown by color only.** Badges have no icon; a colorblind user can't tell `AMBER` from `GREEN`. | Badge.tsx | §6, §12 |
| F9 | **Emoji as icons** in the sidebar (👥 📄 📒 🤝). They render differently per OS and have no accessible name. | Sidebar.tsx:630–678 | §4.8 Lucide icons |
| F10 | **Topbar title falls back to "RCLimit"** on customer, lead, admin and master pages; there are no breadcrumbs. | Topbar.tsx:790–808 | §7.2 route `handle.title` + breadcrumbs |
| F11 | **Tables don't adapt to mobile.** `overflow-x-auto` forces horizontal scroll on 9–11 column tables (Standards §5A). | DataTable.tsx, ledger tables | §8.6 |
| F12 | **Ledger tables are hand-built three times** (loan detail, RC ledger, journal entries), with differing padding and no shared totals row. | — | §8.7 LedgerTable |
| F13 | **Long lists in native `<select>`.** Customer, bank pool and partner pickers list every record. This won't scale with a tenant of 2,000 dealers. | LoansPage.tsx:169, RcLimitLedgerPage.tsx:278 | §8.4 Combobox |
| F14 | **Filters are bespoke per page** (status select on Leads, type select on Customers, five-field form on RC Ledger) and aren't in the URL, so a filtered view can't be shared or survive refresh. | — | §8.8 FilterBar, §11.5 |
| F15 | **Actions are hidden, not explained.** "Convert to customer" disappears without `leads.edit`. Stage actions are filtered by `nextStatuses` with no reason for missing ones (Standards §6B). | LeadDetailPage.tsx:595, LoanDetailPage.tsx | §9 |
| F16 | **Lead detail loading state is `h-screen`** inside the layout, so it overflows the shell; lead detail uses `h-[calc(100vh-120px)]`, a magic number tied to the topbar height. | LeadDetailPage.tsx:518, 551 | §7.3 page templates |
| F17 | **Amount inputs use `type="number"`**, which allows `e`, scroll-wheel changes, and loses Indian grouping while typing. | FormField usages | §8.3 CurrencyInput |
| F18 | **No focus-visible styling** beyond input rings; sidebar links and table rows have none. Rows are clickable `<tr>` with no keyboard access. | DataTable.tsx:413 | §12 |
| F19 | **Error display varies:** red text under form, red box at top of card, inline banner, or `alert()`. | — | §11.1 |

---

## 2. Design Principles

1. **Density with clarity.** Operators process dozens of files a day. Show more rows, fewer cards. Whitespace is a grouping tool, not decoration.
2. **Money is sacred.** Every amount is formatted the same way everywhere, aligned with tabular figures, signed by color *and* symbol, and never ambiguous about which ledger it belongs to.
3. **Color means status.** Brand color marks the one primary action on a screen. Green, amber and red are reserved for financial and SLA state (Standards §2C). Nothing else is colored.
4. **Explain, don't hide.** If an action exists in the workflow but can't run now, show it disabled with the reason (§9).
5. **Tenant-neutral components.** No component knows which tenant it renders for. Brand comes only from tokens and the tenant theme file.
6. **Same component, every viewport.** One `ResponsiveDialog`, one `DataTable`; they change shape by breakpoint. No separate mobile pages.
7. **The URL is the state.** Selected record, filters, sort, page and open tab live in the URL.
8. **Accessible by default.** Built on Radix (via Shadcn) so keyboard, focus and ARIA come for free; WCAG 2.2 AA is the floor.

---

## 3. Theming Architecture

### 3.1 Three independent axes

| Axis | Values | Set by | Stored |
|---|---|---|---|
| **Tenant brand** | Per tenant (e.g. Anna Finance indigo) | Tenant admin / platform | Server (`system.tenant_settings.theme`) |
| **Color mode** | `light` · `dark` · `system` | User | `localStorage` + user profile |
| **Density** | `comfortable` · `compact` | User (tenant may set default) | `localStorage` + user profile |

They apply as attributes on `<html>`, so any combination works:

```html
<html data-tenant="anna-finance" class="dark" data-density="compact">
```

### 3.2 Token tiers

```
Tier 1  Primitive   --neutral-50 … --neutral-950, --brand-50 … --brand-950,
                    --green-*, --amber-*, --red-*, --blue-*            (raw values; never used by components)
Tier 2  Semantic    --background, --foreground, --primary, --muted, --border,
                    --success, --warning, --danger, --info …           (what components use)
Tier 3  Component   --sidebar-*, --table-row-hover, --ledger-credit …   (only where a component needs its own knob)
```

Components MUST use only Tier 2 and Tier 3 tokens, through Tailwind utilities (`bg-primary`, `text-muted-foreground`, `border-border`). A lint rule (§14) forbids raw palette utilities such as `bg-indigo-600` or `text-gray-500` in `src/`.

### 3.3 Semantic token set

Values below are the **platform default theme** (light / dark). Tenants override only the tokens marked ✎ (§3.5). Status tokens (`success`, `warning`, `danger`, `info` and their `-subtle` fills) are marked ✎ too: tenants can change them (§15-4).

| Token | Purpose | Light | Dark |
|---|---|---|---|
| `--background` | App canvas | `oklch(0.985 0.002 250)` | `oklch(0.16 0.01 260)` |
| `--foreground` | Body text | `oklch(0.21 0.02 260)` | `oklch(0.96 0.005 250)` |
| `--surface` | Cards, tables, panels | `oklch(1 0 0)` | `oklch(0.20 0.012 260)` |
| `--surface-raised` | Popovers, dialogs, menus | `oklch(1 0 0)` | `oklch(0.24 0.014 260)` |
| `--muted` | Table headers, subtle fills | `oklch(0.967 0.003 250)` | `oklch(0.26 0.012 260)` |
| `--muted-foreground` | Labels, secondary text | `oklch(0.50 0.02 260)` | `oklch(0.70 0.015 255)` |
| `--border` | Dividers, card borders | `oklch(0.92 0.005 250)` | `oklch(0.30 0.012 260)` |
| `--input` | Form control borders | `oklch(0.87 0.008 250)` | `oklch(0.36 0.012 260)` |
| `--ring` ✎ | Focus ring | = `--primary` | = `--primary` |
| `--primary` ✎ | Primary action, active nav | `oklch(0.51 0.23 277)` (indigo) | `oklch(0.66 0.18 277)` |
| `--primary-foreground` ✎ | Text on primary | `oklch(0.98 0.01 277)` | `oklch(0.16 0.03 277)` |
| `--primary-subtle` ✎ | Selected row, active chip | `oklch(0.96 0.03 277)` | `oklch(0.28 0.06 277)` |
| `--accent` ✎ | Secondary brand touch (logo mark, charts series 1) | = `--primary` | = `--primary` |
| `--success` ✎ | Credits, PASSED, VERIFIED, headroom | `oklch(0.55 0.15 150)` | `oklch(0.72 0.16 150)` |
| `--success-subtle` ✎ | Badge/alert fill | `oklch(0.96 0.04 150)` | `oklch(0.28 0.06 150)` |
| `--warning` ✎ | Approaching SLA, AMBER, pending PDD | `oklch(0.62 0.15 70)` | `oklch(0.80 0.15 80)` |
| `--warning-subtle` ✎ | | `oklch(0.97 0.05 85)` | `oklch(0.30 0.06 70)` |
| `--danger` ✎ | Debits, STOP_SUPPLY, overdue, destructive | `oklch(0.55 0.21 25)` | `oklch(0.68 0.19 25)` |
| `--danger-subtle` ✎ | | `oklch(0.96 0.03 25)` | `oklch(0.29 0.07 25)` |
| `--info` ✎ | In-flight workflow states (SANCTIONED, LOGGED_IN) | `oklch(0.55 0.13 240)` | `oklch(0.72 0.12 240)` |
| `--info-subtle` ✎ | | `oklch(0.96 0.025 240)` | `oklch(0.28 0.05 240)` |
| `--sidebar` ✎ | Sidebar background | `oklch(0.21 0.02 260)` | `oklch(0.13 0.01 260)` |
| `--sidebar-foreground` ✎ | Sidebar text | `oklch(0.80 0.01 255)` | `oklch(0.80 0.01 255)` |
| `--sidebar-active` ✎ | Active nav item | = `--primary` | = `--primary` |
| `--radius` ✎ | Base radius | `0.5rem` | `0.5rem` |

Every `*-foreground` / `*-subtle` pair MUST meet 4.5:1 contrast for text and 3:1 for non-text UI (§3.6).

### 3.4 Tailwind v4 mapping (`src/index.css`)

Specified shape; values come from §3.3.

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

:root { /* light defaults, §3.3 */ }
.dark { /* dark defaults, §3.3 */ }
/* Tenant overrides are injected at runtime as a <style id="tenant-theme"> block (§3.5) */

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-surface: var(--surface);
  --color-surface-raised: var(--surface-raised);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary-subtle: var(--primary-subtle);
  --color-success: var(--success);
  --color-success-subtle: var(--success-subtle);
  --color-warning: var(--warning);
  --color-warning-subtle: var(--warning-subtle);
  --color-danger: var(--danger);
  --color-danger-subtle: var(--danger-subtle);
  --color-info: var(--info);
  --color-info-subtle: var(--info-subtle);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-active: var(--sidebar-active);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --font-sans: var(--font-ui), "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-data), "JetBrains Mono", ui-monospace, monospace;
}
```

Shadcn's generated components expect `--card`, `--popover`, `--secondary`, `--destructive`. Alias them to the tokens above (`--card: var(--surface)`, `--popover: var(--surface-raised)`, `--destructive: var(--danger)`, `--secondary: var(--muted)`) instead of adding a second palette.

### 3.5 Tenant theme contract

Each tenant has one theme document. The UI fetches it before first paint.

```jsonc
// GET /api/v1/tenant/theme   (anonymous; tenant resolved from Host, like the rest of the API)
{
  "version": 3,                         // bump to bust caches
  "brand": {
    "name": "Anna Finance",             // product name in sidebar, login, <title>
    "shortName": "AF",                  // avatar / collapsed sidebar
    "logo":      { "light": "https://<assets-host>/tenants/<tenant_id>/logo-light.3f9a.svg",
                   "dark":  "https://<assets-host>/tenants/<tenant_id>/logo-dark.3f9a.svg" },
    "logoMark":  "https://<assets-host>/tenants/<tenant_id>/mark.81c2.svg",   // 32×32, collapsed sidebar
    "favicon":   "https://<assets-host>/tenants/<tenant_id>/favicon.81c2.svg",  // files in Cloudflare R2
    "loginBackground": null             // optional image or null for plain canvas
  },
  "tokens": {
    "light": { "primary": "#4F46E5", "primary-foreground": "#FFFFFF", "sidebar": "#111827" },
    "dark":  { "primary": "#818CF8" }   // any token omitted falls back to platform default
  },
  "radius": "0.5rem",
  "fonts":  { "ui": "Inter", "data": "JetBrains Mono" },   // from an allow-list only
  "defaults": { "density": "comfortable", "colorMode": "system" },
  "terminology": {                      // tenant-specific wording (F2)
    "brokerLedgerName": "Anna Finance balance",
    "brokerCounterpartyCode": "ANNA_FINANCE"
  },
  "supportContact": { "email": "support@annafinance.in", "phone": "+91…" }
}
```

Rules:

- **Storage:** the document lives in `system.tenant_settings.theme` (`JSONB`, nullable; `NULL` = platform default). There is no editing screen for now: themes are changed directly in the database (§10.15).
- **Branding images** (logos, logo mark, favicon, login background) are stored in **Cloudflare R2** and the theme holds their absolute URLs only, never image data.
  - **For now** they are served from the bucket's public development URL, `pub-<id>.r2.dev`, because there is no custom domain yet (decided 30 Oct 2026). `<assets-host>` below means that host. Cloudflare rate-limits `r2.dev` and does not offer caching or WAF on it, so:
    - the UI caches the theme and shows the platform default image if a branding image fails to load (`onerror`), so a throttled image never breaks a screen;
    - when a custom domain is added, bind it to the bucket, update the URLs in each `theme` (bump `version`) and the CSP, and disable the `r2.dev` URL. The keys stay the same, so only the host changes.
  - Keys follow `tenants/<tenant_id>/<name>.<content-hash>.<ext>`. A changed image gets a new key, so files can be cached for a long time (set `Cache-Control: public, max-age=31536000, immutable` as object metadata on upload) and the theme `version` is bumped with the new URL.
  - Allowed types: SVG, PNG, WebP, ICO. The asset host is a separate origin from the app, and images are only ever rendered through `<img>`/`<link rel="icon">`, so script inside an SVG never runs in the app.
  - The UI's CSP `img-src` MUST include `<assets-host>`.
- **Overridable tokens** are only those marked ✎ in §3.3, plus `radius` and fonts from an allow-list. This includes the status tokens (`success`, `warning`, `danger`, `info` and their `-subtle` fills). A tenant that overrides them gives up "red means debit/overdue" across tenants, so the validation in §3.6 keeps the four status hues apart and keeps them distinct from `primary`.
- Hex, `rgb()`, `hsl()` and `oklch()` inputs are accepted; the server stores them as OKLCH.
- `primary-subtle` and `ring` are derived from `primary` if omitted (same hue, lightness 0.96 / chroma ÷ 6 for light; lightness 0.28 for dark).
- A tenant that supplies only a light `primary` gets a dark `primary` computed by raising lightness to 0.66–0.72 until it passes §3.6 on `--background`.
- `brand.name` replaces every hardcoded "RC Limit"/"Anna Finance" string; `terminology` replaces domain labels such as "Anna Finance Balance".

### 3.6 Theme validation (server-side, when served)

Because themes are edited directly in the database, nothing validates them on save. `GET /api/v1/tenant/theme` validates the stored document every time it builds a response (cache the result per `version`). A token that fails is **replaced with the platform default** for that token (and its pair), and a warning naming the tenant, token and failing pair is logged. A document that does not parse falls back to the platform default theme entirely. A bad theme never reaches the browser and never fails the request.

A token passes only if:

| Pair | Minimum |
|---|---|
| `primary-foreground` on `primary` | 4.5 : 1 |
| `primary` on `background` and on `surface` (used as link/text) | 4.5 : 1 |
| `ring` on `background` | 3 : 1 |
| `sidebar-foreground` on `sidebar` | 4.5 : 1 |
| `primary` vs `danger` hue distance | ≥ 30° (a red brand would make primary buttons look destructive) |
| `primary` vs `success` hue distance | ≥ 30° |
| `success`, `warning`, `danger`, `info` on `background` and on `surface` (amounts, icons) | 3 : 1 |
| each status token on its own `-subtle` fill (badge text) | 4.5 : 1 |
| hue distance between any two of `success`, `warning`, `danger`, `info` | ≥ 30° |
| every `brand` image URL | `https://` on `<assets-host>` under `tenants/<that tenant's id>/`; otherwise dropped (the platform default image is used) |

Run the same checks before writing a theme to the database. Until the Tenant settings screen exists (§10.15), use a small script or test that loads a theme JSON, prints pass/fail per pair, and renders nothing else.

### 3.7 Runtime loading (no flash of wrong theme)

1. `index.html` holds an inline script (≤ 1 KB) that runs before React:
   - reads `localStorage['rcl.theme.<host>']` (last theme JSON) and `rcl.colorMode`, `rcl.density`;
   - writes the `<style id="tenant-theme">` block and sets `class="dark"` / `data-density` on `<html>`.
2. `main.tsx` fetches `/api/v1/tenant/theme` in parallel with `loadConfig()`. If `version` differs from the cached one, it replaces the style block and cache.
3. `<title>` and favicon are set from `brand`.
4. If the fetch fails, the cached theme or the platform default is used. The app never blocks on the theme.
5. `colorMode: system` listens to `prefers-color-scheme` changes live.

Theme state is exposed by a `ThemeProvider` (`useTheme()` → `{ brand, colorMode, setColorMode, density, setDensity, terms }`).

### 3.8 Density

`data-density="compact"` changes only spacing tokens:

| Token | Comfortable | Compact |
|---|---|---|
| `--control-h` (button/input height) | 36 px | 32 px |
| `--row-h` (table row) | 44 px | 36 px |
| `--cell-px` | 16 px | 12 px |
| `--card-p` | 20 px | 16 px |
| Body text | 14 px | 13 px |

On coarse pointers, `--control-h` and `--row-h` are forced to 48 px regardless of density (`@media (pointer: coarse)`).

---

## 4. Foundations

### 4.1 Neutral palette

One cool neutral ramp (`--neutral-50…950`, hue ≈ 255). The code today mixes `gray-*` and `slate-*`; only the neutral ramp is used after migration.

### 4.2 Typography

Font families: **Inter** (UI) and **JetBrains Mono** (identifiers), self-hosted as variable WOFF2 with `font-display: swap`. Inter is loaded with `font-feature-settings: "cv11", "ss01"` (single-storey a, open digits) for legibility.

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `text-display` | 28 / 36 | 600 | Metric value on dashboard |
| `text-title` | 20 / 28 | 600 | Page title (one per page) |
| `text-heading` | 16 / 24 | 600 | Card / section heading |
| `text-subheading` | 14 / 20 | 600 | Sub-section, dialog section |
| `text-body` | 14 / 20 | 400 | Default |
| `text-body-strong` | 14 / 20 | 500 | Field values, table primary column |
| `text-label` | 12 / 16 | 500 | Field labels, table headers (sentence case, not uppercase) |
| `text-caption` | 12 / 16 | 400 | Helper text, timestamps |
| `text-micro` | 11 / 14 | 500 | Badge text, sidebar group heading |

Rules:

- Table headers become **sentence case, `text-label`, `text-muted-foreground`**. The current `uppercase tracking-wider` costs width and reads slower in dense tables.
- **All numbers that can be compared** (amounts, counts, days, percentages, dates in tables) MUST use `tabular-nums`. Provide a `.num` utility = `tabular-nums` + `slashed-zero`.
- **Identifiers** (application #, vehicle reg no, agreement #, transaction ID, account no, codes) use `font-mono text-[0.92em]`.
- Amount columns are right-aligned; their headers are right-aligned too.

### 4.3 Spacing

4 px base grid. Allowed steps: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Page gutter: 16 px (`< md`), 24 px (`≥ md`). Gap between cards: 16 px. Inside cards: `--card-p`.

### 4.4 Radius

`--radius` (default 8 px). Buttons/inputs `rounded-md`, cards/dialogs `rounded-lg`, bottom-sheet top `rounded-t-2xl`, badges and avatars `rounded-full`. Tenants may set 0–12 px.

### 4.5 Elevation

| Level | Use | Light | Dark |
|---|---|---|---|
| 0 | Page, table | none, `border` | none, `border` |
| 1 | Card | `border` + `shadow-xs` | `border` only |
| 2 | Dropdown, popover, tooltip | `shadow-md` | `shadow-md` + `border` |
| 3 | Dialog, sheet | `shadow-xl` | `shadow-xl` + `border` |

Dark mode leans on borders and lighter surfaces (`--surface-raised`), not shadows.

### 4.6 Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| `fast` | 120 ms | ease-out | Hover, focus, color change |
| `base` | 200 ms | `cubic-bezier(0.2, 0, 0, 1)` | Dropdowns, tooltips, dialog fade |
| `slow` | 300 ms | same | Sheet slide-up, sidebar drawer, split-pane open |

`prefers-reduced-motion: reduce` turns slides into fades and disables `animate-pulse` (the STOP_SUPPLY badge keeps a static ring instead, §6).

### 4.7 Z-index scale

`z-sticky 10` (sticky table headers, action dock) · `z-header 20` (topbar) · `z-drawer 30/40` (sidebar overlay/drawer) · `z-overlay 50` (dialog/sheet) · `z-toast 60` · `z-tooltip 70`.

### 4.8 Icons

**Lucide React** (the Shadcn default), 16 px in dense UI, 20 px in nav and empty states, `stroke-width 1.75`. Icons next to text are `aria-hidden`; icon-only buttons MUST have `aria-label` and a tooltip.

Sidebar mapping (replaces emoji, F9):

| Item | Icon |
|---|---|
| Dashboard | `LayoutDashboard` |
| Leads | `Inbox` |
| Customers | `Users` |
| Loans | `FileText` |
| RC Limit Ledger | `BookOpenText` |
| Partners | `Handshake` |
| Lenders | `Landmark` |
| Line Item Types | `ListTree` |
| Financial Requirements | `ClipboardList` |
| Users / Roles / Rights | `UserCog` / `ShieldCheck` / `KeyRound` |
| Accounting group | `Calculator`, `NotebookPen`, `Scale`, `Workflow` |
| Settings | `Settings` |
| Logout | `LogOut` |

### 4.9 Breakpoints

Tailwind defaults: `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`.

| Range | Name | Shell | Lists | Dialogs |
|---|---|---|---|---|
| < 768 | Mobile | Topbar + drawer nav + bottom action dock | Stacked cards | Bottom sheet |
| 768–1023 | Tablet | Collapsed icon rail (64 px) | Table, reduced columns | Centered dialog |
| 1024–1279 | Desktop | Full sidebar (240 px) | Table; detail opens full page | Centered dialog |
| ≥ 1280 | Wide | Full sidebar | Master-detail split pane available | Centered dialog / side sheet |

---

## 5. Data Formatting

All formatting lives in one module, `src/lib/format.ts`. Pages MUST NOT construct `Intl.NumberFormat` themselves (F6).

### 5.1 Currency (INR)

| Function | Output | Use |
|---|---|---|
| `formatINR(n)` | `₹15,00,000.00` | Ledger rows, balances, payout figures, anything reconciled |
| `formatINR(n, { whole: true })` | `₹15,00,000` | Lists and summaries where paise are always zero (requested/sanctioned amounts in tables) |
| `formatINRCompact(n)` | `₹15 L`, `₹2.4 Cr`, `₹85 K` | Metric cards and charts only, never in tables or forms; full value in a tooltip |
| `formatSignedINR(n, dir)` | `+ ₹50,000.00` / `− ₹1,200.00` | Ledger single-amount column on mobile |

- Locale `en-IN` (lakh/crore grouping).
- Negative balances: `−₹1,200.00` with U+2212 minus and `text-danger`; never parentheses.
- Zero: `₹0.00`; a missing value: `—` (§5.4), never `₹0` for "not sanctioned".
- Decision on decimals: **ledger and detail screens always show 2 decimals; list screens show whole rupees** unless the column contains a non-zero paise value, in which case the column shows 2 decimals for all rows (alignment).

### 5.2 Dates and times

| Function | Output | Use |
|---|---|---|
| `formatDate(d)` | `30 Oct 2026` | Default everywhere |
| `formatDateTime(d)` | `30 Oct 2026, 14:05` | Comments, audit history (24 h) |
| `formatRelative(d)` | `3 h ago`, `yesterday` | Activity feeds; full date in `title`/tooltip |
| `formatDays(n)` | `42 days` | RC aging, SLA |

Dates in tables use `tabular-nums`. All dates are shown in `Asia/Kolkata` unless the tenant sets another zone.

### 5.3 Other values

| Value | Format |
|---|---|
| Phone | `+91 98765 43210` (display); input via `PhoneInput` |
| Vehicle reg no | `GJ 05 BX 1234` display with thin spaces, mono; stored without spaces |
| Percent | `12.50%` (rates), `68%` (utilization) |
| CIBIL score | integer, with tier badge |
| Enums | Through the status registry (§6) or `humanize(code)` → `USED_CV` → "Used CV". Ad-hoc `.replace(/_/g, ' ')` calls are removed. |

### 5.4 Empty values

A field with no value shows `—` in `text-muted-foreground`. Text meaning "not yet" is explicit: "Not sanctioned", "Not run", "Unassigned". Never `-`, `N/A`, or `null`.

---

## 6. Domain Status Registry

One registry, `src/lib/status.ts`, replaces `badgeVariants.ts` and `TONE_CLASSES` (F7). Each entry: `{ label, tone, icon, attention? }`. The `Badge`, `StatusTile`, row stripes and filter chips all read from it.

Tones: `success` · `warning` · `danger` · `info` · `neutral` · `progress` (brand-tinted, for "moving forward in the workflow").

### 6.1 Loan status

| Code | Label | Tone | Icon |
|---|---|---|---|
| `DOCUMENTS_PENDING` | Documents pending | warning | `FileClock` |
| `LOGGED_IN` | Logged in | progress | `LogIn` |
| `CREDIT_REVIEW` | Credit review | progress | `SearchCheck` |
| `SANCTIONED` | Sanctioned | info | `BadgeCheck` |
| `DISBURSED` | Disbursed | success | `Banknote` |
| `CLOSED` | Closed | neutral | `Archive` |
| `REJECTED` | Rejected | danger | `XCircle` |
| `WITHDRAWN` | Withdrawn | neutral | `Undo2` |

`CLOSED` moves from green to neutral: a closed file needs no attention, and green is kept for good financial state.

### 6.2 Lead status and checks

| Code | Label | Tone | Icon |
|---|---|---|---|
| `NEW` | New | info | `Sparkles` |
| `IN_PROGRESS` | In progress | progress | `Loader` |
| `QUALIFIED` | Qualified | success | `CheckCircle2` |
| `CONVERTED` | Converted | success | `UserCheck` |
| `REJECTED` | Rejected | danger | `XCircle` |
| Check `PASSED` / `VERIFIED` | Passed / Verified | success | `ShieldCheck` |
| Check `FAILED` | Failed | danger | `ShieldX` |
| Check `IN_PROGRESS` / `PENDING` | In progress / Pending | warning | `Clock` |
| Check not run | Not run | neutral | `CircleDashed` |

### 6.3 Risk, RC and ledger

| Code | Label | Tone | Icon | Attention |
|---|---|---|---|---|
| `GREEN` | Green | success | `CircleCheck` | |
| `AMBER` / `WARNING` / `WARNING_ZONE` | Amber / Warning | warning | `TriangleAlert` | |
| `RED` | Red | danger | `OctagonAlert` | |
| `ON_TIME` | On time | success | `Timer` | |
| `OVERDUE` / `OVERDUE_LOCK` | Overdue / Overdue · locked | danger | `TimerOff` | yes |
| `STOP_SUPPLY_LOCKED` / stop-supply flag | Stop supply | danger | `Ban` | **yes (pulse)** |
| `RC_SUBMITTED` | RC submitted | info | `FileCheck2` | |
| `FLAGGED` | Flagged | warning | `Flag` | |
| `SUSPENDED` / `DEFAULTED` | Suspended / Defaulted | danger | `PauseCircle` / `AlertOctagon` | |
| `ACTIVE` | Active | success | `Circle` (filled) | |
| `INACTIVE` | Inactive | neutral | `Circle` | |
| Ledger `CREDIT` | Credit | success | `ArrowDownLeft` | |
| Ledger `DEBIT` | Debit | danger | `ArrowUpRight` | |

`attention: true` badges get a soft pulsing ring (`animate-ping` on a pseudo-element at 40% opacity, 2 s), per Standards §6B. Under reduced motion they get a static 2 px `ring-danger`. At most one pulsing element per viewport section; in tables, pulsing is off and the row gets a 3 px `danger` left stripe instead (a column of pulsing badges is noise).

Unknown codes render as neutral with `humanize(code)` and log a console warning in development.

### 6.4 Utilization thresholds (sub-limit, bank pool)

| Utilization | Tone | Meaning |
|---|---|---|
| < 70% | success | Headroom |
| 70% – < 90% | warning | Approaching ceiling |
| ≥ 90% | danger | At or near ceiling |
| > 100% | danger + `Ban` icon | Over limit |

Today the bar uses 50 / 80. The thresholds are tenant settings, because they're credit policy, not design (§15-3). They are stored as two columns on `system.tenant_settings`, following the existing nullable-`INT` pattern there:

- `sub_limit_warn_pct INT NULL`, `sub_limit_danger_pct INT NULL`. `NULL` means the default of 70 / 90.
- `CHECK` constraints: each between 1 and 100, and `warn < danger` when both are set. Because the values are edited directly in the database, the constraints are the only validation.
- They are not part of the theme document (the theme endpoint is anonymous). The UI reads them as `subLimitWarnPct` / `subLimitDangerPct` from an authenticated tenant-settings response and uses 70 / 90 until that arrives.

---

## 7. Layout

### 7.1 App shell

```
┌──────────────┬──────────────────────────────────────────────────────────┐
│ [Logo] Brand │  ≡  Loans / LN-2026-00412          [⌘K] [bell] [◐] (AV) ▾│ ← Topbar 56px
│              ├──────────────────────────────────────────────────────────┤
│ ■ Dashboard  │                                                          │
│ ■ Leads   12 │   Page content (template, §7.3)                          │
│ ■ Customers  │                                                          │
│ ■ Loans      │                                                          │
│ ■ RC Ledger  │                                                          │
│ ■ Partners   │                                                          │
│ ─ Admin ──── │   (■ = Lucide icon, §4.8)                                │
│   Masters  ▸ │                                                          │
│   Access   ▸ │                                                          │
│              │                                                          │
│ ■ Settings   │                                                          │
│ « Collapse   │                                                          │
└──────────────┴──────────────────────────────────────────────────────────┘
  240px (64px collapsed)
```

**Sidebar**
- Background `--sidebar`; brand logo (from tenant theme) at top, `logoMark` when collapsed.
- Groups: *Workspace* (Dashboard, Leads, Customers, Loans, RC Limit Ledger, Partners), *Accounting* (when enabled), *Administration* with collapsible *Masters* and *Access control*. Group open state persists.
- Items show a count badge where it drives work (e.g. Leads: unassigned or mine-open count) — only when an API provides it.
- Active item: `bg-sidebar-active text-primary-foreground`; hover: 8% white overlay.
- Collapse toggle (desktop) persists in `localStorage`; collapsed rail shows tooltips.
- `< md`: off-canvas drawer, opened from the topbar ☰, closes on navigate, `Esc`, or overlay tap; focus is trapped while open.
- Logout moves into the user menu.

**Topbar** (56 px, `bg-surface border-b`, sticky)
- Left: menu button (`< lg`), breadcrumbs (§7.2).
- Right: command palette trigger (`⌘K` / `Ctrl K`, §11.6), notifications (future), color-mode toggle (light/dark/system), user menu (name, email, roles, density toggle, "Profile", "Log out").
- Avatar shows initials on `--primary-subtle`.

### 7.2 Page titles and breadcrumbs

Each route declares `handle: { title, crumb }` in the router config; the topbar reads them (`useMatches`). Detail crumbs use the record's display key:

- `Loans / LN-2026-00412`
- `Customers / Shree Ganesh Motors`
- `Leads / Ramesh Patel`
- `Administration / Access control / Roles`

`document.title` = `{page} · {brand.name}`. This fixes F10.

### 7.3 Page templates

Every screen uses one of five templates. Templates own spacing and scroll behavior, so pages don't use `h-screen` or `calc(100vh-…)` (F16).

**T1 — List page**

```
Page header:  Title (text-title)  · record count          [Secondary] [+ Primary]
FilterBar:    [🔍 Search…        ] [Status: Sanctioned ✕] [Lender: Chola ✕] [+ Filter] [Saved views ▾]
Table:        sticky header · rows · totals row (optional)
Footer:       1–25 of 412          ‹ 1 2 3 … 17 ›           25 / page ▾
```

**T2 — Master-detail (split pane)** — Leads and Loans at ≥ 1280 px (Standards §4A)

```
┌ List 35% (min 360, max 520) ──┬┬ Detail 65% ─────────────────────────────┐
│ FilterBar                      ││ Record header + actions                 │
│ ▸ Row (selected: primary-subtle││ Tabs: Overview · Ledger · Activity …    │
│   + 3px primary left stripe)   ││ Tab content (scrolls independently)     │
│ ▸ Row                          ││                                         │
│ Footer / pagination            ││                                         │
└────────────────────────────────┴┴─────────────────────────────────────────┘
                        resize handle (drag, ←/→ keys; width persisted)
```

- URL: `/loans?id=<loanId>&status=SANCTIONED` keeps list state and selection together; `/loans/:id` remains the full-page route (deep links, < 1280 px, "Open full page" button `Maximize2`).
- In split mode the list drops to 3–4 columns (key, name, amount, status).
- `↑/↓` move selection, `Enter` focuses detail, `Esc` returns to list.
- Below 1280 px, row click navigates to the full detail page.

**T3 — Detail page** — Customer, Lead, Loan (full page)

```
Back link (‹ Loans)                                   (only < lg; breadcrumbs otherwise)
Record header:  LN-2026-00412  [Sanctioned]            [Reject] [Withdraw] [Disburse ▸]
                Shree Ganesh Motors · GJ 05 BX 1234 · Chola CV
Key metrics strip:  Sanctioned ₹15,00,000 │ AF balance ₹2,40,000 │ RC aging 42 days ⚠ │ PDD due 12 Nov
Tabs: Overview · Ledger (8) · Documents · Activity (5)
Tab content                                            │ Right rail (≥ xl): comments / timeline
```

- Primary action (one) is the rightmost button, `variant=primary`. Destructive actions are `variant=outline-danger` to its left. Further actions go in a `⋯` menu.
- Tabs are in the URL (`?tab=ledger`).

**T4 — Dashboard** — metric row + widget grid (12 columns; widgets declare `span: 4 | 6 | 12`).

**T5 — Settings / master data** — left section nav (240 px) + form or table area, max content width 960 px. Used for Masters, Access control, Tenant settings, Profile.

---

## 8. Component Specifications

Base library: **Shadcn UI** (Radix primitives) generated into `src/components/ui/`. Domain components that compose them live in `src/components/` (e.g. `LedgerTable`, `StatusBadge`, `ActionButton`). Variants are defined with `class-variance-authority`.

### 8.1 Button

| Variant | Look | Use |
|---|---|---|
| `primary` | `bg-primary text-primary-foreground` | The one main action per view (Create Loan, Disburse, Convert to customer, Save) |
| `secondary` | `bg-muted text-foreground` | Common non-primary actions |
| `outline` | `border-input bg-surface` | Cancel, Refresh, Export |
| `ghost` | transparent, hover `bg-muted` | Toolbar and table row actions |
| `danger` | `bg-danger text-white` | Confirm button inside a destructive dialog only |
| `outline-danger` | `border-danger/40 text-danger` | Reject, Withdraw, Reset password on page level |
| `link` | `text-primary underline-offset-4` | Inline navigation |

Sizes: `sm` (28 px), `md` (`--control-h`), `lg` (44 px), `icon` (square `--control-h`). Coarse pointer → min 48 px.

States: hover, `focus-visible` (2 px `ring` + 2 px offset), `active` (scale 0.98), `disabled` (50% opacity, `cursor-not-allowed`, still focusable when it has a disabled-reason tooltip — use `aria-disabled` rather than `disabled`), `loading` (spinner replaces leading icon, label kept, e.g. "Disbursing…", width locked to avoid layout shift).

### 8.2 Form field

`<Field label hint error required>` wraps any control.

- Label above control, `text-label`, required marked with `*` in `text-danger` and `aria-required`.
- Hint under control in `text-caption text-muted-foreground`; error replaces hint, `text-danger`, with `AlertCircle` icon, linked by `aria-describedby`.
- Validation runs on blur and on submit, not on every keystroke (except format masks).
- Optional fields are marked "(optional)" in the label instead of marking required ones when most fields of a form are required.
- Forms use React Hook Form + Zod schemas (one schema per request DTO).
- Layout: one column on mobile; up to 2 columns in dialogs ≥ md; related small fields (Make/Model/Variant) may share a row.

### 8.3 Specialised inputs

| Component | Behavior |
|---|---|
| `CurrencyInput` | `type="text" inputMode="decimal"`, `₹` prefix adornment, live Indian grouping while typing (`15,00,000`), max 2 decimals, no scroll-wheel change, value emitted as number. Optional `max` shows "Exceeds available balance of ₹2,40,000.00" inline (replaces today's debit check message). Optional words helper under the field: "Fifteen lakh rupees" — useful for large amounts, guards against an extra zero. |
| `PercentInput` | `inputMode="decimal"`, `%` suffix, 2 decimals. |
| `IntegerInput` | `inputMode="numeric"`, steppers on desktop (tenure months, EMI due day 1–31). |
| `PhoneInput` | Keep current; restyle with tokens; display grouped `98765 43210`. |
| `RegNoInput` | Uppercases, strips spaces, validates Indian format, mono font. |
| `DatePicker` | Shadcn popover calendar with typed entry (`dd/mm/yyyy`); on mobile uses native `<input type="date">`. Presets for ranges: Today, This week, This month, Last 30 days, This FY. |
| `DateRangePicker` | For ledger/journal filters. |
| `Textarea` | Auto-grow up to 8 rows, counter shown at 80% of `maxLength`. |

### 8.4 Select and Combobox

- **Select** (Radix) for short fixed lists ≤ 10 options (product type, payment mode, entry direction).
- **Combobox** (Command + Popover) for anything record-backed: customer, vehicle, bank pool, partner, staff user. Server-side search after 2 characters, debounced 250 ms, shows secondary line (phone, facility account, utilization), keyboard navigable, "No results for 'x'" + optional "Create customer" action. Fixes F13.
- **Segmented control** for 2–4 mutually exclusive options visible at once (Leads scope: All / Mine; Entry type: Credit / Debit; Convert: New customer / Existing customer).

### 8.5 Checkbox, switch, radio cards

- Checkbox for multi-select lists (roles, rights). Rights checklist groups by module with a group-level tri-state checkbox and a search box.
- Switch for immediate on/off settings (Active, Hide direct customer credits).
- Radio cards for choices that need a description (Convert lead: new vs existing customer), replacing the inline `style={{ borderColor }}` approach.

### 8.6 DataTable

Built on **TanStack Table** headless + Shadcn table markup; keeps the current server-mode contract (`searchValue`, `sortBy`, `sortDir`, paging meta) so `useListState` and `useFetch` stay.

**Column definition additions**

```ts
interface ColumnDef<T> {
  id: string;
  header: string;
  cell?: (row: T) => ReactNode;
  sortKey?: string;
  align?: 'start' | 'end';            // 'end' for amounts
  kind?: 'text' | 'currency' | 'date' | 'id' | 'status' | 'number';  // picks formatter + alignment + font
  priority?: 1 | 2 | 3;               // 1 = always shown; 3 = hidden first on narrow widths
  mobile?: 'title' | 'subtitle' | 'badge' | 'meta' | 'hidden';       // role in card layout
  total?: (rows: T[]) => number;      // footer totals
}
```

**Desktop**
- Sticky header (`bg-muted`), row height `--row-h`, zebra striping off (borders between rows instead; zebra fights selected/attention states).
- Hover `bg-muted/60`; selected `bg-primary-subtle` + 3 px left stripe.
- Clickable rows: the primary column is a real `<a>`/`<Link>` (so middle-click and keyboard work, F18); the whole row is a click target via a stretched link.
- Row actions: `⋯` menu in the last column, visible on hover/focus and always on touch.
- Column visibility menu (persisted per table) and optional column resize.
- Optional multi-select with a bulk action bar (Assign leads, Export).
- Sort indicator: `ArrowUpDown` (unsorted, muted), `ArrowUp` / `ArrowDown`; `aria-sort` on `<th>`.
- Totals row (`font-semibold`, top border 2 px) when any column has `total`.

**Mobile (< 768) — stacked cards** (Standards §5A)

```
┌──────────────────────────────────────────┐
│ Shree Ganesh Motors          [Sanctioned]│  title + badge
│ LN-2026-00412 · GJ 05 BX 1234            │  subtitle (mono ids)
│ Sanctioned  ₹15,00,000   AF bal ₹2,40,000│  meta key-values (2 per row)
│ [View ledger]            [Upload PDD]    │  up to 2 quick actions
└──────────────────────────────────────────┘
```

Cards come from `mobile` roles on columns — no second implementation. The sort control becomes a "Sort: Newest ▾" select above the list; pagination becomes "Load more" with the count.

**States**
- Loading (first load): 8 skeleton rows matching column widths. Refetch: keep rows, show a 2 px indeterminate progress bar under the header, dim rows to 60%.
- Empty (no data at all): illustration-free empty state — icon, "No loans yet", one sentence, primary action ("Create loan").
- Empty (filtered): "No loans match these filters" + "Clear filters".
- Error: inline alert in the table body with "Retry"; header and filters stay usable.

### 8.7 LedgerTable (domain)

One component for loan ledger, RC Limit Ledger and journal entries (F12).

| Column | Notes |
|---|---|
| Date | `formatDate`, tabular |
| Entry | `StatusBadge` CREDIT / DEBIT (icon + color) |
| Counterparty / Particular | Text; particular under counterparty on narrow widths |
| Mode · Bank · Txn ID | Collapsed into one "Reference" cell (`NEFT · HDFC · UTR123…`), full values in a row-expand panel |
| Credit | `text-success`, right-aligned, 2 decimals |
| Debit | `text-danger`, right-aligned, 2 decimals |
| Balance | `text-foreground font-medium`, negative → `text-danger` |

- Footer: totals of Credit and Debit shown, closing balance.
- Optional context columns for cross-loan view (Application #, Customer, Vehicle, Lender).
- Mobile card: date + badge top row; counterparty/particular; signed amount (`+ ₹50,000.00` green / `− ₹1,200.00` red) right-aligned large; balance after, caption.
- Rows for direct customer credits (which don't change the broker balance) render with a `muted` balance cell and an info icon tooltip "Paid straight to the customer; balance unchanged."

### 8.8 FilterBar and filter chips (Standards §4B)

```
[🔍 Search application #, customer, vehicle…   ] [Status: Sanctioned, Disbursed ✕] [Lender: Chola ✕] [+ Filter ▾]   [Clear all]
```

- `+ Filter` opens a menu of filterable fields; picking one opens its editor in a popover (multi-select checklist, combobox, date range, amount range).
- Each active filter becomes a chip `Field: value(s) ✕`; clicking the chip reopens its editor.
- Search is debounced 300 ms; `/` focuses search.
- All filters serialize to the URL (§11.5).
- **Saved views** (later phase): named filter + sort + columns, per user, with tenant-shared defaults ("My open leads", "Overdue RCs").
- On mobile: search full width; chips scroll horizontally; `+ Filter` opens a bottom sheet with all filters.

Filter definitions per screen are listed in §10.

### 8.9 Pagination

Desktop: `1–25 of 412` · `‹ Prev` · page numbers with ellipsis · `Next ›` · page size `10 / 25 / 50 / 100`. Replaces First/Prev/Next/Last text buttons. Mobile: "Load more (25 of 412)".

### 8.10 Card, MetricCard, UtilizationMeter

- **Card**: `bg-surface border rounded-lg`, header (`text-heading` + optional actions), body `--card-p`. No colored card backgrounds except alert cards.
- **MetricCard** (replaces `StatCard`): label (`text-label`), value (`text-display`, tabular; currency via `formatINRCompact` with exact value in tooltip), delta or context line (`text-caption`), optional sparkline, optional link ("View 12 overdue →"). Value color is `foreground`; only the context line or an icon carries tone. (Today the whole number is colored, which turns the dashboard into a rainbow.)
- **Metric strip**: `grid` of MetricCards on ≥ md; horizontal snap carousel (`w-[85vw] snap-center`) on mobile (Standards §5C) with page dots.
- **UtilizationMeter**: label, `₹used / ₹ceiling`, % on the right, 6 px bar with threshold tones from §6.4, `role="meter"` with `aria-valuenow/min/max` and `aria-valuetext="68% of sub-limit used"`. Compact variant (no label) for table cells.

### 8.11 ResponsiveDialog (Dialog ↔ Bottom sheet)

One component (Standards §5B) built on Radix Dialog (desktop) and **Vaul** drawer (mobile). Replaces `Modal.tsx` and the three hand-built overlays (F5).

| | Desktop (≥ md) | Mobile (< md) |
|---|---|---|
| Position | Centered, `max-w-md` / `lg` / `2xl` by `size` | Anchored `bottom-0`, `rounded-t-2xl`, max 92 dvh |
| Handle | — | `h-1.5 w-12 rounded-full bg-muted-foreground/30`, drag to dismiss |
| Header | Title + optional description + close `X` | Same, close button kept for accessibility |
| Body | Scrolls | Scrolls; keeps focused input visible above keyboard (`visualViewport` resize) |
| Footer | Right-aligned: Cancel (outline) · Primary | Full-width stacked buttons, primary on top, sticky, `pb-safe` |

Behavior: focus trap, `Esc` closes, focus returns to the trigger, background scroll locked, `aria-labelledby/-describedby`. If the form is dirty, closing asks "Discard changes?" (§11.4). Server errors show as an alert at the top of the body and the first invalid field is focused.

**Side sheet** variant (right, 480–640 px) for dense editors that benefit from seeing the page behind: Add ledger entry, Lead action panel, Comments.

### 8.12 ConfirmDialog

Replaces `window.confirm` (F4). Title states the action ("Move to credit review?"), body states the consequence in one sentence, buttons use the verb ("Move to credit review" / "Cancel"). Destructive confirms use `danger` and, for irreversible actions on money (e.g. reversing an entry in future), require typing the record key.

### 8.13 Alert / Banner

Inline `Alert` with tone (`info`, `success`, `warning`, `danger`), icon, title, description, optional action. Used for: page-level errors, locked-record banners ("This lead was converted to Shree Ganesh Motors on 12 Oct 2026 · View customer"), and rule explanations. Page banners sit under the record header, full width.

### 8.14 Toast

**Sonner** toasts, bottom-right desktop / top-center mobile, `z-toast`.

- Success: short past tense, auto-dismiss 4 s ("Ledger entry added"). Include "Undo" only where the API supports it.
- Error: persistent until dismissed, shows server message + correlation ID in a "Copy details" action (ties to `docs/rc_limit_errorhandling_correlationid_otel_hateoas.md`).
- Never for validation errors — those stay at the field.

### 8.15 Tooltip, Popover, DropdownMenu

Tooltip: 300 ms delay, `text-caption`, max 280 px, never holds essential-only information on touch (disabled reasons are also given as helper text on mobile, §9). DropdownMenu for overflow actions; destructive items in `text-danger` at the bottom behind a separator.

### 8.16 Tabs

Underline tabs for record sections, with counts (`Ledger 8`). Horizontally scrollable on mobile. In the URL.

### 8.17 Skeleton, Spinner, Progress

Skeletons match the shape of the content they replace. Spinners only inside buttons and small inline areas. Full-page spinners are not used (F16); detail pages show a header + tab skeleton.

### 8.18 EmptyState

Icon (24 px, muted, in a 48 px `bg-muted` circle), title, one-line description, optional primary action. Variants: `no-data`, `no-results`, `no-access` ("You don't have access to this widget. Ask an admin for the *loans.view* right.").

### 8.19 Activity / Comments thread

Replaces `CommentsPanel` styling and the Lead "last comment + modal" pattern.

- Composer at the **bottom** (chat convention), auto-grow textarea, `Ctrl/⌘ Enter` to post, counter near limit.
- Entries: avatar initials, name, relative time (exact on hover), text with preserved line breaks.
- System events (status changes, checks recorded, ledger entries, assignment) interleave as compact one-line timeline items with icon — turns the panel into the record's audit trail. Requires an activity endpoint (agreed, §15-5); until it ships, comments only.
- Placement: right rail on ≥ xl, "Activity" tab below that, bottom sheet on mobile.

### 8.20 StatusTile (Lead checks)

Replaces `ActionTile`/`StatusTile` in LeadDetailPage. A compact card: check name, `StatusBadge`, last run time and by whom, and a split button `Record result ▾` (Manual · Automated · History). Neutral surface; only the badge carries tone (today the whole tile is tinted).

### 8.21 StickyActionDock (mobile)

Standards §5D. On `< md` detail pages, the primary and secondary actions move from the header into `fixed bottom-0 inset-x-0 pb-safe backdrop-blur-md bg-background/80 border-t`. Max 2 buttons + `⋯`. Page content gets bottom padding equal to the dock height.

---

## 9. HATEOAS-Driven Actions

Standards §6B require actions to reflect backend state and explain unavailability. Today the API returns `links` on some resources (Roles, Rights; unwrapped in `useFetch`) and loans return `nextStatuses`; no reason is ever sent.

### 9.1 Response contract (agreed)

The API sends the reason an action is unavailable. Resources that don't send `actions[]` yet will get it later; the UI is built against this contract from the start.

```jsonc
"links": [
  { "rel": "disburse",  "href": "/api/v1/loans/…/disburse", "method": "POST" },
  { "rel": "add-line-item", "href": "…", "method": "POST" }
],
"actions": [   // new: every action the workflow knows about for this state, available or not
  { "rel": "disburse",      "available": true },
  { "rel": "close",         "available": false, "reason": "Close the loan after the RC is received.", "reasonCode": "RC_NOT_RECEIVED" },
  { "rel": "convert",       "available": false, "reason": "Requires a passed RC check.", "reasonCode": "RC_CHECK_REQUIRED" }
]
```

Contract rules:

- `actions[]` lists **every** workflow action for the resource type, whether available or not, so the UI never needs its own list of what could appear.
- `reason` is user-facing text, written per §13. `reasonCode` is a stable machine code the UI can use for icons, analytics, or its own wording.
- If an action has `available: true`, the matching `links` entry gives its `href` and `method`.
- A resource that sends no reason for a blocked action is a backend bug. The UI shows "This action isn't available right now." and logs a warning in development.

**Until a resource sends `actions[]`** (temporary, per resource): if the action is in `links` (or, for loans, in `nextStatuses`), the button is enabled. Any other known action is hidden, as today. `ActionButton` (§9.2) handles both cases, so pages don't change when the backend catches up.

### 9.2 UI rules

| Case | Rendering |
|---|---|
| Available | Normal button |
| Not available, user has the right, reason given | Visible, `aria-disabled`, tooltip with `reason` (desktop); reason as caption under the button group on mobile |
| User lacks the right | Hidden (don't advertise actions people can never take), except on the primary workflow action of a record, which shows disabled with "You don't have permission to convert leads." |
| Action running | Loading state; other workflow actions disabled with no tooltip |

A single `<ActionButton rel="disburse" resource={loan}>` reads availability from the resource so pages don't repeat this logic.

---

## 10. Screen Specifications

Each section lists template, purpose, layout, mobile behavior, states, and the audit fixes it absorbs.

### 10.1 Login

- **Template:** standalone, split layout ≥ lg: left 45% brand panel (`bg-sidebar`, tenant logo, product name, optional `loginBackground`, support contact), right form. Single column centered on mobile.
- **Form:** Email, Password (show/hide toggle `Eye`), "Sign in" primary full width, "Forgot password?" link (when the flow exists). Placeholder is generic `name@company.com` (F2).
- **States:** submitting (button loading), error alert above fields with server message, session-expired banner when redirected ("Your session ended. Sign in again."), tenant not found page for unknown hosts.
- **Theme:** honors the tenant theme and the system color mode before sign-in.

### 10.2 Dashboard

- **Template:** T4.
- **Row 1 — metric strip** (from `LoanStats`): Total loans, Active loans (RC pending), Total sanctioned (`₹2.4 Cr`, exact in tooltip), Stop-supply dealers (attention tone when > 0, links to Customers filtered by stop supply). Carousel on mobile.
- **Row 2:** *RC aging alerts* (span 8) — table sorted by days desc, days column with tone by SLA, row links to loan; shows top 10 + "View all" (to Loans filtered by RC aging). *My leads summary* (span 4) — Assigned / Open / Converted counts as a stacked list with links.
- **Row 3:** *My leads* table (span 12), 10 newest, "View all" → `/leads?scope=mine`.
- **Future widgets** (when APIs exist): bank-pool utilization meters, disbursals this month chart, pending PDD list. Charts follow the dataviz rules: series colors from a categorical palette derived from `--accent`, status colors only for status.
- **Widget chrome:** title, last updated ("Updated 2 min ago"), refresh icon button, `⋯` menu. Error state inside the widget with Retry (keep current behavior). No widgets → EmptyState `no-access`.
- Dashboard refresh on window focus if data is older than 5 minutes.

### 10.3 Leads list

- **Template:** T1; T2 split view ≥ 1280, **on by default** (§15-8).
- **Header:** "Leads" · count · segmented `All | Assigned to me` · primary "Add lead".
- **Filters:** Status (multi), Financial requirement, Source, Assigned to (combobox, includes "Unassigned"), Created (date range), CIBIL check, RC check.
- **Columns:** Applicant (title; phone as secondary line) · Financial requirement · Reference (mono) · Source · Assigned to (avatar + name, "Unassigned" muted) · Checks (two mini badges: CIBIL, RC) · Status · Created (relative, tooltip exact).
- **Bulk:** select rows → "Assign to…" (requires right).
- **Mobile card:** applicant + status; requirement · source; checks; quick actions "Call" (`tel:`), "WhatsApp" (`https://wa.me/`), "Open".
- **Add lead dialog** (size `lg`): Financial requirement (select) first — the dynamic product fields appear below it in a "Requirement details" section. Applicant name; Source + Brought in by; WhatsApp phone + Contact phone (with "Same as WhatsApp" checkbox); Notes. Submit opens the new lead.

### 10.4 Lead detail

- **Template:** T3 (or right pane of T2). Replaces the custom full-height layout (F16).
- **Locked banner** (converted): info alert under header with link to customer; all edit controls read-only.
- **Header:** applicant name (`text-title`), source chip, status badge; secondary line: phone (click-to-call), reference, created date, lead ID (copy button, mono, muted). Actions: primary "Convert to customer" (§9: disabled with reason if not convertible), `⋯` (Edit details, Reassign, Reject).
- **Checks row:** one `StatusTile` per configured action (CIBIL, RC, …) + Lead status tile. 3–4 per row desktop; horizontal snap on mobile.
- **Tabs:**
  - *Overview* — "Assignment & status" card with inline-editing selects that **save on change** with toast + undo (replaces the page-bottom "Save" bar, which separated the control from the save). "Lead information" description list (2–4 columns) including dynamic product fields.
  - *Checks* — history of every action run (from `actionHistory`): time, check, mode, outcome, score, remarks, by whom.
  - *Activity* — comments thread (§8.19) (right rail on ≥ xl instead of a tab).
- **Record result** (side sheet): mode tabs Manual / Automated / History; Manual: Outcome (segmented Pass / Fail / In progress), Score (when the check takes one), Remarks. Automated: shows required fields and their current values, with missing ones flagged; button disabled with reason "Automated checks are not connected yet." (replaces the `alert`).
- **Convert to customer** (dialog `2xl`, or full-screen sheet on mobile) as a **3-step stepper**:
  1. *Customer* — radio cards: New customer (type, sub-limit ceiling via `CurrencyInput`) / Existing customer (suggested matches list with match-reason chips Phone / Vehicle / Name using `info`, `success`, `warning` subtle tones, plus Combobox search).
  2. *Vehicle* — only when the requirement has a vehicle: shows registration, ownership outcome (new / already owned / transfer from X with confirmation checkbox / transfer blocked danger alert), and the conflicts table with a segmented "Keep: Vehicle | Lead" per row.
  3. *Review* — summary of what will be created/linked/transferred; primary "Convert lead".
  Each step validates before Next; the blocked-transfer case disables Next with reason. All current `alert()` validations (F4) become inline step errors.

### 10.5 Customers list

- **Template:** T1.
- **Filters:** Type (Dealer / Retail / …), Risk status, CIBIL tier, Stop supply (yes/no), Utilization band (< 70 / 70–90 / ≥ 90).
- **Columns:** Legal name (trade name as secondary line) · Type · CIBIL (score + tier badge) · Risk · Sub-limit (`UtilizationMeter` compact with `₹used / ₹ceiling` on hover) · Pending RCs (`3 / 5`, warning at limit) · Stop supply (only shown when true: attention badge; empty otherwise — the "OK" green badge on every row today is noise).
- Stop-supply rows get the 3 px danger stripe.
- **Add customer dialog:** Legal name, Trade name (optional), Type (segmented), Phone, Assigned sub-limit (`CurrencyInput` with words helper).

### 10.6 Customer detail

- **Template:** T3.
- **Header:** legal name, trade name; badges: type, risk, stop supply (attention). Actions: "Create loan" (primary, prefilled customer), `⋯` (Edit, Change sub-limit — when available).
- **Metric strip:** Sub-limit (meter, used / ceiling, available headroom in success tone), Pending RCs (`3 of 5`), CIBIL (score + tier), Open loans (count, sum).
- **Tabs:** *Vehicles* (table: Reg no (mono), Make/Model/Variant, Year, Ownership count, RTO status badge, Open loan indicator; row actions Edit; "Add vehicle" button) · *Loans* (this customer's loans; requires a filter on the loans API) · *Leads* (lead history, current table) · *Activity*.
- **Vehicle dialog:** Registration no (`RegNoInput`), Make / Model / Variant, Year of manufacture + Ownership count (`IntegerInput`), Chassis + Engine numbers (mono, uppercase), RTO status.

### 10.7 Loans list

- **Template:** T1; T2 split view ≥ 1280, **opt-in per user** until validated with operators (§15-8).
- **Filters:** Status (multi), Lender, Bank pool, Product type, Partner, Disbursal date range, RC aging (On time / Warning / Overdue), Has open AF balance.
- **Columns:** Application # (mono, link) · Customer · Vehicle (mono) · Lender · Requested · Sanctioned (— when null) · AF balance (label from `terminology`) · Status · RC aging (days with tone; hidden before disbursal) · Disbursed.
- Totals row for Requested / Sanctioned / AF balance over the current filter (needs an aggregate in `meta`, agreed in §15-6; omit until it ships).
- **Create loan** — dialog `lg` on desktop, full-screen sheet on mobile; sections:
  1. *Borrower* — Customer (combobox, shows sub-limit headroom under the selection: "Headroom ₹4,20,000 of ₹20,00,000"), Vehicle (combobox, disabled until customer; inline warning + "Add vehicle" link when the customer has none).
  2. *Facility* — Bank pool (combobox showing pool utilization meter per option), Product type (segmented), Requested amount (`CurrencyInput`; warns when > headroom for Used CV), Lender agreement no (optional).
  3. *Partner & payout* — Partner (optional combobox), Payout / Bonus / Shared (`CurrencyInput` ×3) with live "Total earned" = payout + bonus − shared.
  4. *Remarks* (optional).
  Note kept: "Sanctioned amount, tenure and rate are captured at sanction."

### 10.8 Loan detail

- **Template:** T3 (or right pane of T2).
- **Header:** `LN-…` (mono) + status badge; secondary line: customer (link) · vehicle (mono) · lender · product. Actions from §9: the next forward stage is primary (e.g. "Disburse"), Reject / Withdraw as `outline-danger`, Refresh as icon button, `⋯` overflow.
- **Workflow stepper** under the header: Documents pending → Logged in → Credit review → Sanctioned → Disbursed → Closed, with dates under completed steps (logged in, sanction, disbursal, closed). Rejected / Withdrawn shows the stepper stopped at the last step with a danger/neutral end marker and the reason in an alert.
- **Metric strip:** Sanctioned (or "Not sanctioned"), `{terminology.brokerLedgerName}` balance, Lender disbursed (from credits; warning tone + caption "Differs from sanctioned ₹…" when different), RC aging (days, tone), PDD due (date; warning when < 7 days, danger when past).
- **Tabs:**
  - *Overview* — description list groups: **Terms** (requested, sanctioned, tenure, rate, EMI start/day), **Dates**, **RC & documents** (RC stage badge, aging, post-disbursement document status select — saves on change with toast), **Payout** (equation layout `Payout + Bonus − Shared = Total earned`, neutral surfaces, only the result emphasised; replaces the four colored boxes), **Remarks**.
  - *Ledger* — `LedgerTable` with totals; "Add entry" primary in the tab toolbar (disabled with reason "Ledger entries can be added once the loan is disbursed." before disbursal). On mobile, "Add entry" lives in the StickyActionDock.
  - *Activity* — comments + status history.
- **Dialogs:**
  - *Add ledger entry* (side sheet): Entry type (segmented Credit / Debit with explanatory caption under each), Recipient/Payee (select, label switches with type), Particular type (debit only), Amount (`CurrencyInput` with `max` = balance on debit, live "Balance after: ₹…"), Mode of payment, then a collapsible "Bank reference" group (Bank, Account no, Transaction ID). Customer-credit caption kept.
  - *Sanction*: Sanctioned amount (prefilled from requested, shows sub-limit headroom for Used CV and warns before submit), Tenure (months), Customer rate (%), Sanction date. Shows a computed indicative EMI if the formula is agreed (**§15-7**, deferred: leave it out for now).
  - *Disburse*: Disbursal date, EMI start date (must be ≥ disbursal date; validated), EMI due day (1–31, prefilled from EMI start date's day). Caption kept: "Add the bank's credit as a ledger entry afterwards." After success, offer "Add bank credit now" in the toast.
  - *Reject / Withdraw*: Reason (textarea, required), danger confirm button with the verb.
  - Other stage moves use ConfirmDialog.

### 10.9 RC Limit Ledger

- **Template:** T1 with `LedgerTable` (cross-loan columns).
- **FilterBar:** Customer (combobox), Bank pool, Date range (presets), Balance status (Open / Settled), switch "Hide direct customer credits" with info tooltip. Replaces the five-select form.
- **Summary strip** above the table: Credits shown, Debits shown, Net, Entries — tabular, credit/debit toned.
- Row click opens the loan (split view or page). Application # cell shows the loan status badge as a secondary line (kept).
- Export CSV/XLSX of the current filter (toolbar, outline button) — needs an endpoint (agreed, §15-6; hide until it ships).
- Server-side paging is required at scale; today the endpoint returns all rows.

### 10.10 Partners

T1. Columns: Legal name, Type (Sub-broker / …), Phone, Commission % (tabular), Status. Dialog: Legal name, Type (segmented), Phone, Commission split (`PercentInput`). Future: partner detail with loans sourced and commission ledger.

### 10.11 Masters (Lenders, Line item types, Financial requirements)

- **Template:** T5 with left nav "Masters": Lenders · Line item types · Financial requirements · Document statuses · Disbursed-to options (the last two exist as APIs without screens).
- Simple masters: table with inline Active switch, sort order handle (drag to reorder where `sortOrder` exists), edit in side sheet.
- **Financial requirements builder** (`ProductTypesPage`): side sheet `xl` with sections — Basics (code (mono, auto-uppercased), label, active), *Fields captured* as a reorderable list of rows (label, key, type, required, options for select type) with a live preview of the resulting form on the right (≥ xl), *Checks* (which actions apply).

### 10.12 Access control (Users, Roles, Rights)

- **Template:** T5 with left nav "Access control".
- **Users:** columns Name (+ email secondary), Phone, Roles (chips, max 3 + "+2"), Status, Last sign-in (when available). Row opens side sheet: Profile, Roles (checkbox list with descriptions), Reset password (separate section at the bottom, `outline-danger`, confirm). New user dialog: email, full name, phone, initial password + confirm with strength meter and policy hints from `PasswordPolicy`.
- **Roles:** list + side sheet editor; rights matrix grouped by module with group tri-state checkboxes, search, and a "System role" lock banner for `isSystem` roles.
- **Rights:** read-mostly table grouped by module; create/edit for platform admins only.

### 10.13 Accounting (when re-enabled)

Chart of accounts as an indented tree table (account code mono, type badge, balance right-aligned); Journal entries via `LedgerTable` (journal mode: balanced debit/credit lines per entry, expandable); Balance sheet as a two-column statement with section subtotals, tabular, print stylesheet; Posting rules in T5.

### 10.14 Profile & preferences (new)

User menu → Profile: name, phone, change password; Preferences: color mode (Light / Dark / System radio cards with previews), density (Comfortable / Compact), default landing page.

### 10.15 Tenant settings (deferred)

**Not built for now (decided 30 Oct 2026).** Theme, status colors and utilization thresholds are changed directly in `system.tenant_settings`; §3.6 covers validation. The design below stays as the target for when a screen is wanted.

T5 sections: *Branding* (name, logos light/dark, favicon, primary color picker with hex input, sidebar color, radius slider, font selection), live preview (§3.6) of both modes, contrast results per pair with pass/fail; *Defaults* (density, color mode); *Terminology*; *Thresholds* (utilization warn/danger %, PDD warning days). Save validates server-side; "Reset to platform default".

### 10.16 System pages

404 ("This page doesn't exist" + Go to dashboard), 403 (EmptyState `no-access`, names the missing right — replaces the silent redirect in `RightProtectedRoute`), offline banner (top, warning tone) when `navigator.onLine` is false, app error boundary (message + correlation ID + Reload).

---

## 11. Interaction Patterns

### 11.1 Feedback hierarchy

| Situation | Pattern |
|---|---|
| Field invalid | Inline field error |
| Form submit failed (server) | Alert at top of dialog/form, focus moved to it |
| Action succeeded | Toast |
| Action failed outside a form | Error toast with correlation ID |
| Page data failed to load | Inline alert in place of content + Retry |
| Record state explains something | Persistent banner (locked, rejected, stop supply) |

### 11.2 Saving

- Dialog forms: explicit submit.
- Single-field settings on a record (assignment, lead status, document status): save on change, optimistic, toast with Undo for 5 s, revert + error toast on failure.
- No page-level "Save changes" bars.

### 11.3 Confirmation

Confirm only when an action is hard to reverse or affects money/status: stage changes, reject/withdraw, reset password, deactivate. Don't confirm creating or editing.

### 11.4 Unsaved changes

Dirty dialogs ask before closing; navigation away from a dirty form uses the router blocker with the same dialog.

### 11.5 URL state

List pages serialize `q`, filters, `sort`, `dir`, `page`, `size`, `id` (split selection) and `tab` into the query string (`useListState` reads/writes `URLSearchParams` instead of local state; page size keeps its `localStorage` default). Back/forward restores the view.

### 11.6 Keyboard

| Keys | Action |
|---|---|
| `⌘K` / `Ctrl K` | Command palette: jump to any page, search loans/customers/leads by key or name, run actions ("Create loan", "Toggle dark mode") |
| `/` | Focus list search |
| `g d` · `g l` · `g c` · `g o` | Go to Dashboard · Leads · Customers · Loans |
| `n` | New record on list pages |
| `↑ ↓` `Enter` `Esc` | List navigation in split view |
| `Ctrl/⌘ Enter` | Submit dialog / post comment |
| `?` | Shortcut help |

Shortcuts are disabled while typing in inputs.

### 11.7 Data freshness

Detail pages refetch on window focus when older than 60 s; lists after 5 min. A manual refresh icon button stays on detail headers and widgets. Long-running background updates show a subtle "Updated just now" caption rather than spinners.

---

## 12. Accessibility

Target: **WCAG 2.2 AA**.

- Contrast per §3.6 for every theme; status tones verified in both modes.
- Status never by color alone: icon + label (§6).
- `focus-visible` ring on every interactive element (2 px `--ring`, 2 px offset); never `outline: none` without replacement.
- Clickable rows contain a real link (F18); row action menus reachable by `Tab`.
- Dialogs/sheets trap focus and restore it; drawers too.
- Form controls have visible labels; errors linked with `aria-describedby`; `aria-invalid` on invalid fields.
- Live regions: toasts (`role="status"` / `alert` for errors), table loading (`aria-busy`), result counts after filtering ("24 loans").
- Touch targets per §0.1 / §3.8; 8 px minimum spacing between adjacent targets on touch.
- Respect `prefers-reduced-motion` and `prefers-contrast: more` (increase border contrast, drop subtle fills).
- Zoom to 200% and 320 px width without loss of content (lists become cards, §8.6).
- Language `lang="en-IN"`; amounts read correctly by screen readers (`aria-label="15 lakh rupees"` on compact values).
- Automated checks: `eslint-plugin-jsx-a11y` (or oxlint equivalent rules) and axe in component tests; manual keyboard pass per screen (Appendix A).

---

## 13. Content and Voice

- Sentence case everywhere: buttons, headings, table headers, menu items ("Create loan", not "Create Loan").
- Buttons are verbs with objects: "Add entry", "Disburse loan", "Convert lead". Loading forms use the -ing verb: "Disbursing…".
- Errors say what happened and what to do: "The debit is larger than the Anna Finance balance of ₹2,40,000.00. Lower the amount or add a credit first." Server messages are shown as-is when they're already user-facing; otherwise mapped from `reasonCode`.
- Don't expose codes (`USED_CV`, `ANNA_FINANCE`) — always labels from the registry or masters.
- Domain terms are consistent: *Sub-limit* (not ceiling/limit interchangeably in UI — "ceiling" only in the admin field "Sub-limit ceiling"), *Application #*, *Vehicle reg no*, *Bank pool*, *Line item*, *PDD*, *RC*.
- Tenant-specific names come from `terminology` (§3.5).
- Numbers in copy use the same formatters as tables.

---

## 14. Migration Roadmap

Spec only; this orders the work so each phase ships value and keeps the app working.

| Phase | Scope | Exit criteria |
|---|---|---|
| **1. Foundations** | Tokens + `@theme inline` in `index.css`; Inter/JetBrains Mono; `lib/format.ts`; `lib/status.ts`; Lucide; Shadcn init (`components.json`, `src/components/ui`); lint rule banning raw palette classes (warn) | All 8 `formatCurrency` copies and `badgeVariants.ts` removed; app looks the same in light mode |
| **2. Core components** | Button, Field + inputs (Currency, Percent, Phone, RegNo, Date), Select/Combobox, ResponsiveDialog, ConfirmDialog, Toast, Alert, Tabs, EmptyState, Skeleton, MetricCard, UtilizationMeter | Zero `alert()`/`confirm()`; one dialog implementation |
| **3. Shell** | New sidebar (collapse, groups, icons), topbar (breadcrumbs, user menu, mode toggle), route `handle` titles, 403/404/error pages | Every route has a title and crumb |
| **4. Data views** | DataTable v2 (mobile cards, column meta, URL state), FilterBar + chips, Pagination v2, LedgerTable | Loans, Customers, Leads, RC Ledger on new table; works at 320 px |
| **5. Detail redesigns** | Loan detail (stepper, tabs, side-sheet entry), Lead detail (tiles, convert stepper), Customer detail (tabs) | LeadDetailPage split into sub-components; F15–F17 closed |
| **6. Theming & SaaS** | Dark mode, density, `theme` + threshold columns on `system.tenant_settings`, tenant theme endpoint with serve-time validation + inline boot script, theme check script, `terminology` (Tenant settings screen deferred, §10.15) | Two tenants with different brands render correctly, both modes, AA verified |
| **7. Productivity** | Split view (T2), command palette, keyboard shortcuts, saved views, bulk actions, exports | — |

Lint rule moves from warn to error at the end of phase 5.

Suggested structure:

```
src/
  components/ui/          # Shadcn-generated primitives (button, dialog, drawer, command, table…)
  components/             # Domain composites: StatusBadge, ActionButton, LedgerTable, UtilizationMeter,
                          # FilterBar, ResponsiveDialog, MetricCard, ActivityThread, StickyActionDock
  layouts/                # AppShell, templates (ListPage, SplitPage, DetailPage, SettingsPage)
  lib/                    # format.ts, status.ts, theme.ts (load/apply/validate), cn.ts
  theme/                  # ThemeProvider, boot script source, default theme json
  pages/<area>/<Screen>/  # Screen + its sections when > ~300 lines
```

New dependencies (all MIT): `@radix-ui/*` (via Shadcn), `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`, `vaul`, `cmdk`, `@tanstack/react-table`, `react-hook-form`, `zod`, `@hookform/resolvers`, `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`.

### 14.1 Implementation status (30 Oct 2026)

All seven phases are built on branch `ui-design-system`, not yet verified in a browser. `npm run lint` now fails on raw palette classes (the phase 5 switch to error).

Backend added for the UI:

| Change | Where |
|---|---|
| `theme JSONB`, `sub_limit_warn_pct`, `sub_limit_danger_pct` on `system.tenant_settings` with CHECKs | `rclimit-db/migrations/011_tenant_branding.sql`; default tenant's terminology seeded in `seed/002` |
| `GET /api/v1/tenant/theme` (anonymous, validated when served, §3.6) and `GET /api/v1/tenant/settings` (thresholds) | System module, `TenantUiController`, `TenantThemeValidator` |
| Theme check before a database edit (§3.6) | `THEME_FILE=… dotnet test tests/RCLimit.Modules.System.UnitTests --filter ThemeFileCheck --logger "console;verbosity=detailed"` |
| R2 asset host for brand images | `Branding:AssetHost` in `appsettings.json` (set it to the `pub-….r2.dev` host) |
| Loans list: status set, lender, pool, product, partner, customer, disbursal dates, RC aging, open balance; totals in `meta.totals`; `GET /api/v1/loans/export` (CSV) | `GetLoansQuery`, `LoansController` |
| RC limit ledger: server paging, search, totals; `GET /api/v1/loans/rc-limit-ledger/export` | `GetRcLedgerQuery` |
| Customers list: risk and CIBIL tier sets, stop supply, utilization band (thresholds passed by the UI) | `GetCustomersQuery` |
| Leads list: status and source sets, requirement, assignee (incl. `UNASSIGNED`), created dates | `GetLeadsQuery` |
| Partners list: partner type | `GetPartnersQuery` |

Where the build departs from this spec:

| Spec | Built | Why |
|---|---|---|
| TanStack Table under DataTable | Own table component | v9 has a new API, and the server owns sort and paging, so the library added little |
| Shadcn calendar DatePicker | Native `<input type="date">` everywhere, with range presets in the filter | Typed entry and the OS picker on mobile without a calendar dependency |
| Saved views per user with tenant-shared defaults | Saved on the device (`localStorage`); built-in defaults per list | No API to store views yet |
| Activity endpoint (§15-5) | Not built. Leads show comments + check runs; loans and customers show events derived from the record | Backend work still to do |
| `actions[]` with reasons (§9.1) | Not sent yet. `ActionButton` reads it when present and falls back to links / `nextStatuses` | Backend work still to do; pages won't change when it ships |
| Drag to reorder masters and fields | Move up / move down buttons | Keyboard-accessible without a drag library |
| Column resize | Column visibility only | — |
| axe in component tests | oxlint `jsx-a11y` rules only | No component test setup exists yet |
| CSP `img-src` includes the asset host | No CSP exists in the repo yet | Add when a CSP is introduced |

---

## 15. Open Decisions

| # | Question | Recommendation | Owner |
|---|---|---|---|
| 1 | ~~Will the API return `actions[]` with `available` + `reason` (§9.1)?~~ | **Resolved (30 Oct 2026):** yes. Resources that don't send it yet will get it later; the UI uses the temporary behavior in §9.1 until then. Loan and Lead first. | Backend |
| 2 | ~~Where is the tenant theme stored and who may edit it?~~ | **Resolved (30 Oct 2026):** a `theme JSONB` column on `system.tenant_settings`. No screen for now; it is edited directly in the database, so no new right is needed yet (§10.15). Logos and other branding images are stored in Cloudflare R2, served from the public `r2.dev` URL until a custom domain exists; the theme holds URLs only (§3.5) | Backend / Product |
| 3 | ~~Utilization thresholds 70/90 vs today's 50/80; per tenant?~~ | **Resolved (30 Oct 2026):** per tenant, as columns on `system.tenant_settings`, defaulting to 70/90 (§6.4). Edited in the database | Credit / Product |
| 4 | ~~Are status colors locked for tenants (§3.5)?~~ | **Resolved (30 Oct 2026):** not locked. Tenants can override them in the `theme` document, with the extra checks in §3.6 | Product |
| 5 | ~~Activity endpoint combining comments + domain events per record?~~ | **Resolved (30 Oct 2026):** yes. A read model per Lead, Loan and Customer. The UI shows comments only until it ships | Backend |
| 6 | ~~Aggregates in list `meta` (totals) and export endpoints; server paging for RC Ledger~~ | **Resolved (30 Oct 2026):** yes, for Loans and RC Ledger. The UI leaves out the totals row and export button until they ship | Backend |
| 7 | Indicative EMI in Sanction dialog — formula and whether lenders differ? | **Deferred (30 Oct 2026).** The Sanction dialog ships without an EMI. Revisit when a single agreed formula exists | Product |
| 8 | ~~Is split view (T2) the default at ≥ 1280 or opt-in per user?~~ | **Resolved (30 Oct 2026):** on by default for Leads; opt-in per user for Loans until validated with operators | Design + ops users |
| 9 | ~~Hindi / regional language support?~~ | **Resolved (30 Oct 2026):** not now. Keep all UI strings in one place so it can be added later | Product |

---

## Appendix A — Per-Screen Acceptance Checklist

A screen is done when:

- [ ] Uses one of the templates T1–T5; no `h-screen`/`calc(100vh…)` inside the shell
- [ ] Only semantic token utilities (no raw palette classes)
- [ ] Correct in light, dark, comfortable, compact, and with a second tenant theme
- [ ] Every amount via `lib/format.ts`, tabular, right-aligned in tables
- [ ] Every status via `StatusBadge` (icon + label)
- [ ] Page title + breadcrumb set
- [ ] Loading (skeleton), empty, filtered-empty, error, and no-access states designed
- [ ] Works at 320 px: tables are cards, dialogs are bottom sheets, primary action reachable in the dock
- [ ] Touch targets 48 px on coarse pointers
- [ ] Unavailable actions disabled with reason (§9)
- [ ] No `alert()` / `confirm()`
- [ ] Filters, sort, page, tab and selection in the URL
- [ ] Keyboard-only walkthrough passes (tab order, focus visible, dialogs trap/restore focus, rows open with Enter)
- [ ] axe: no serious/critical violations
- [ ] Copy follows §13 (sentence case, verbs, no raw codes, tenant terminology)
