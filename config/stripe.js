const Stripe = require("stripe");

function createStripeClient() {
  const { STRIPE_SECRET_KEY } = process.env;

  if (!STRIPE_SECRET_KEY) {
    return null;
  }

  return Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2026-02-25.clover"
  });
}

module.exports = {
  createStripeClient
};
