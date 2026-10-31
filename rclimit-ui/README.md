# RCLimit UI

React 19, Vite 8, Tailwind CSS v4, React Router 7. The design and behaviour follow
[`docs/ui_ux_specification.md`](../docs/ui_ux_specification.md).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :5173, proxying `/api` to :5100. Open `http://anna-finance.localhost:5173`. |
| `npm run build` | Type-check and build to `dist/` |
| `npm run lint` | oxlint (React, TypeScript, jsx-a11y), then fails on any raw Tailwind palette class |

## Where things live

| Path | Contents |
|---|---|
| `src/index.css` | Design tokens (light, dark, density) mapped with `@theme inline`. Screens use only these semantic utilities. |
| `src/lib/format.ts` | Every number, amount, date, phone and registration format. Pages never build `Intl` formatters. |
| `src/lib/status.ts` | Status registry: label, tone and icon for every status code. Render with `StatusBadge`. |
| `src/lib/theme.ts`, `src/theme/` | Tenant theme loading and the `ThemeProvider` (brand, color mode, density, terminology, thresholds). |
| `src/components/ui/` | Primitives on Radix: button, field, select, combobox, dialog/sheet, confirm, toast, tabs, menu… |
| `src/components/` | Domain components: `DataTable`, `FilterBar`, `LedgerTable`, `ActionButton`, `ActivityThread`, metrics, inputs |
| `src/layouts/` | App shell (sidebar, topbar, command palette), page templates, split view |
| `src/pages/<area>/` | Screens |

## Theming

The tenant theme comes from `GET /api/v1/tenant/theme` and is cached in `localStorage`; the inline script in
`index.html` applies the cached theme before React loads. Themes are edited in `system.tenant_settings.theme`;
check one first with the `ThemeFileCheck` test (see the backend README or the spec, §3.6).
