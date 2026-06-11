const { createSupabaseAdminClient } = require("../config/supabase");
const { createStripeClient } = require("../config/stripe");

const priceToPlan = () => ({
  [process.env.STRIPE_PRICE_SOLO]: "solo",
  [process.env.STRIPE_PRICE_FAMILY]: "family",
  [process.env.STRIPE_PRICE_FAMILY_PLUS]: "familyPlus"
});

async function handleCheckoutCompleted(session) {
  const userId = session.client_reference_id;

  if (!userId) {
    console.warn("Checkout completed without client_reference_id, cannot link to a user.");
    return { updated: false, reason: "missing_client_reference_id" };
  }

  const stripe = createStripeClient();
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
  const priceId = lineItems.data[0]?.price?.id;
  const plan = priceToPlan()[priceId];

  if (!plan) {
    console.warn("Checkout completed with unknown price id, profile not updated.");
    return { updated: false, reason: "unknown_price" };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      plan,
      stripe_customer_id: session.customer || null,
      plan_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", userId);

  if (error) {
    console.error("Failed to update profile plan:", error.message);
    return { updated: false, reason: "supabase_error" };
  }

  return { updated: true, plan };
}

// Cherche les achats récents d'un utilisateur (fallback quand le webhook n'est pas joignable)
async function syncUserPlan(userId) {
  const stripe = createStripeClient();
  if (!stripe) return { updated: false, reason: "stripe_not_configured" };

  const sessions = await stripe.checkout.sessions.list({ limit: 100 });
  const completed = sessions.data.find(
    (session) => session.client_reference_id === userId && session.status === "complete"
  );

  if (!completed) return { updated: false, reason: "no_completed_checkout" };

  return handleCheckoutCompleted(completed);
}

module.exports = { handleCheckoutCompleted, syncUserPlan };
