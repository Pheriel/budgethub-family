const { createSupabaseAdminClient } = require("../config/supabase");
const { sendEmail } = require("./email.service");

const CATEGORIES = [
  "payment_issue",
  "login_issue",
  "subscription_issue",
  "budget_bug",
  "debt_bug",
  "general_question",
  "refund_request",
  "other"
];
const PRIORITIES = ["low", "normal", "high"];
const STATUSES = ["open", "in_progress", "waiting_customer", "closed"];

function normalizeEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function supportAdminEmail() {
  return process.env.SUPPORT_ADMIN_EMAIL || (process.env.SUPER_ADMIN_EMAILS || "").split(",")[0]?.trim() || "";
}

function appBaseUrl() {
  return (process.env.APP_BASE_URL || "https://budgethubfamily.com").replace(/\/+$/, "");
}

// Le routing frontend ne supporte pas encore de lien direct vers un ticket:
// on retombe sur APP_BASE_URL (l'utilisateur ouvre ensuite « Mes tickets »).
function ticketUrl() {
  return appBaseUrl();
}

const CATEGORY_LABELS = {
  payment_issue: { fr: "Problème de paiement", en: "Payment issue" },
  login_issue: { fr: "Problème de connexion", en: "Login issue" },
  subscription_issue: { fr: "Abonnement", en: "Subscription" },
  budget_bug: { fr: "Bogue budget", en: "Budget bug" },
  debt_bug: { fr: "Bogue dettes", en: "Debt bug" },
  general_question: { fr: "Question générale", en: "General question" },
  refund_request: { fr: "Demande de remboursement", en: "Refund request" },
  other: { fr: "Autre", en: "Other" }
};
const STATUS_LABELS = {
  open: { fr: "Ouvert", en: "Open" },
  in_progress: { fr: "En cours", en: "In progress" },
  waiting_customer: { fr: "En attente client", en: "Waiting on customer" },
  closed: { fr: "Fermé", en: "Closed" }
};
const PRIORITY_LABELS = {
  low: { fr: "Basse", en: "Low" },
  normal: { fr: "Normale", en: "Normal" },
  high: { fr: "Haute", en: "High" }
};

