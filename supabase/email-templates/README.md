# BudgetHub Family Supabase Auth Emails

Production domain: https://budgethubfamily.com

These templates are bilingual. They render French when Supabase user metadata contains `lang`, `language`, or `locale` set to `fr` or `fr-CA`; otherwise they render English by default.

## Templates

- `confirmation.html`: Confirm sign up
- `recovery.html`: Reset password
- `email_change.html`: Change email address
- `invite.html`: Invite user

## Apply to Supabase

Create a Supabase Management API token, then run:

```powershell
$env:SUPABASE_ACCESS_TOKEN="..."
npm run apply:auth-emails
```

The token can also be placed in `.env` (`SUPABASE_ACCESS_TOKEN=...`) — never commit it. The script targets project `nxlmgbrqzugjemhutfkd` by default. Override it with `SUPABASE_PROJECT_REF` if needed.

Validate the templates without calling the API:

```powershell
node scripts/apply-supabase-auth-emails.js --dry-run
```

## Production checks

- Auth Site URL: `https://budgethubfamily.com`
- Redirect allow list includes `https://budgethubfamily.com` and `https://budgethubfamily.com/auth/confirm`
- All action links (CTA button and fallback text) use `{{ .ConfirmationURL }}` — Supabase builds the verification URL itself; no manually constructed `token_hash`/`type` query strings and no hardcoded confirm/reset/invite URLs.
