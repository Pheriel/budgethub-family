# Web UX audit — 2026-09-28

## Scope and findings

- Vanilla HTML/CSS/JS served by Express. The frontend remains concentrated in `app.js`; routes use the History API and Supabase stores signed-in financial data.
- Navigation showed seven equally weighted destinations in the top bar. The dashboard repeated revenue and available money in several cards before explaining the next step.
- A first-time Free visitor received fictional records, which were persisted in browser storage. Startup also deleted a set of older financial storage keys without review. These are data integrity risks.
- Free data stays in this browser. Account creation and login load Supabase records without importing local Free records. Earlier copy could suggest cloud backup would follow an upgrade automatically.
- All application backend calls already pass through `authFetch`, but its base URL used `window.location.origin` for production. Exchange rates are an independent third-party request.
- The existing automated suite checks route metadata, auth boundaries and debt limits. It cannot exercise real Supabase credentials, Stripe Checkout or responsive interaction.

## Changes in this branch

- Free starts with an empty workspace in the first Web increment; a follow-up preview correction displays fictional examples only when there is no saved financial data, without persisting them until explicitly chosen. Previously stored `bh_month_demo_*` records still load. Automatic legacy-key deletion was removed.
- A monthly overview surfaces income, recorded spending, available after planned bills and minimum debt payments, remaining debt, and a next action. An in-context checklist guides the first setup. Detailed metrics stay available on demand.
- The top navigation highlights Home, Expenses, Transactions and Debts. More contains Goals, strategy, Family (when available) and account; the drawer mirrors the grouping.
- Free storage limitations and the lack of automatic cloud import are stated in FR/EN.
- `web/api-client.js` defines the local and production API origins and validates application API paths. Anonymous requests return 401 before backend availability is checked.

## Validation and limits

`npm run check` and `npm test` cover syntax, routes, security boundaries and the Web API module. No production credentials, live billing or production data were used. Device layout, auth email delivery, account subscription lifecycle, and authenticated CRUD still need a staging browser and test accounts before release.
