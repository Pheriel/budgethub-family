require("dotenv").config();

const Stripe = require("stripe");

const dryRun = process.argv.includes("--dry-run");
const appName = "budgethub-family";

const plans = [
  {
    key: "solo",
    name: "BudgetHub Solo",
    envName: "SOLO",
    amounts: { monthly: 1000, quarterly: 3000, semiannual: 6000, yearly: 10000 }
  },
  {
    key: "family",
    name: "BudgetHub Family",
    envName: "FAMILY",
    amounts: { monthly: 1500, quarterly: 4500, semiannual: 9000, yearly: 15000 }
  },
  {
    key: "familyPlus",
    name: "BudgetHub Family Plus",
    envName: "FAMILY_PLUS",
    amounts: { monthly: 2000, quarterly: 6000, semiannual: 12000, yearly: 20000 }
  }
];

const durations = [
  { key: "1m", envSuffix: "MONTHLY", label: "monthly", recurring: { interval: "month", interval_count: 1 } },
  { key: "3m", envSuffix: "QUARTERLY", label: "quarterly", recurring: { interval: "month", interval_count: 3 } },
  { key: "6m", envSuffix: "SEMIANNUAL", label: "semiannual", recurring: { interval: "month", interval_count: 6 } },
  { key: "12m", envSuffix: "YEARLY", label: "yearly", recurring: { interval: "year", interval_count: 1 } }
];

function lookupKey(planKey, durationLabel) {
  return `budgethub_${planKey.toLowerCase()}_${durationLabel}`;
}

function envName(plan, duration) {
  return `STRIPE_PRICE_${plan.envName}_${duration.envSuffix}`;
}

function currencyOptions(amount) {
  return {
    usd: { unit_amount: amount },
    eur: { unit_amount: amount }
  };
}

function priceMatches(price, amount, duration) {
  const options = price.currency_options || {};
  return price.active
    && price.currency === "cad"
    && price.unit_amount === amount
    && price.recurring
    && price.recurring.interval === duration.recurring.interval
    && price.recurring.interval_count === duration.recurring.interval_count
    && options.usd
    && options.usd.unit_amount === amount
    && options.eur
    && options.eur.unit_amount === amount;
}

async function findOrCreateProduct(stripe, plan) {
  const existing = await stripe.products.list({ active: true, limit: 100 });
  const match = existing.data.find((product) => product.metadata && product.metadata.budgethub_plan === plan.key);
  if (match) {
    console.log(`= Product reused: ${plan.name} (${match.id})`);
    return { product: match, action: "reused" };
  }

  if (dryRun) {
    console.log(`+ [dry-run] Product to create: ${plan.name}`);
    return { product: { id: `dry_product_${plan.key}` }, action: "dry-run" };
  }

  const product = await stripe.products.create({
    name: plan.name,
    metadata: { budgethub_plan: plan.key, app: appName }
  });
  console.log(`+ Product created: ${plan.name} (${product.id})`);
  return { product, action: "created" };
}

async function archiveMismatchedPrice(stripe, price, key) {
  if (dryRun) {
    console.log(`! [dry-run] Price would be archived because amount/config is wrong: ${key} (${price.id})`);
    return true;
  }

  try {
    await stripe.prices.update(price.id, {
      active: false,
      lookup_key: `${key}_archived_${Date.now()}`,
      metadata: {
        ...price.metadata,
        budgethub_archived_reason: "replaced_by_correct_live_price"
      }
    });
    console.log(`! Price archived because amount/config was wrong: ${key} (${price.id})`);
    return true;
  } catch (error) {
    console.log(`! Could not free lookup_key ${key}; fallback lookup_key will be used. (${error.message})`);
    return false;
  }
}

async function createPrice(stripe, product, plan, duration, key, amount) {
  const payload = {
    product: product.id,
    nickname: `${plan.name} ${duration.label}`,
    lookup_key: key,
    currency: "cad",
    unit_amount: amount,
    currency_options: currencyOptions(amount),
    recurring: duration.recurring,
    metadata: { budgethub_plan: plan.key, duration: duration.key, app: appName }
  };

  try {
    return await stripe.prices.create(payload);
  } catch (error) {
    if (error.code !== "resource_already_exists") throw error;
    return stripe.prices.create({ ...payload, lookup_key: `${key}_correct` });
  }
}

async function findOrCreatePrice(stripe, product, plan, duration) {
  const key = lookupKey(plan.key, duration.label);
  const amount = plan.amounts[duration.label];
  const found = await stripe.prices.list({
    lookup_keys: [key, `${key}_correct`],
    limit: 10,
    expand: ["data.currency_options"]
  });

  const reusable = found.data.find((price) => priceMatches(price, amount, duration));
  if (reusable) {
    console.log(`= Price reused: ${key} (${reusable.id})`);
    return { price: reusable, action: "reused" };
  }

  const mismatched = found.data.find((price) => price.active);
  if (mismatched) {
    await archiveMismatchedPrice(stripe, mismatched, key);
  }

  if (dryRun) {
    console.log(`+ [dry-run] Price to create: ${key} - ${(amount / 100).toFixed(0)} CAD/USD/EUR`);
    return { price: { id: `dry-run-${key}` }, action: "dry-run" };
  }

  const price = await createPrice(stripe, product, plan, duration, key, amount);
  console.log(`+ Price created: ${key} (${price.id}) - ${(amount / 100).toFixed(0)} CAD/USD/EUR`);
  return { price, action: "created" };
}

async function main() {
  const secretKey = (process.env.STRIPE_SECRET_KEY || "").trim();
  if (!secretKey) {
    console.error("ERROR: STRIPE_SECRET_KEY is missing from .env.");
    process.exit(1);
  }
  if (!secretKey.startsWith("sk_live_")) {
    console.error("ERROR: this script requires a LIVE key (sk_live_...). Refusing to run.");
    process.exit(1);
  }

  const stripe = Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
  console.log(`Mode: LIVE${dryRun ? " (dry-run: no writes)" : ""}\n`);

  const envLines = [];
  const products = [];
  const prices = [];

  for (const plan of plans) {
    const { product, action: productAction } = await findOrCreateProduct(stripe, plan);
    products.push({ name: plan.name, id: product.id, action: productAction });

    for (const duration of durations) {
      const { price, action: priceAction } = await findOrCreatePrice(stripe, product, plan, duration);
      prices.push({
        plan: plan.name,
        duration: duration.label,
        env: envName(plan, duration),
        id: price.id,
        action: priceAction
      });
      envLines.push(`${envName(plan, duration)}=${price.id}`);
    }
  }

  console.log("\n--- Products ---\n");
  for (const product of products) {
    console.log(`${product.action.toUpperCase()} ${product.name}: ${product.id}`);
  }

  console.log("\n--- Prices ---\n");
  for (const price of prices) {
    console.log(`${price.action.toUpperCase()} ${price.env}: ${price.id}`);
  }

  console.log("\n--- Copy these variables into .env and Hostinger ---\n");
  console.log(envLines.join("\n"));
  console.log("\nDone: 3 products, 12 prices (CAD base + USD/EUR currency_options).");
}

main().catch((error) => {
  console.error("Script failed:", error.message);
  process.exit(1);
});
