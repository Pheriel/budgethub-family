const assert = require("node:assert/strict");
const { test } = require("node:test");
const { preview } = require("../web/local-import");

function storage(records) {
  return {
    length: Object.keys(records).length,
    key(index) { return Object.keys(records)[index]; },
    getItem(key) { return records[key]; }
  };
}

test("imports all months, latest debt/goal balances, and a single recurring expense", () => {
  const snapshot = preview(storage({
    bh_month_demo_2026_08: "ignored",
    "bh_month_demo_2026-08": JSON.stringify({
      income: 2000, debts: [{ name: "Visa", balance: 900 }], goals: [{ name: "Voyage", saved: 100 }],
      budget: [{ name: "Loyer", category: "housing", planned: 850, isRecurring: true }],
      transactions: [{ date: "2026-08-12", name: "Pain", amount: -4 }]
    }),
    "bh_month_demo_2026-09": JSON.stringify({
      income: 2200, debts: [{ name: "Visa", balance: 800 }], goals: [{ name: "Voyage", saved: 150 }],
      budget: [{ name: "Loyer", category: "housing", planned: 850, isRecurring: true }],
      transactions: [{ date: "2026-09-03", name: "Lait", amount: -5 }]
    })
  }));
  assert.deepEqual(snapshot.months, ["2026-08", "2026-09"]);
  assert.equal(snapshot.debts[0].balance, 800);
  assert.equal(snapshot.goals[0].saved, 150);
  assert.equal(snapshot.budget.length, 1);
  assert.equal(snapshot.transactions.length, 2);
  assert.equal(snapshot.income.monthly, 2200);
});

test("an unreadable month blocks import without changing the local copy", () => {
  const local = storage({ "bh_month_demo_2026-09": "{" });
  assert.throws(() => preview(local), /Mois illisible/);
  assert.equal(local.getItem("bh_month_demo_2026-09"), "{");
});
