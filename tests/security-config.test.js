const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const path = require("node:path");

const { isSuperAdminEmail } = require("../services/admin.service");

const root = path.join(__dirname, "..");

test("only explicitly allowlisted emails qualify as super administrators", () => {
  const previous = process.env.SUPER_ADMIN_EMAILS;
  process.env.SUPER_ADMIN_EMAILS = "owner@example.com, second@example.com";
  try {
    assert.equal(isSuperAdminEmail("owner@example.com"), true);
    assert.equal(isSuperAdminEmail("SECOND@example.com"), true);
    assert.equal(isSuperAdminEmail("free@example.com"), false);
    assert.equal(isSuperAdminEmail("family-plus@example.com"), false);
    assert.equal(isSuperAdminEmail(""), false);
  } finally {
    if (previous === undefined) delete process.env.SUPER_ADMIN_EMAILS;
    else process.env.SUPER_ADMIN_EMAILS = previous;
  }
});

test("non-admin markup does not pre-render Super Admin navigation", () => {
  const html = readFileSync(path.join(root, "index.html"), "utf8");
  assert.doesNotMatch(html, /data-view="admin"/);
  assert.doesNotMatch(html, />Super Admin</);
});

test("database migration enforces Free debt limits and service-only audit logs", () => {
  const migration = readFileSync(
    path.join(root, "supabase", "migrations", "20260810171214_enforce_free_debt_limit_and_admin_privileges.sql"),
    "utf8"
  );
  assert.match(migration, /current_debt_count >= 10/);
  assert.match(migration, /before insert on public\.debts/);
  assert.match(migration, /private\.family_owner_of/);
  assert.match(migration, /private\.family_role_of/);
  assert.match(migration, /revoke all on function public\.handle_new_user\(\) from public, anon, authenticated/);
  assert.match(migration, /revoke all on table public\.admin_audit_logs from anon, authenticated, service_role/);
  assert.match(migration, /grant select, insert on table public\.admin_audit_logs to service_role/);
});
