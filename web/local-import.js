(function (root) {
  "use strict";
  const keyPattern = /^bh_month_demo_(\d{4}-(0[1-9]|1[0-2]))$/;
  const money = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const text = (value) => String(value == null ? "" : value).trim().slice(0, 240);
  const frequency = (value) => ["weekly", "biweekly", "every15", "twiceMonthly", "monthly", "annual"].includes(value) ? value : "monthly";

  function preview(storage) {
    const months = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      const match = keyPattern.exec(key || "");
      if (!match) continue;
      let data;
      try { data = JSON.parse(storage.getItem(key)); }
      catch (_error) { throw new Error(`Mois illisible : ${match[1]}. La copie locale reste intacte.`); }
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(`Mois invalide : ${match[1]}`);
      months.push({ month: match[1], data });
    }
    months.sort((a, b) => a.month.localeCompare(b.month));
    if (months.length > 60) throw new Error("Import limité à 60 mois.");
    const debts = new Map();
    const goals = new Map();
    const budget = new Map();
    const transactions = [];
    let income = null;
    for (const { month, data } of months) {
      for (const field of ["debts", "goals", "budget", "transactions"]) {
        if (data[field] != null && !Array.isArray(data[field])) throw new Error(`Données invalides : ${field} (${month}).`);
        if (data[field]?.some((row) => !row || typeof row !== "object" || Array.isArray(row))) throw new Error(`Ligne invalide : ${field} (${month}).`);
      }
      if (Number(data.incomeInput ?? data.income) > 0) {
        income = { amount: money(data.incomeInput ?? data.income), monthly: money(data.income), frequency: frequency(data.incomeFrequency) };
      }
      const debtNames = new Map();
      for (const row of data.debts || []) {
        if (!text(row.name)) continue;
        const name = text(row.name).toLowerCase();
        const position = debtNames.get(name) || 0;
        debtNames.set(name, position + 1);
        debts.set(`${name}:${position}`, {
          name: text(row.name), balance: money(row.balance), rate: money(row.rate),
          min_payment: money(row.minPayment), payment_day: Math.min(31, Math.max(1, Math.round(Number(row.paymentDay) || 1)))
        });
      }
      const goalNames = new Map();
      for (const row of data.goals || []) {
        if (!text(row.name)) continue;
        if (money(row.target) <= 0) throw new Error(`Objectif sans cible valide : ${month}.`);
        const name = text(row.name).toLowerCase();
        const position = goalNames.get(name) || 0;
        goalNames.set(name, position + 1);
        goals.set(`${name}:${position}`, {
          name: text(row.name), target: money(row.target), saved: money(row.saved),
          monthly_contribution: money(row.monthlyContribution), contribution_frequency: frequency(row.contributionFrequency),
          target_date: row.targetDate || null, status: ["active", "reached", "paused"].includes(row.status) ? row.status : "active"
        });
      }
      for (const row of data.budget || []) {
        if (!text(row.name)) continue;
        const recurring = row.isRecurring !== false;
        const identity = recurring ? `recurring:${text(row.name).toLowerCase()}:${text(row.category).toLowerCase()}` : `${month}:${budget.size}:${text(row.name)}`;
        const existing = budget.get(identity);
        budget.set(identity, {
          name: text(row.name), category: text(row.category) || "other", planned: money(row.planned),
          spent: money(row.spent), due_day: row.dueDay ? Math.min(31, Math.max(1, Math.round(Number(row.dueDay) || 1))) : null, is_recurring: recurring,
          frequency: frequency(row.frequency), notes: text(row.notes), month_key: existing?.month_key || month
        });
      }
      for (const row of data.transactions || []) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date || "") || !row.date.startsWith(month)) continue;
        transactions.push({ date: row.date, name: text(row.name), category: text(row.category) || "other", amount: Number.isFinite(Number(row.amount)) ? Number(row.amount) : 0 });
      }
    }
    const payload = { months: months.map((item) => item.month), debts: [...debts.values()], goals: [...goals.values()], budget: [...budget.values()], transactions, income };
    if (payload.debts.length > 10 || [payload.goals, payload.budget, transactions].some((list) => list.length > 1000)) throw new Error("Trop de données pour cet import. Contactez le support.");
    return payload;
  }

  const api = Object.freeze({ preview });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BudgetHubLocalImport = api;
})(typeof window !== "undefined" ? window : globalThis);
