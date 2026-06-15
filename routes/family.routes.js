const express = require("express");

const { requireAuth, requirePermission, requireFamilyPlan } = require("../middleware/auth");

const router = express.Router();

const VALID_ITEM_TABLES = new Set(["debts", "budget_categories", "transactions", "goals"]);
const isUuid = (value) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);

router.use(requireAuth);
router.use(requireFamilyPlan);

router.post("/contributions", requirePermission("editData"), async (req, res) => {
  const { itemTable, itemId, memberUserId, amount } = req.body || {};
  if (!VALID_ITEM_TABLES.has(itemTable)) {
    return res.status(400).json({ error: "invalid_item_table" });
  }
  if (!isUuid(itemId) || !isUuid(memberUserId)) {
    return res.status(400).json({ error: "invalid_id" });
  }
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: "invalid_amount" });
  }

  const { data, error } = await req.supabaseAdmin
    .from("item_contributions")
    .insert({
      owner_id: req.user.familyOwnerId,
      item_table: itemTable,
      item_id: itemId,
      member_user_id: memberUserId,
      amount: numericAmount
    })
    .select("id,item_table,item_id,member_user_id,amount,note,paid_on")
    .single();

  if (error) {
    console.error("Contribution insert failed:", error.message);
    return res.status(500).json({ error: "contribution_insert_failed" });
  }

  res.status(200).json({ contribution: data });
});

module.exports = router;
