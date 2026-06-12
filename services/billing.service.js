const { createSupabaseAdminClient } = require("../config/supabase");
const { createStripeClient } = require("../config/stripe");
const {
  getMissingStripePriceEnv,
  getPriceIdToPlan,
  getStripePrices,
  validCurrencies,
  isUpgrade
} = require("../config/billing.prices");

const durationToLabel = { "1m": "1 mois", "3m": "3 mois", "6m": "6 mois", "12m": "1 an" };
const knownPlans = ["solo", "family", "familyPlus"];

// Un plan accordé/retiré par le Super Admin (subscription_status admin_granted
// ou admin_free) ne doit pas être écrasé par une resynchronisation Stripe,
// sauf si l'activité Stripe est PLUS RÉCENTE que la décision admin.
function hasAdminOverride(profile) {
  return Boolean(profile && typeof profile.subscription_status === "string"
    && profile.subscription_status.startsWith("admin_"));
}

function adminOverrideBeatsStripe(profile, stripeEpochSeconds) {
  if (!hasAdminOverride(profile)) return false;
  const overrideAt = profile.plan_updated_at ? Date.parse(profile.plan_updated_at) : 0;
  return (stripeEpochSeconds || 0) * 1000 <= overrideAt;
}

async function loadSyncProfile(userId) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("profiles")
    .select("plan,subscription_status,plan_updated_at,stripe_subscription_id")
    .eq("id", userId)
    .maybeSingle();
  return data || null;
}

// Plan d'un abonnement: par price id, sinon par metadata.plan (prix archivés
// ou legacy qui ne sont plus dans les variables d'environnement)
function planFromSubscription(subscription) {
  const priceId = subscription.items.data[0]?.price?.id;
  const plan = getPriceIdToPlan()[priceId];
  if (plan) return plan;
  const metadataPlan = subscription.metadata && subscription.metadata.plan;
  return knownPlans.includes(metadataPlan) ? metadataPlan : null;
}
const planLabels = { free: "Free", solo: "Solo", family: "Family", familyPlus: "Family Plus" };
const productionUrl = "https://budgethubfamily.com";

function clientUrl() {
  const value = process.env.CLIENT_URL || productionUrl;
  return value.includes("localhost") || value.includes("127.0.0.1") ? productionUrl : value;
}

// Crée une session de paiement Stripe pour un plan, une durée et une devise donnés
async function createCheckoutSession({ userId, email, plan, duration, currency }) {
  const stripe = createStripeClient();
  if (!stripe) return { status: 503, body: { error: "stripe_not_configured" } };

  const missingPriceEnv = getMissingStripePriceEnv();
  if (missingPriceEnv.length) {
    return { status: 503, body: { error: "stripe_prices_not_configured", missing: missingPriceEnv } };
  }

  const stripePrices = getStripePrices();
  const priceId = stripePrices[plan] && stripePrices[plan][duration];
  if (!priceId) return { status: 400, body: { error: "invalid_plan_or_duration" } };

  const cur = validCurrencies.includes(currency) ? currency : "cad";
  const appUrl = clientUrl();
  const planName = `${plan} ${durationToLabel[duration] || duration}`.trim();

  // Les Prices contiennent déjà le rabais de durée: Checkout affiche
  // exactement le montant montré sur le site.
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: userId,
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    currency: cur,
    metadata: { plan, duration, app_user_id: userId },
    subscription_data: {
      description: `BudgetHub Family - ${planName}`,
      metadata: { plan, duration, app_user_id: userId }
    },
    custom_text: {
      submit: {
        message: "Refunds may be requested within 7 days after the initial purchase. After 7 days, subscriptions can be canceled before renewal with access kept until the paid period ends."
      }
    },
    allow_promotion_codes: true,
    success_url: `${appUrl}?checkout=success`,
    cancel_url: `${appUrl}?checkout=cancel`
  });

  return { status: 200, body: { url: session.url } };
}

