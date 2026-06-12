require("dotenv").config();

const fs = require("fs");
const path = require("path");

const projectRef = process.env.SUPABASE_PROJECT_REF || "nxlmgbrqzugjemhutfkd";
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const templateDir = path.join(__dirname, "..", "supabase", "email-templates");
const dryRun = process.argv.includes("--dry-run");

const frCondition = `or (eq .Data.lang "fr") (eq .Data.language "fr") (eq .Data.locale "fr") (eq .Data.locale "fr-CA")`;

function subject(fr, en) {
  return `{{ if ${frCondition} }}${fr}{{ else }}${en}{{ end }}`;
}

function readTemplate(name) {
  return fs.readFileSync(path.join(templateDir, `${name}.html`), "utf8");
}

async function main() {
  const payload = {
    mailer_subjects_confirmation: subject(
      "Bienvenue sur BudgetHub Family – Confirmez votre compte",
      "Welcome to BudgetHub Family – Confirm your account"
    ),
    mailer_templates_confirmation_content: readTemplate("confirmation"),
    mailer_subjects_recovery: subject(
      "Réinitialisation de votre mot de passe BudgetHub Family",
      "Reset your BudgetHub Family password"
    ),
    mailer_templates_recovery_content: readTemplate("recovery"),
    mailer_subjects_email_change: subject(
      "Confirmez votre nouvelle adresse courriel",
      "Confirm your new email address"
    ),
    mailer_templates_email_change_content: readTemplate("email_change"),
    mailer_subjects_invite: subject(
      "Vous avez été invité à rejoindre une famille BudgetHub Family",
      "You've been invited to join a BudgetHub Family account"
    ),
    mailer_templates_invite_content: readTemplate("invite")
  };

  if (dryRun) {
    const templates = {
      confirmation: payload.mailer_templates_confirmation_content,
      recovery: payload.mailer_templates_recovery_content,
      email_change: payload.mailer_templates_email_change_content,
      invite: payload.mailer_templates_invite_content
    };
    const checks = {};
    let hasIssues = false;
    for (const [name, html] of Object.entries(templates)) {
      checks[name] = {
        hasConfirmationURL: html.includes("{{ .ConfirmationURL }}"),
        hasLocalhost: html.includes("localhost") || html.includes("127.0.0.1"),
        hasManualTokenHash: html.includes("token_hash="),
        hasTypeParam: /type=(email|recovery|invite|email_change)/.test(html)
      };
      if (!checks[name].hasConfirmationURL || checks[name].hasLocalhost
        || checks[name].hasManualTokenHash || checks[name].hasTypeParam) {
        hasIssues = true;
      }
    }
    console.log(JSON.stringify({
      projectRef,
      templateCount: Object.keys(templates).length,
      keys: Object.keys(payload),
      checks,
      hasIssues
    }, null, 2));
    if (hasIssues) {
      process.exit(1);
    }
    return;
  }

  if (!accessToken) {
    throw new Error("SUPABASE_ACCESS_TOKEN is required. Create one at https://supabase.com/dashboard/account/tokens.");
  }

  const authConfigUrl = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
  const currentResponse = await fetch(authConfigUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!currentResponse.ok) {
    const body = await currentResponse.text();
    throw new Error(`Could not read Supabase auth config (${currentResponse.status}): ${body}`);
  }

  const currentConfig = await currentResponse.json();
  if (Object.prototype.hasOwnProperty.call(currentConfig, "site_url")) {
    payload.site_url = "https://budgethubfamily.com";
  }
  if (Object.prototype.hasOwnProperty.call(currentConfig, "uri_allow_list")) {
    payload.uri_allow_list = Array.isArray(currentConfig.uri_allow_list)
      ? ["https://budgethubfamily.com", "https://budgethubfamily.com/auth/confirm"]
      : "https://budgethubfamily.com,https://budgethubfamily.com/auth/confirm";
  }

  const response = await fetch(authConfigUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase auth config update failed (${response.status}): ${body}`);
  }

  console.log(`Supabase Auth email templates updated for ${projectRef}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
