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

```bash
$env:SUPABASE_ACCESS_TOKEN="..."
npm run apply:auth-emails
```

The script targets project `nxlmgbrqzugjemhutfkd` by default. Override it with `SUPABASE_PROJECT_REF` if needed.

## Production checks

- Auth Site URL: `https://budgethubfamily.com`
- Redirect allow list includes `https://budgethubfamily.com` and `https://budgethubfamily.com/auth/confirm`
- Signup confirmation email uses `type=email`
- Password reset email uses `type=recovery`
- Email change email uses `type=email_change`
- Invitation email uses `type=invite`