function bilabel(map, key) {
  const value = map[key];
  return value ? `${value.fr} / ${value.en}` : String(key || "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BRAND = "#246BFE";

// Template HTML professionnel réutilisable + version texte fallback.
// Retourne { html, text }.
function renderSupportEmailTemplate({ title, intro, ticketNumber, subject, status, category, priority, message, messageLabel, actionLabel, actionUrl }) {
  const metaRow = (label, value) => `
    <tr>
      <td style="padding:6px 0;color:#64748b;font-size:13px;width:42%;">${escapeHtml(label)}</td>
      <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:700;">${escapeHtml(value)}</td>
    </tr>`;
  const rows = [
    subject ? metaRow("Sujet / Subject", subject) : "",
    status ? metaRow("Statut / Status", bilabel(STATUS_LABELS, status)) : "",
    category ? metaRow("Catégorie / Category", bilabel(CATEGORY_LABELS, category)) : "",
    priority ? metaRow("Priorité / Priority", bilabel(PRIORITY_LABELS, priority)) : ""
  ].join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:${BRAND};padding:22px 28px;">
          <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:.2px;">BudgetHub <span style="font-weight:500;opacity:.85;">Family</span></span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 10px;font-size:20px;color:#0f172a;">${escapeHtml(title)}</h1>
          <div style="font-size:14px;line-height:1.6;color:#334155;">${escapeHtml(intro).replace(/\n/g, "<br>")}</div>
          ${ticketNumber ? `<div style="margin:22px 0;padding:16px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;text-align:center;">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Ticket</div>
            <div style="font-size:24px;font-weight:800;color:${BRAND};">#${escapeHtml(ticketNumber)}</div>
          </div>` : ""}
          ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;">${rows}</table>` : ""}
          ${message ? `<div style="margin-top:18px;">
            <div style="font-size:12px;color:#64748b;margin-bottom:6px;">${escapeHtml(messageLabel || "Message")}</div>
            <div style="padding:14px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;font-size:14px;line-height:1.6;">${escapeHtml(message).replace(/\n/g, "<br>")}</div>
          </div>` : ""}
          ${actionUrl ? `<div style="text-align:center;margin:26px 0 6px;">
            <a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 26px;border-radius:10px;">${escapeHtml(actionLabel || "Voir mon ticket")}</a>
          </div>` : ""}
        </td></tr>
        <tr><td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <div style="font-size:12px;color:#64748b;line-height:1.6;">
            <strong style="color:#334155;">BudgetHub Family</strong><br>
            Ceci est un message automatique. Vous pouvez répondre directement à ce courriel si le support le permet.<br>
            This is an automated message. You may reply directly to this email if support allows it.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textLines = [title, "", intro, ""];
  if (ticketNumber) textLines.push(`Ticket: #${ticketNumber}`);
  if (subject) textLines.push(`Sujet / Subject: ${subject}`);
  if (status) textLines.push(`Statut / Status: ${bilabel(STATUS_LABELS, status)}`);
  if (category) textLines.push(`Catégorie / Category: ${bilabel(CATEGORY_LABELS, category)}`);
  if (priority) textLines.push(`Priorité / Priority: ${bilabel(PRIORITY_LABELS, priority)}`);
  if (message) textLines.push("", `${messageLabel || "Message"}:`, message);
  if (actionUrl) textLines.push("", `${actionLabel || "Voir mon ticket"}: ${actionUrl}`);
  textLines.push("", "—", "BudgetHub Family", "Ceci est un message automatique. / This is an automated message.");

  return { html, text: textLines.join("\n") };
}

function publicTicket(row) {
  return {
    id: row.id,
    number: row.ticket_number,
    userId: row.user_id,
    userEmail: row.user_email,
    category: row.category,
    subject: row.subject,
    message: row.message,
    priority: row.priority,
    status: row.status,
    adminReadAt: row.admin_read_at || null,
    customerReadAt: row.customer_read_at || null,
    adminUnread: !row.admin_read_at,
    customerUnread: !row.customer_read_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at
  };
}

function publicMessage(row) {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    authorUserId: row.author_user_id,
    authorEmail: row.author_email,
    authorRole: row.author_role,
    message: row.message,
    isInternal: Boolean(row.is_internal),
    createdAt: row.created_at
  };
}

function logEmailResult(label, ticketNumber, result) {
  if (result.status === "fulfilled") {
    console.log(`[support] ${label} envoyé pour ${ticketNumber}`);
  } else {
    const message = result.reason && result.reason.message ? result.reason.message : result.reason;
    console.error(`[support] ${label} erreur SMTP pour ${ticketNumber}:`, message);
  }
}

async function notifyTicketCreated(ticket) {
  const replyTo = supportAdminEmail() || undefined;
  const userMail = renderSupportEmailTemplate({
    title: "Votre demande a bien été reçue",
    intro: "Bonjour,\nVotre demande a bien été envoyée à notre support. Notre équipe vous répondra dans les plus brefs délais.\n\nHello, your request has been received. Our team will reply as soon as possible.",
    ticketNumber: ticket.ticket_number,
    subject: ticket.subject,
    status: ticket.status || "open",
    category: ticket.category,
    priority: ticket.priority,
    message: ticket.message,
    actionLabel: "Voir mon ticket / View my ticket",
    actionUrl: ticketUrl()
  });
  const adminMail = renderSupportEmailTemplate({
    title: "Nouveau ticket reçu",
    intro: `Nouveau ticket support reçu.\nUtilisateur / User: ${ticket.user_email}\n\nA new support ticket has been received.`,
    ticketNumber: ticket.ticket_number,
    subject: ticket.subject,
    status: ticket.status || "open",
    category: ticket.category,
    priority: ticket.priority,
    message: ticket.message,
    actionLabel: "Ouvrir dans Super Admin / Open in Super Admin",
    actionUrl: appBaseUrl()
  });

  const results = await Promise.allSettled([
    sendEmail({
      to: ticket.user_email,
      replyTo,
      subject: `BudgetHub Family — Ticket #${ticket.ticket_number} reçu`,
      text: userMail.text,
      html: userMail.html,
      label: `support-user-created:${ticket.ticket_number}`
    }),
    sendEmail({
      to: supportAdminEmail(),
      replyTo: ticket.user_email,
      subject: `Nouveau ticket #${ticket.ticket_number} — ${ticket.subject}`,
      text: adminMail.text,
      html: adminMail.html,
      label: `support-admin-created:${ticket.ticket_number}`
    })
  ]);
  logEmailResult("support email user ticket created", ticket.ticket_number, results[0]);
  logEmailResult("support email admin ticket created", ticket.ticket_number, results[1]);
}

async function notifyCustomerReply(ticket, reply, status = "waiting_customer") {
  const replyTo = supportAdminEmail() || undefined;
  const mail = renderSupportEmailTemplate({
    title: "Notre équipe a répondu à votre ticket",
    intro: "Bonjour,\nNotre équipe a répondu à votre ticket.\n\nHello, our team has replied to your ticket.",
    ticketNumber: ticket.ticket_number,
    subject: ticket.subject,
    status,
    category: ticket.category,
    priority: ticket.priority,
    message: reply,
    messageLabel: "Réponse / Reply",
    actionLabel: "Voir mon ticket / View my ticket",
    actionUrl: ticketUrl()
  });
  const result = await Promise.allSettled([
    sendEmail({
      to: ticket.user_email,
      replyTo,
      subject: `BudgetHub Family — Réponse au ticket #${ticket.ticket_number}`,
      text: mail.text,
      html: mail.html,
      label: `support-user-reply:${ticket.ticket_number}`
    })
  ]);
  logEmailResult("support email user reply", ticket.ticket_number, result[0]);
}

function statusChangeIntro(newStatus) {
  switch (newStatus) {
    case "in_progress":
      return "Votre ticket est maintenant en cours de traitement.\n\nYour ticket is now being processed.";
    case "waiting_customer":
      return "Notre équipe attend une réponse de votre part.\n\nOur team is waiting for your reply.";
    case "closed":
      return "Votre ticket a été fermé. Si le problème n'est pas réglé, vous pouvez créer une nouvelle demande ou répondre si le système le permet.\n\nYour ticket has been closed. If the issue is not resolved, you can open a new request or reply if the system allows it.";
    case "open":
      return "Votre ticket a été rouvert.\n\nYour ticket has been reopened.";
    default:
      return "Le statut de votre ticket a été mis à jour.\n\nYour ticket status has been updated.";
  }
}

async function notifyStatusChanged(ticket, oldStatus, newStatus) {
  const replyTo = supportAdminEmail() || undefined;
  const intro = `${statusChangeIntro(newStatus)}\n\n${bilabel(STATUS_LABELS, oldStatus)} → ${bilabel(STATUS_LABELS, newStatus)}`;
  const subjectLine = newStatus === "closed"
    ? `Ticket #${ticket.ticket_number} — Fermé`
    : `Ticket #${ticket.ticket_number} — Statut mis à jour`;
  const mail = renderSupportEmailTemplate({
    title: newStatus === "closed" ? "Votre ticket a été fermé" : "Statut de votre ticket mis à jour",
    intro,
    ticketNumber: ticket.ticket_number,
    subject: ticket.subject,
    status: newStatus,
    category: ticket.category,
    priority: ticket.priority,
    actionLabel: "Voir mon ticket / View my ticket",
    actionUrl: ticketUrl()
  });
  const result = await Promise.allSettled([
    sendEmail({
      to: ticket.user_email,
      replyTo,
      subject: subjectLine,
      text: mail.text,
      html: mail.html,
      label: `support-user-status:${ticket.ticket_number}`
    })
  ]);
  logEmailResult("support email user status changed", ticket.ticket_number, result[0]);
}

async function createTicket({ user, category, subject, message, priority }) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { status: 503, body: { error: "support_unavailable" } };

  const payload = {
    user_id: user.id,
    user_email: user.email,
    category: normalizeEnum(category, CATEGORIES, "other"),
    subject: cleanText(subject, 160),
    message: cleanText(message, 5000),
    priority: normalizeEnum(priority, PRIORITIES, "normal"),
    status: "open",
    admin_read_at: null,
    customer_read_at: new Date().toISOString()
  };
  if (!payload.subject || !payload.message) return { status: 400, body: { error: "missing_subject_or_message" } };

  const { data, error } = await supabase.from("support_tickets").insert(payload).select().single();
  if (error) return { status: 500, body: { error: "ticket_create_failed", detail: error.message } };

  await supabase.from("support_ticket_messages").insert({
    ticket_id: data.id,
    author_user_id: user.id,
    author_email: user.email,
    author_role: "customer",
    message: payload.message,
    is_internal: false
  });
  await notifyTicketCreated(data);
  return { status: 201, body: { ticket: publicTicket(data) } };
}

