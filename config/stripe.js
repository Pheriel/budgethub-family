const Stripe = require("stripe");

function createStripeClient() {
  const { STRIPE_SECRET_KEY } = process.env;

  if (!STRIPE_SECRET_KEY) {
    return null;
  }

  return Stripe(STRIPE_SECRET_KEY);
}

module.exports = {
  createStripeClient
};
