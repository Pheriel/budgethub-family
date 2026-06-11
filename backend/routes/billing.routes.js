const express = require("express");

const { createStripeClient } = require("../config/stripe");
const { handleCheckoutCompleted, syncUserPlan } = require("../services/billing.service");

const router = express.Router();

// Stripe exige le corps brut pour vérifier la signature du webhook
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const stripe = createStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return res.status(503).json({ error: "Billing webhook is not configured." });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], webhookSecret);
  } catch (_error) {
    return res.status(400).json({ error: "Invalid webhook signature." });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object);
    }
    res.json({ received: true });
  } catch (error) {
    console.error("Webhook processing failed:", error.message);
    res.status(500).json({ error: "Webhook processing failed." });
  }
});

// Vérifie les achats Stripe d'un utilisateur et met à jour son plan
router.get("/sync/:userId", async (req, res) => {
  const { userId } = req.params;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return res.status(400).json({ error: "Invalid user id." });
  }
  try {
    const result = await syncUserPlan(userId);
    res.json(result);
  } catch (error) {
    console.error("Billing sync failed:", error.message);
    res.status(500).json({ error: "Billing sync failed." });
  }
});

module.exports = router;
