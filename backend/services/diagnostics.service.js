const { createSupabaseAdminClient } = require("../config/supabase");
const { createStripeClient } = require("../config/stripe");

const requiredConfigKeys = [
  "NODE_ENV",
  "PORT",
  "CLIENT_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_SOLO",
  "STRIPE_PRICE_FAMILY",
  "STRIPE_PRICE_FAMILY_PLUS",
  "JWT_SECRET"
];

function hasValue(key) {
  return Boolean(process.env[key] && process.env[key].trim());
}

function getConfigStatus() {
  const variables = requiredConfigKeys.reduce((status, key) => {
    status[key] = hasValue(key);
    return status;
  }, {});

  return {
    success: Object.values(variables).every(Boolean),
    variables
  };
}

async function testSupabaseConnection() {
  if (!hasValue("SUPABASE_URL") || !hasValue("SUPABASE_SERVICE_ROLE_KEY")) {
    return {
      success: false,
      message: "Supabase configuration is incomplete."
    };
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return {
      success: false,
      message: "Supabase admin client could not be initialized."
    };
  }

  try {
    const { error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1
    });

    if (error) {
      return {
        success: false,
        message: "Supabase admin diagnostic failed."
      };
    }

    return {
      success: true,
      message: "Supabase admin diagnostic succeeded."
    };
  } catch (_error) {
    return {
      success: false,
      message: "Supabase diagnostic request failed."
    };
  }
}

async function testStripeConnection() {
  if (!hasValue("STRIPE_SECRET_KEY")) {
    return {
      success: false,
      mode: "unknown",
      message: "Stripe configuration is incomplete."
    };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY.trim();
  const mode = secretKey.startsWith("sk_test_") ? "test" : secretKey.startsWith("sk_live_") ? "live" : "unknown";

  if (mode !== "test") {
    return {
      success: false,
      mode,
      message: "Stripe diagnostic requires a test secret key."
    };
  }

  const stripe = createStripeClient();

  if (!stripe) {
    return {
      success: false,
      mode,
      message: "Stripe client could not be initialized."
    };
  }

  try {
    await stripe.balance.retrieve();

    return {
      success: true,
      mode,
      message: "Stripe test diagnostic succeeded."
    };
  } catch (_error) {
    return {
      success: false,
      mode,
      message: "Stripe diagnostic request failed."
    };
  }
}

module.exports = {
  getConfigStatus,
  testSupabaseConnection,
  testStripeConnection
};
