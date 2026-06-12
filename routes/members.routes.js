const express = require("express");

const { inviteMember } = require("../services/members.service");

const router = express.Router();

router.post("/invite", async (req, res) => {
  const { inviterId, email, name, role, lang } = req.body || {};

  if (!inviterId || !/^[0-9a-f-]{36}$/i.test(inviterId)) {
    return res.status(400).json({ error: "Invalid inviter id." });
  }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email." });
  }
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Invalid name." });
  }

  try {
    const result = await inviteMember({
      inviterId,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      role: ["Admin", "Parent", "Viewer"].includes(role) ? role : "Viewer",
      lang: lang === "fr" ? "fr" : "en"
    });
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Member invite failed:", error.message);
    res.status(500).json({ error: "Member invite failed." });
  }
});

module.exports = router;