async function listMyTickets(user) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { status: 503, body: { error: "support_unavailable" } };
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return { status: 500, body: { error: "tickets_list_failed", detail: error.message } };
  const tickets = (data || []).map(publicTicket);
  return { status: 200, body: { tickets, unreadCount: tickets.filter((ticket) => ticket.customerUnread && ticket.status !== "closed").length } };
}

async function getMyTicket(user, ticketId) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { status: 503, body: { error: "support_unavailable" } };
  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return { status: 500, body: { error: "ticket_load_failed", detail: error.message } };
  if (!ticket) return { status: 404, body: { error: "ticket_not_found" } };

  const readAt = new Date().toISOString();
  await supabase.from("support_tickets").update({ customer_read_at: readAt }).eq("id", ticketId).eq("user_id", user.id);
  const { data: messages } = await supabase
    .from("support_ticket_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .eq("is_internal", false)
    .order("created_at", { ascending: true });
  return { status: 200, body: { ticket: publicTicket({ ...ticket, customer_read_at: readAt }), messages: (messages || []).map(publicMessage) } };
}

async function addCustomerReply({ user, ticketId, message }) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { status: 503, body: { error: "support_unavailable" } };
  const reply = cleanText(message, 5000);
  if (!reply) return { status: 400, body: { error: "missing_message" } };
  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (ticketError) return { status: 500, body: { error: "ticket_load_failed", detail: ticketError.message } };
  if (!ticket) return { status: 404, body: { error: "ticket_not_found" } };
  if (ticket.status === "closed") return { status: 400, body: { error: "ticket_closed" } };

  const { error } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticketId,
    author_user_id: user.id,
    author_email: user.email,
    author_role: "customer",
    message: reply,
    is_internal: false
  });
  if (error) return { status: 500, body: { error: "reply_create_failed", detail: error.message } };
  await supabase.from("support_tickets").update({
    status: "open",
    admin_read_at: null,
    customer_read_at: new Date().toISOString()
  }).eq("id", ticketId);
  return getMyTicket(user, ticketId);
}