async function loadProfileForBilling(userId) {
  const supabase = createSupabaseAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan,billing_duration,stripe_subscription_id,current_period_end,subscription_status")
    .eq("id", userId)
    .single();
  return profile || null;
}

async function previewUpgrade({ userId, targetPlan }) {
  const stripe = createStripeClient();
  if (!stripe) return { status: 503, body: { error: "stripe_not_configured" } };
  const profile = await loadProfileForBilling(userId);
  if (!profile || !profile.stripe_subscription_id) return { status: 404, body: { error: "no_active_subscription" } };
  const currentPlan = profile.plan || "free";
  const duration = profile.billing_duration;
  if (!isUpgrade(currentPlan, targetPlan)) return { status: 400, body: { error: "upgrade_only" } };
  if (!duration) return { status: 400, body: { error: "missing_billing_duration" } };

  const stripePrices = getStripePrices();
  const newPriceId = stripePrices[targetPlan] && stripePrices[targetPlan][duration];
  if (!newPriceId) return { status: 400, body: { error: "invalid_target_plan" } };

  const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
  const item = subscription.items.data[0];
  if (!item) return { status: 400, body: { error: "missing_subscription_item" } };

  // Même date de proration à l'aperçu et à la confirmation: le montant facturé
  // est exactement celui affiché.
  const prorationDate = Math.floor(Date.now() / 1000);
  const preview = await stripe.invoices.createPreview({
    customer: subscription.customer,
    subscription: subscription.id,
    subscription_details: {
      items: [{ id: item.id, price: newPriceId }],
      proration_behavior: "always_invoice",
      proration_date: prorationDate
    }
  });

  return {
    status: 200,
    body: {
      currentPlan,
      targetPlan,
      duration,
      currency: preview.currency,
      amountDue: preview.amount_due,
      subtotal: preview.subtotal,
      total: preview.total,
      prorationDate,
      currentPlanLabel: planLabels[currentPlan] || currentPlan,
      targetPlanLabel: planLabels[targetPlan] || targetPlan
    }
  };
}

async function upgradeSubscription({ userId, targetPlan, prorationDate }) {
  const stripe = createStripeClient();
  if (!stripe) return { status: 503, body: { error: "stripe_not_configured" } };
  const profile = await loadProfileForBilling(userId);
  if (!profile || !profile.stripe_subscription_id) return { status: 404, body: { error: "no_active_subscription" } };
  const currentPlan = profile.plan || "free";
  const duration = profile.billing_duration;
  if (!isUpgrade(currentPlan, targetPlan)) return { status: 400, body: { error: "upgrade_only" } };
  if (!duration) return { status: 400, body: { error: "missing_billing_duration" } };

  const stripePrices = getStripePrices();
  const newPriceId = stripePrices[targetPlan] && stripePrices[targetPlan][duration];
  if (!newPriceId) return { status: 400, body: { error: "invalid_target_plan" } };

  const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
  const item = subscription.items.data[0];
  if (!item) return { status: 400, body: { error: "missing_subscription_item" } };

  // proration_date renvoyée par l'aperçu (tolérance 1 h), sinon maintenant
  const now = Math.floor(Date.now() / 1000);
  const validProrationDate = Number.isInteger(prorationDate) && prorationDate <= now && now - prorationDate < 3600
    ? prorationDate
    : now;
  const updated = await stripe.subscriptions.update(subscription.id, {
    items: [{ id: item.id, price: newPriceId }],
    proration_behavior: "always_invoice",
    proration_date: validProrationDate,
    payment_behavior: "pending_if_incomplete",
    metadata: { ...subscription.metadata, plan: targetPlan, duration, app_user_id: userId }
  });

  await syncSubscription(updated.id);
  const latestInvoice = updated.latest_invoice
    ? await stripe.invoices.retrieve(typeof updated.latest_invoice === "string" ? updated.latest_invoice : updated.latest_invoice.id)
    : null;

  return {
    status: 200,
    body: {
      upgraded: true,
      plan: targetPlan,
      duration,
      subscriptionStatus: updated.status,
      invoiceUrl: latestInvoice ? latestInvoice.hosted_invoice_url : null,
      paymentStatus: latestInvoice ? latestInvoice.status : null
    }
  };
}

