const planPriceEnv = {
  solo: {
    "1m": "STRIPE_PRICE_SOLO_MONTHLY",
    "3m": "STRIPE_PRICE_SOLO_QUARTERLY",
    "6m": "STRIPE_PRICE_SOLO_SEMIANNUAL",
    "12m": "STRIPE_PRICE_SOLO_YEARLY"
  },
  family: {
    "1m": "STRIPE_PRICE_FAMILY_MONTHLY",
    "3m": "STRIPE_PRICE_FAMILY_QUARTERLY",
    "6m": "STRIPE_PRICE_FAMILY_SEMIANNUAL",
    "12m": "STRIPE_PRICE_FAMILY_YEARLY"
  },
  familyPlus: {
    "1m": "STRIPE_PRICE_FAMILY_PLUS_MONTHLY",
    "3m": "STRIPE_PRICE_FAMILY_PLUS_QUARTERLY",
    "6m": "STRIPE_PRICE_FAMILY_PLUS_SEMIANNUAL",
    "12m": "STRIPE_PRICE_FAMILY_PLUS_YEARLY"
  }
};

const validDurations = ["1m", "3m", "6m", "12m"];
const validCurrencies = ["cad", "usd", "eur"];

function readPriceId(envKey) {
  return (process.env[envKey] || "").trim();
}

function getMissingStripePriceEnv() {
  return Object.values(planPriceEnv)
    .flatMap((durations) => Object.values(durations))
    .filter((envKey) => !readPriceId(envKey));
}

function getStripePrices() {
  return Object.fromEntries(
    Object.entries(planPriceEnv).map(([plan, durations]) => [
      plan,
      Object.fromEntries(
        Object.entries(durations).map(([duration, envKey]) => [duration, readPriceId(envKey)])
      )
    ])
  );
}

function getPriceIdToPlan() {
  const entries = [];
  for (const [plan, durations] of Object.entries(getStripePrices())) {
    for (const priceId of Object.values(durations)) {
      if (priceId) entries.push([priceId, plan]);
    }
  }
  return Object.fromEntries(entries);
}

module.exports = {
  planPriceEnv,
  validDurations,
  validCurrencies,
  getMissingStripePriceEnv,
  getStripePrices,
  getPriceIdToPlan
};
