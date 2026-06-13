const express = require("express");

const { requireAuth } = require("../middleware/auth");
const { isSuperAdminEmail } = require("../services/admin.service");
const {
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
} = require("../services/support.service");

const router = express.Router();
const isUuid = (value) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);

function requireSuperAdmin(req, res, next) {
  if (!req.user || !isSuperAdminEmail(req.user.email)) {
    return res.status(403).json({ error: "super_admin_only" });
  }
  next();
}

router.use(requireAuth);

router.get("/meta", (_req, res) => {
  res.json({ categories: CATEGORIES, priorities: PRIORITIES, statuses: STATUSES });
});

router.get("/tickets", async (req, res) => {
  const result = await listMyTickets(req.user);
  res.status(result.status).json(result.body);
});

router.post("/tickets", async (req, res) => {
  const result = await createTicket({
    user: req.user,
    category: req.body.category,
    subject: req.body.subject,
    message: req.body.message,
    priority: req.body.priority
  });
  res.status(result.status).json(result.body);
});

router.get("/tickets/:ticketId", async (req, res) => {
  if (!isUuid(req.params.ticketId)) return res.status(400).json({ error: "invalid_ticket_id" });
  const result = await getMyTicket(req.user, req.params.ticketId);
  res.status(result.status).json(result.body);
});

router.post("/tickets/:ticketId/replies", async (req, res) => {
  if (!isUuid(req.params.ticketId)) return res.status(400).json({ error: "invalid_ticket_id" });
  const result = await addCustomerReply({
    user: req.user,
    ticketId: req.params.ticketId,
    message: req.body.message
  });
  res.status(result.status).json(result.body);
});

router.get("/admin/tickets", requireSuperAdmin, async (req, res) => {
  const result = await listAdminTickets({
    status: req.query.status,
    category: req.query.category,
    priority: req.query.priority
  });
  res.status(result.status).json(result.body);
});

router.get("/admin/tickets/:ticketId", requireSuperAdmin, async (req, res) => {
  if (!isUuid(req.params.ticketId)) return res.status(400).json({ error: "invalid_ticket_id" });
  const result = await getAdminTicket(req.params.ticketId);
  res.status(result.status).json(result.body);
});

router.post("/admin/tickets/:ticketId/status", requireSuperAdmin, async (req, res) => {
  if (!isUuid(req.params.ticketId)) return res.status(400).json({ error: "invalid_ticket_id" });
  const result = await updateAdminTicket({
    ticketId: req.params.ticketId,
    status: req.body.status
  });
  res.status(result.status).json(result.body);
});

router.post("/admin/tickets/:ticketId/replies", requireSuperAdmin, async (req, res) => {
  if (!isUuid(req.params.ticketId)) return res.status(400).json({ error: "invalid_ticket_id" });
  const result = await addAdminReply({
    ticketId: req.params.ticketId,
    actor: req.user,
    message: req.body.message,
    internal: req.body.internal
  });
  res.status(result.status).json(result.body);
});

module.exports = router;
