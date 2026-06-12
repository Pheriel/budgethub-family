const express = require("express");

const { requireAuth } = require("../middleware/auth");
const {
  isSuperAdminEmail,
  searchUsers,
  getUserDetails,
  setPlan,
  extendUser,
  setSuspended
} = require("../services/admin.service");

const router = express.Router();
const isUuid = (value) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);

function requireSuperAdmin(req, res, next) {
  if (!req.user || !isSuperAdminEmail(req.user.email)) {
    return res.status(403).json({ error: "super_admin_only" });
  }
  next();
}

router.use(requireAuth, requireSuperAdmin);

router.get("/me", (req, res) => {
  res.json({ superAdmin: true, email: req.user.email });
});

router.get("/users", async (req, res) => {
  const result = await searchUsers(req.query.q || "");
  res.status(result.status).json(result.body);
});

router.get("/users/:userId", async (req, res) => {
  if (!isUuid(req.params.userId)) return res.status(400).json({ error: "invalid_user_id" });
  const result = await getUserDetails(req.params.userId);
  res.status(result.status).json(result.body);
});

router.post("/users/:userId/plan", async (req, res) => {
  if (!isUuid(req.params.userId)) return res.status(400).json({ error: "invalid_user_id" });
  const result = await setPlan({
    actor: req.user,
    userId: req.params.userId,
    plan: req.body.plan,
    duration: req.body.duration
  });
  res.status(result.status).json(result.body);
});

router.post("/users/:userId/extend", async (req, res) => {
  if (!isUuid(req.params.userId)) return res.status(400).json({ error: "invalid_user_id" });
  const result = await extendUser({
    actor: req.user,
    userId: req.params.userId,
    days: req.body.days
  });
  res.status(result.status).json(result.body);
});

router.post("/users/:userId/suspension", async (req, res) => {
  if (!isUuid(req.params.userId)) return res.status(400).json({ error: "invalid_user_id" });
  const result = await setSuspended({
    actor: req.user,
    userId: req.params.userId,
    suspended: req.body.suspended
  });
  res.status(result.status).json(result.body);
});

module.exports = router;
