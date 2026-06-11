const express = require("express");

const { createStripeClient } = require("../config/stripe");
const { handleCheckoutCompleted } = require("../services/billing.service");

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

module.exports = router;
