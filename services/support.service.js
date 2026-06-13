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
  const userText = `Votre ticket #${ticket.ticket_number} a bien été envoyé à notre support. Nous vous répondrons dans les plus brefs délais.`;
  const results = await Promise.allSettled([
    sendEmail({
      to: ticket.user_email,
      subject: `BudgetHub Family - Ticket #${ticket.ticket_number}`,
      text: `${userText}\n\nSujet: ${ticket.subject}`,
      label: `support-user-created:${ticket.ticket_number}`
    }),
    sendEmail({
      to: supportAdminEmail(),
      subject: `Nouveau ticket ${ticket.ticket_number} - ${ticket.subject}`,
      text: `Nouveau ticket support.\n\nTicket: ${ticket.ticket_number}\nUtilisateur: ${ticket.user_email}\nCatégorie: ${ticket.category}\nPriorité: ${ticket.priority}\n\n${ticket.message}`,
      label: `support-admin-created:${ticket.ticket_number}`
    })
  ]);
  logEmailResult("email support user", ticket.ticket_number, results[0]);
  logEmailResult("email support admin", ticket.ticket_number, results[1]);
}

async function notifyCustomerReply(ticket, reply) {
  const result = await Promise.allSettled([
    sendEmail({
      to: ticket.user_email,
      subject: `BudgetHub Family - Réponse au ticket #${ticket.ticket_number}`,
      text: `Bonjour,\n\nNotre support a répondu à votre ticket #${ticket.ticket_number}.\n\n${reply}\n\nBudgetHub Family`,
      label: `support-user-reply:${ticket.ticket_number}`
    })
  ]);
  logEmailResult("email réponse client", ticket.ticket_number, result[0]);
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
  const { error } = await supabase.from("support_tickets").update({
    status: nextStatus,
    closed_at: nextStatus === "closed" ? new Date().toISOString() : null
  }).eq("id", ticketId);
  if (error) return { status: 500, body: { error: "ticket_update_failed", detail: error.message } };
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
  if (!internal) await notifyCustomerReply({ ticket_number: ticket.number, user_email: ticket.userEmail }, reply);
  return getAdminTicket(ticketId);
}

module.exports = {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  createTicket,
  listMyTickets,
  getMyTicket,
  addCustomerReply,
  listAdminTickets,
  getAdminTicket,
  updateAdminTicket,
  addAdminReply
};
