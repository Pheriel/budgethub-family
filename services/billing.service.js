const { createSupabaseAdminClient } = require("../config/supabase");
const { createStripeClient } = require("../config/stripe");
const { stripePrices, priceIdToPlan, validDurations, validCurrencies } = require("../config/billing.prices");

const durationToLabel = { "1m": "1 mois", "3m": "3 mois", "6m": "6 mois", "12m": "1 an" };
const productionUrl = "https://budgethubfamily.com";

function clientUrl() {
  const value = process.env.CLIENT_URL || productionUrl;
  return value.includes("localhost") || value.includes("127.0.0.1") ? productionUrl : value;
}

// Crée une session de paiement Stripe pour un plan, une durée et une devise donnés
async function createCheckoutSession({ userId, email, plan, duration, currency }) {
  const stripe = createStripeClient();
  if (!stripe) return { status: 503, body: { error: "stripe_not_configured" } };

  const priceId = stripePrices[plan] && stripePrices[plan][duration];
  if (!priceId) return { status: 400, body: { error: "invalid_plan_or_duration" } };

  const cur = validCurrencies.includes(currency) ? currency : "cad";
  const appUrl = clientUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: userId,
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    currency: cur,
    subscription_data: { metadata: { plan, duration, app_user_id: userId } },
    success_url: `${appUrl}?checkout=success`,
    cancel_url: `${appUrl}?checkout=cancel`
  });

  return { status: 200, body: { url: session.url } };
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
  const priceId = subscription.items.data[0]?.price?.id;
  const plan = priceIdToPlan[priceId];
  if (!plan) return { updated: false, reason: "unknown_price" };

  const ok = await writeSubscriptionToProfile(userId, subscription, plan);
  return { updated: ok, plan };
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

  const subscription = await stripe.subscriptions.retrieve(completed.subscription);
  const priceId = subscription.items.data[0]?.price?.id;
  const plan = priceIdToPlan[priceId];
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

// Résiliation immédiate de l'abonnement
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

  await stripe.subscriptions.cancel(profile.stripe_subscription_id);

  await supabase.from("profiles").update({
    plan: "free", subscription_status: "canceled", stripe_subscription_id: null,
    cancel_at_period_end: false, current_period_end: null, billing_duration: null,
    plan_updated_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }).eq("id", userId);

  return { status: 200, body: { canceled: true } };
}

module.exports = {
  createCheckoutSession,
  handleCheckoutCompleted,
  syncUserPlan,
  setAutoRenew,
  cancelSubscription,
  durationToLabel
};
