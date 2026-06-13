const express = require("express");

const { createStripeClient } = require("../config/stripe");
const { requireAuth, requirePermission } = require("../middleware/auth");
const {
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  syncSubscription,
  syncUserPlan,
  createCheckoutSession,
  getBillingProfile,
  previewUpgrade,
  upgradeSubscription,
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

// Seul le Owner de la famille peut gérer l'abonnement Stripe
router.post("/checkout", requireAuth, requirePermission("manageBilling"), async (req, res) => {
  const { plan, duration, currency } = req.body || {};
  if (!plan || !duration) return res.status(400).json({ error: "Missing plan or duration." });
  try {
    const result = await createCheckoutSession({
      userId: req.user.id,
      email: req.user.email,
      plan,
      duration,
      currency
    });
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Checkout creation failed:", error.message);
    res.status(500).json({ error: "Checkout creation failed." });
  }
});

router.get("/profile", requireAuth, async (req, res) => {
  try {
    const result = await getBillingProfile(req.user.id);
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Billing profile failed:", error.message);
    res.status(500).json({ error: "Billing profile failed." });
  }
});

router.post("/upgrade/preview", requireAuth, requirePermission("manageBilling"), async (req, res) => {
  const { targetPlan } = req.body || {};
  if (!targetPlan) return res.status(400).json({ error: "Missing target plan." });
  try {
    const result = await previewUpgrade({ userId: req.user.id, targetPlan });
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Upgrade preview failed:", error.message);
    res.status(500).json({ error: "Upgrade preview failed." });
  }
});

router.post("/upgrade", requireAuth, requirePermission("manageBilling"), async (req, res) => {
  const { targetPlan, prorationDate } = req.body || {};
  if (!targetPlan) return res.status(400).json({ error: "Missing target plan." });
  try {
    const result = await upgradeSubscription({
      userId: req.user.id,
      targetPlan,
      prorationDate: Number(prorationDate) || undefined
    });
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Upgrade failed:", error.message);
    res.status(500).json({ error: "Upgrade failed." });
  }
});

// Active ou désactive le renouvellement automatique
router.post("/auto-renew", requireAuth, requirePermission("manageBilling"), async (req, res) => {
  const { autoRenew } = req.body || {};
  try {
    const result = await setAutoRenew(req.user.id, autoRenew !== false);
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Auto-renew update failed:", error.message);
    res.status(500).json({ error: "Auto-renew update failed." });
  }
});

// Résilie immédiatement l'abonnement
router.post("/cancel", requireAuth, requirePermission("manageBilling"), async (req, res) => {
  try {
    const result = await cancelSubscription(req.user.id);
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Cancellation failed:", error.message);
    res.status(500).json({ error: "Cancellation failed." });
  }
});

// Vérifie les achats Stripe d'un utilisateur et met à jour son plan
router.get("/sync/:userId", requireAuth, async (req, res) => {
  const { userId } = req.params;
  if (!isUuid(userId)) {
    return res.status(400).json({ error: "Invalid user id." });
  }
  // Un utilisateur ne peut synchroniser que son propre plan (ou celui de sa famille)
  if (userId !== req.user.id && userId !== req.user.familyOwnerId) {
    return res.status(403).json({ error: "forbidden", action: "manageBilling" });
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