async function listAdminTickets({ status, category, priority }) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { status: 503, body: { error: "support_unavailable" } };
  let query = supabase.from("support_tickets").select("*");
  if (STATUSES.includes(status)) query = query.eq("status", status);
  if (CATEGORIES.includes(category)) query = query.eq("category", category);
  if (PRIORITIES.includes(priority)) query = query.eq("priority", priority);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
  if (error) return { status: 500, body: { error: "tickets_list_failed", detail: error.message } };
  const tickets = (data || []).map(publicTicket);
  return { status: 200, body: { tickets, openUnreadCount: tickets.filter((ticket) => ticket.status !== "closed" && ticket.adminUnread).length } };
}

async function getAdminTicket(ticketId) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { status: 503, body: { error: "support_unavailable" } };
  const { data: ticket, error } = await supabase.from("support_tickets").select("*").eq("id", ticketId).maybeSingle();
  if (error) return { status: 500, body: { error: "ticket_load_failed", detail: error.message } };
  if (!ticket) return { status: 404, body: { error: "ticket_not_found" } };
  const readAt = new Date().toISOString();
  await supabase.from("support_tickets").update({ admin_read_at: readAt }).eq("id", ticketId);
  const { data: messages } = await supabase
    .from("support_ticket_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  return { status: 200, body: { ticket: publicTicket({ ...ticket, admin_read_at: readAt }), messages: (messages || []).map(publicMessage) } };
}

async function updateAdminTicket({ ticketId, status }) {
  const nextStatus = normalizeEnum(status, STATUSES, "open");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { status: 503, body: { error: "support_unavailable" } };
  const { data: current, error: loadError } = await supabase
    .from("support_tickets").select("*").eq("id", ticketId).maybeSingle();
  if (loadError) return { status: 500, body: { error: "ticket_load_failed", detail: loadError.message } };
  if (!current) return { status: 404, body: { error: "ticket_not_found" } };
  const oldStatus = current.status;
  const statusChanged = oldStatus !== nextStatus;
  const { error } = await supabase.from("support_tickets").update({
    status: nextStatus,
    closed_at: nextStatus === "closed" ? new Date().toISOString() : null,
    // Le changement de statut redevient « non lu » côté client pour signaler la mise à jour.
    customer_read_at: statusChanged ? null : current.customer_read_at
  }).eq("id", ticketId);
  if (error) return { status: 500, body: { error: "ticket_update_failed", detail: error.message } };
  // L'email ne doit jamais faire échouer la mise à jour du ticket.
  if (statusChanged) await notifyStatusChanged(current, oldStatus, nextStatus);
  return getAdminTicket(ticketId);
}

async function addAdminReply({ ticketId, actor, message, internal }) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { status: 503, body: { error: "support_unavailable" } };
  const reply = cleanText(message, 5000);
  if (!reply) return { status: 400, body: { error: "missing_message" } };
  const loaded = await getAdminTicket(ticketId);
  if (loaded.status !== 200) return loaded;
  const { ticket } = loaded.body;
  const { error } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticketId,
    author_user_id: actor.id,
    author_email: actor.email,
    author_role: "admin",
    message: reply,
    is_internal: Boolean(internal)
  });
  if (error) return { status: 500, body: { error: "reply_create_failed", detail: error.message } };
  await supabase.from("support_tickets").update({
    status: internal ? ticket.status : "waiting_customer",
    customer_read_at: internal ? ticket.customerReadAt : null
  }).eq("id", ticketId);
  if (!internal) {
    await notifyCustomerReply({
      ticket_number: ticket.number,
      user_email: ticket.userEmail,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority
    }, reply, "waiting_customer");
  }
  return getAdminTicket(ticketId);
}

module.exports = {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  renderSupportEmailTemplate,
  createTicket,
  listMyTickets,
  getMyTicket,
  addCustomerReply,
  listAdminTickets,
  getAdminTicket,
  updateAdminTicket,
  addAdminReply
};
