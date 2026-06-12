const express = require("express");

const { createStripeClient } = require("../config/stripe");
const {
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  syncSubscription,
  syncUserPlan,
  createCheckoutSession,
  setAutoRenew,
  cancelSubscription
} = require("../services/billing.service");

const router = express.Router();

const isUuid = (value) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);

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
    } else if (event.type === "invoice.paid") {
      await handleInvoicePaid(event.data.object);
    } else if (event.type === "invoice.payment_failed") {
      await handleInvoicePaymentFailed(event.data.object);
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      await syncSubscription(event.data.object.id);
    }
    res.json({ received: true });
  } catch (error) {
    console.error("Webhook processing failed:", error.message);
    res.status(500).json({ error: "Webhook processing failed." });
  }
});

// Les routes ci-dessous (hors webhook) reçoivent du JSON: ce routeur est monté
// avant express.json() global pour préserver le corps brut du webhook.
router.use(express.json());

// Crée une session de paiement (plan + durée + devise) et renvoie l'URL Stripe
router.post("/checkout", async (req, res) => {
  const { userId, email, plan, duration, currency } = req.body || {};
  if (!isUuid(userId)) return res.status(400).json({ error: "Invalid user id." });
  if (!plan || !duration) return res.status(400).json({ error: "Missing plan or duration." });
  try {
    const result = await createCheckoutSession({ userId, email, plan, duration, currency });
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Checkout creation failed:", error.message);
    res.status(500).json({ error: "Checkout creation failed." });
  }
});

// Active ou désactive le renouvellement automatique
router.post("/auto-renew", async (req, res) => {
  const { userId, autoRenew } = req.body || {};
  if (!isUuid(userId)) return res.status(400).json({ error: "Invalid user id." });
  try {
    const result = await setAutoRenew(userId, autoRenew !== false);
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Auto-renew update failed:", error.message);
    res.status(500).json({ error: "Auto-renew update failed." });
  }
});

// Résilie immédiatement l'abonnement
router.post("/cancel", async (req, res) => {
  const { userId } = req.body || {};
  if (!isUuid(userId)) return res.status(400).json({ error: "Invalid user id." });
  try {
    const result = await cancelSubscription(userId);
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Cancellation failed:", error.message);
    res.status(500).json({ error: "Cancellation failed." });
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
