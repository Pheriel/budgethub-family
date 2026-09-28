const assert = require("node:assert/strict");
const { test } = require("node:test");
const { exampleForMonth, hasFinancialData } = require("../web/demo-preview");

function storage(records) {
  const keys = Object.keys(records);
  return { length: keys.length, key: (i) => keys[i], getItem: (key) => records[key] ?? null };
}

test("a fresh or placeholder-only browser can see a current-month sample", () => {
  assert.equal(hasFinancialData(storage({})), false);
  assert.equal(hasFinancialData(storage({ "bh_month_demo_2026-09": JSON.stringify({ income: 0, debts: [], budget: [], transactions: [], goals: [] }) })), false);
  const sample = exampleForMonth("2026-09");
  assert.equal(sample.income, 3150);
  assert.ok(sample.transactions.every((row) => row.date.startsWith("2026-09-") && row.amount < 0));
  assert.equal(sample.debts.length, 2);
});

test("existing or unreadable local financial records prevent a sample preview", () => {
  assert.equal(hasFinancialData(storage({ "bh_month_demo_2026-08": JSON.stringify({ debts: [{ name: "Personal" }] }) })), true);
  assert.equal(hasFinancialData(storage({ "bh_month_demo_2026-07": "{corrupted" })), true);
  assert.equal(hasFinancialData(storage({ "bh_lang": "fr" })), false);
});
