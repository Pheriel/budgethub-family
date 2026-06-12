// Prix Stripe par plan et durée. Chaque prix a des options multi-devises
// (cad/usd/eur au même montant), donc une seule entrée par plan+durée.
// Montant = prix mensuel de base × nombre de mois, facturé sur la période.
const stripePrices = {
  solo: {
    "1m": "price_1ThSUKLtal3R1c9f9AQISED8",
    "3m": "price_1ThSUKLtal3R1c9faUaKqn2n",
    "6m": "price_1ThSUKLtal3R1c9fvNLSY1T1",
    "12m": "price_1ThSULLtal3R1c9fRyopo2pP"
  },
  family: {
    "1m": "price_1ThSULLtal3R1c9fMnFPcMK6",
    "3m": "price_1ThSULLtal3R1c9fEuGrYhIO",
    "6m": "price_1ThSUMLtal3R1c9flGJNmKA4",
    "12m": "price_1ThSUMLtal3R1c9fZeGjwLxW"
  },
  familyPlus: {
    "1m": "price_1ThSUMLtal3R1c9fVyTiJSdN",
    "3m": "price_1ThSUNLtal3R1c9frZ1qqtrI",
    "6m": "price_1ThSUNLtal3R1c9faVvLHqgf",
    "12m": "price_1ThSUNLtal3R1c9fwNwMU1El"
  }
};

// Anciens prix (Payment Links mensuels) encore portés par des abonnements actifs
const legacyPriceToPlan = {
  price_1ThEGvLQlkCITXQTh1DLIIwK: "solo",
  price_1ThEIbLtal3R1c9fHkcl5Rlt: "solo",
  price_1ThEH4LQlkCITXQTV6I3DnyN: "family",
  price_1ThEIcLtal3R1c9fhZedmYx3: "family",
  price_1ThEH7LQlkCITXQTBaiQgABG: "familyPlus",
  price_1ThEIcLtal3R1c9fNvVovOFz: "familyPlus"
};

// Mappe un price id (toutes durées) vers son plan, pour le webhook/sync
const priceIdToPlan = { ...legacyPriceToPlan };
for (const [plan, durations] of Object.entries(stripePrices)) {
  for (const priceId of Object.values(durations)) {
    priceIdToPlan[priceId] = plan;
  }
}

const validDurations = ["1m", "3m", "6m", "12m"];
const validCurrencies = ["cad", "usd", "eur"];

module.exports = { stripePrices, priceIdToPlan, validDurations, validCurrencies };