// Lit l'abonnement Stripe et écrit l'état complet dans le profil
async function writeSubscriptionToProfile(userId, subscription, plan) {
  const supabase = createSupabaseAdminClient();
  const item = subscription.items.data[0];
  const periodEnd = item && item.current_period_end
    ? new Date(item.current_period_end * 1000).toISOString()
    : (subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null);
  const duration = subscription.metadata && subscription.metadata.duration;

  const { error } = await supabase
    .from("profiles")
    .update({
      plan,
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_end: periodEnd,
      billing_duration: duration || null,
      plan_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", userId);

  if (error) {
    console.error("Failed to write subscription to profile:", error.message);
    return false;
  }
  return true;
}

async function handleCheckoutCompleted(session) {
  const userId = session.client_reference_id;
  if (!userId) return { updated: false, reason: "missing_client_reference_id" };

  const stripe = createStripeClient();
  const subscription = await stripe.subscriptions.retrieve(session.subscription);
  const plan = planFromSubscription(subscription);
  if (!plan) return { updated: false, reason: "unknown_price" };

  const ok = await writeSubscriptionToProfile(userId, subscription, plan);
  return { updated: ok, plan };
}

async function syncSubscription(subscriptionId) {
  const stripe = createStripeClient();
  if (!stripe || !subscriptionId) return { updated: false, reason: "missing_subscription" };

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata && subscription.metadata.app_user_id;
  if (!userId) return { updated: false, reason: "missing_app_user_id" };

  // Ne pas écraser une décision Super Admin avec un abonnement Stripe plus
  // ancien qu'elle (l'admin a détaché stripe_subscription_id du profil)
  const syncProfile = await loadSyncProfile(userId);
  if (syncProfile && syncProfile.stripe_subscription_id !== subscription.id
    && adminOverrideBeatsStripe(syncProfile, subscription.created)) {
    console.log(`[billing.sync] override admin conservé pour ${userId} (plan=${syncProfile.plan}, statut=${syncProfile.subscription_status}); événement Stripe ${subscription.id} ignoré`);
    return { updated: false, reason: "admin_override" };
  }

  const plan = planFromSubscription(subscription);
  if (!plan) return { updated: false, reason: "unknown_price" };

  if (subscription.status === "canceled") {
    const supabase = createSupabaseAdminClient();
    await supabase.from("profiles").update({
      plan: "free",
      subscription_status: "canceled",
      stripe_subscription_id: null,
      cancel_at_period_end: false,
      current_period_end: null,
      billing_duration: null,
      plan_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq("id", userId);
    return { updated: true, plan: "free" };
  }

  const ok = await writeSubscriptionToProfile(userId, subscription, plan);
  return { updated: ok, plan };
}

async function invoiceSubscriptionId(invoice) {
  return invoice.subscription || invoice.parent?.subscription_details?.subscription || null;
}

async function handleInvoicePaid(invoice) {
  return syncSubscription(await invoiceSubscriptionId(invoice));
}

async function handleInvoicePaymentFailed(invoice) {
  const subscriptionId = await invoiceSubscriptionId(invoice);
  const stripe = createStripeClient();
  const supabase = createSupabaseAdminClient();
  if (!stripe || !supabase || !subscriptionId) return { updated: false, reason: "missing_subscription" };

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata && subscription.metadata.app_user_id;
  if (!userId) return { updated: false, reason: "missing_app_user_id" };

  await supabase.from("profiles").update({
    subscription_status: subscription.status || "past_due",
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString()
  }).eq("id", userId);

  return { updated: true, status: subscription.status };
}

// Fallback quand le webhook n'est pas joignable: cherche l'abonnement le plus récent
async function syncUserPlan(userId) {
  const stripe = createStripeClient();
  if (!stripe) return { updated: false, reason: "stripe_not_configured" };

  const sessions = await stripe.checkout.sessions.list({ limit: 100 });
  const completed = sessions.data
    .filter((s) => s.client_reference_id === userId && s.status === "complete" && s.subscription)
    .sort((a, b) => b.created - a.created)[0];

  if (!completed) return { updated: false, reason: "no_completed_checkout" };

  // Un plan accordé/retiré par le Super Admin gagne sur tout achat Stripe
  // ANTÉRIEUR à la décision; seul un nouvel achat la remplace.
  const syncProfile = await loadSyncProfile(userId);
  if (adminOverrideBeatsStripe(syncProfile, completed.created)) {
    console.log(`[billing.sync] override admin conservé pour ${userId} (plan=${syncProfile.plan}, statut=${syncProfile.subscription_status}); resynchronisation Stripe ignorée`);
    return { updated: false, reason: "admin_override" };
  }

  const subscription = await stripe.subscriptions.retrieve(completed.subscription);
  const plan = planFromSubscription(subscription);
  if (!plan) return { updated: false, reason: "unknown_price" };

  // Si l'abonnement a été résilié et la période est terminée, repasser en free
  if (subscription.status === "canceled") {
    const supabase = createSupabaseAdminClient();
    await supabase.from("profiles").update({
      plan: "free", subscription_status: "canceled", stripe_subscription_id: null,
      cancel_at_period_end: false, updated_at: new Date().toISOString()
    }).eq("id", userId);
    return { updated: true, plan: "free" };
  }

  const ok = await writeSubscriptionToProfile(userId, subscription, plan);
  return { updated: ok, plan };
}

// Active/désactive le renouvellement automatique (résiliation en fin de période)
async function setAutoRenew(userId, autoRenew) {
  const stripe = createStripeClient();
  const supabase = createSupabaseAdminClient();
  if (!stripe) return { status: 503, body: { error: "stripe_not_configured" } };

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_subscription_id")
    .eq("id", userId)
    .single();

  if (!profile || !profile.stripe_subscription_id) {
    return { status: 404, body: { error: "no_active_subscription" } };
  }

  const subscription = await stripe.subscriptions.update(profile.stripe_subscription_id, {
    cancel_at_period_end: !autoRenew
  });

  await supabase
    .from("profiles")
    .update({ cancel_at_period_end: subscription.cancel_at_period_end, updated_at: new Date().toISOString() })
    .eq("id", userId);

  return { status: 200, body: { autoRenew, cancel_at_period_end: subscription.cancel_at_period_end } };
}

// Annule le renouvellement; l'accès reste actif jusqu'à la fin de la période payée
async function cancelSubscription(userId) {
  const stripe = createStripeClient();
  const supabase = createSupabaseAdminClient();
  if (!stripe) return { status: 503, body: { error: "stripe_not_configured" } };

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_subscription_id")
    .eq("id", userId)
    .single();

  if (!profile || !profile.stripe_subscription_id) {
    return { status: 404, body: { error: "no_active_subscription" } };
  }

  const subscription = await stripe.subscriptions.update(profile.stripe_subscription_id, {
    cancel_at_period_end: true
  });

  await supabase.from("profiles").update({
    subscription_status: subscription.status,
    cancel_at_period_end: true,
    updated_at: new Date().toISOString()
  }).eq("id", userId);

  return { status: 200, body: { canceled: true, cancel_at_period_end: true } };
}

module.exports = {
  createCheckoutSession,
  previewUpgrade,
  upgradeSubscription,
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  syncSubscription,
  syncUserPlan,
  setAutoRenew,
  cancelSubscription,
  durationToLabel
};
