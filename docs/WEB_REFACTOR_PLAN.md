# Web refactor plan

## Completed in this PR

1. Protect Free data from automatic startup cleanup and stop seeding example records.
2. Clarify first-run guidance, dashboard hierarchy and navigation without removing business views.
3. Extract an explicit Web API client and add targeted tests.

## Next Web increments before a production release

1. Design a Free-to-cloud import transaction with a preview, explicit consent, stable per-record import IDs, server-side deduplication and a resumable status. Keep browser records until the server confirms every accepted record. Existing Supabase tables and RLS must be checked with a staging tenant first. Do not treat signup or an upgrade as an import.
2. Split `app.js` along tested seams: preferences/storage, router, auth, dashboard, billing and feature renderers. Preserve the existing script order until each module has coverage.
3. Run a staging matrix for signup/confirmation/login/logout/reset, session restoration, CRUD and roles, bilingual/currency/theme states, responsive widths, and Stripe **test mode** checkout, webhooks, upgrades, downgrades and cancellations.
4. Add a recovery/export path for Free records before making any changes to the local storage schema. Review existing fictional data saved by earlier builds with users rather than removing it automatically.

This branch does not modify Supabase schema, Stripe configuration or production data.
