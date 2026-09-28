(function (root) {
  "use strict";

  function exampleForMonth(monthKey) {
    return {
      income: 3150,
      incomeInput: 3150,
      incomeFrequency: "monthly",
      debts: [
        { name: "Carte Visa", balance: 4850, rate: 19.99, minPayment: 145, paymentDay: 28 },
        { name: "Prêt auto", balance: 12800, rate: 7.49, minPayment: 410, paymentDay: 1 }
      ],
      budget: [
        { name: "Appartement", category: "housing", planned: 1300, dueDay: 1, isRecurring: true },
        { name: "Épicerie", category: "groceries", planned: 800, isRecurring: true },
        { name: "Internet", category: "telecom", planned: 70, dueDay: 15, isRecurring: true },
        { name: "Assurance auto", category: "insurance", planned: 110, dueDay: 20, isRecurring: true }
      ],
      transactions: [
        { date: `${monthKey}-09`, name: "Épicerie Marché Central", category: "Épicerie", amount: -126.42 },
        { date: `${monthKey}-07`, name: "Hydro", category: "Services", amount: -94.3 },
        { date: `${monthKey}-06`, name: "Paiement Visa", category: "Dette", amount: -250 }
      ],
      goals: [
        { name: "Fonds urgence", target: 12000, saved: 7250 },
        { name: "Vacances famille", target: 4500, saved: 1800 },
        { name: "Rénovation cuisine", target: 9000, saved: 2750 }
      ]
    };
  }

  function hasFinancialData(storage) {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key || !key.startsWith("bh_month_demo_")) continue;
      try {
        const data = JSON.parse(storage.getItem(key));
        if (Number(data.income) || Number(data.incomeInput) ||
            ["debts", "budget", "transactions", "goals"].some((name) => Array.isArray(data[name]) && data[name].length)) return true;
      } catch (_error) {
        // An unreadable record may be recoverable: never replace it with a preview.
        return true;
      }
    }
    return false;
  }

  const api = Object.freeze({ exampleForMonth, hasFinancialData });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BudgetHubDemoPreview = api;
})(typeof window !== "undefined" ? window : globalThis);
