const assert = require("node:assert/strict");

const {
  FREE_DEBT_LIMIT,
  debtLimitForPlan,
  canAddDebt,
  hasReachedDebtLimit,
  debtUsageSummary
} = require("../shared/plan-limits.js");

function run() {
  assert.equal(FREE_DEBT_LIMIT, 10, "free debt limit should stay centralized at 10");

  for (let count = 0; count < FREE_DEBT_LIMIT; count += 1) {
    assert.equal(canAddDebt(count, "free"), true, `free plan should allow debt ${count + 1}`);
  }

  assert.equal(canAddDebt(FREE_DEBT_LIMIT - 1, "free"), true, "the 10th debt should be accepted");
  assert.equal(canAddDebt(FREE_DEBT_LIMIT, "free"), false, "the 11th debt should be refused");
  assert.equal(hasReachedDebtLimit(FREE_DEBT_LIMIT, "free"), true, "free plan should report limit reached at 10");

  assert.equal(debtLimitForPlan("solo"), Infinity, "solo plan should keep unlimited debts");
  assert.equal(canAddDebt(999, "solo"), true, "paid plans should allow more than 10 debts");

  assert.equal(canAddDebt(FREE_DEBT_LIMIT - 1, "free"), true, "removing a debt should free one slot");
  assert.equal(debtUsageSummary(7, "free"), "7 / 10", "free usage counter should show the centralized limit");
  assert.equal(debtUsageSummary(18, "solo"), "18 / Infinity", "paid usage summary should remain unlimited in helper output");
}

run();
console.log("debt-limit tests passed");
