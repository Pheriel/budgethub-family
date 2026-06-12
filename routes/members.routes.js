const express = require("express");

const { requireAuth, requirePermission } = require("../middleware/auth");
const { ASSIGNABLE_ROLES } = require("../services/permissions");
const { inviteMember, removeMember, changeMemberRole } = require("../services/members.service");

const router = express.Router();

const isUuid = (value) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);

router.use(requireAuth);

// Inviter un membre (Owner, Admin)
router.post("/invite", requirePermission("inviteMembers"), async (req, res) => {
  const { email, name, role, lang } = req.body || {};

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email." });
  }
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Invalid name." });
  }

  try {
    const result = await inviteMember({
      inviter: req.user,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      role: ASSIGNABLE_ROLES.includes(role) ? role : "Viewer",
      lang: lang === "fr" ? "fr" : "en"
    });
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Member invite failed:", error.message);
    res.status(500).json({ error: "Member invite failed." });
  }
});

// Retirer un membre (Owner: tous, Admin: Viewer/Editor seulement)
router.delete("/:memberId", requirePermission("removeMembers"), async (req, res) => {
  const { memberId } = req.params;
  if (!isUuid(memberId)) {
    return res.status(400).json({ error: "Invalid member id." });
  }
  try {
    const result = await removeMember({ actor: req.user, memberId });
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Member removal failed:", error.message);
    res.status(500).json({ error: "Member removal failed." });
  }
});

// Changer le rôle d'un membre (Owner uniquement)
router.patch("/:memberId/role", requirePermission("changeRoles"), async (req, res) => {
  const { memberId } = req.params;
  const { role } = req.body || {};
  if (!isUuid(memberId)) {
    return res.status(400).json({ error: "Invalid member id." });
  }
  try {
    const result = await changeMemberRole({ actor: req.user, memberId, role });
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Role change failed:", error.message);
    res.status(500).json({ error: "Role change failed." });
  }
});

module.exports = router;
