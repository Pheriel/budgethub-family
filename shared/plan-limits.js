(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.BudgetHubPlanLimits = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const FREE_DEBT_LIMIT = 10;

  function debtLimitForPlan(planId) {
    return planId === "free" ? FREE_DEBT_LIMIT : Infinity;
  }

  function canAddDebt(currentCount, planId) {
    return currentCount < debtLimitForPlan(planId);
  }

  function hasReachedDebtLimit(currentCount, planId) {
    return !canAddDebt(currentCount, planId);
  }

  function debtUsageSummary(currentCount, planId) {
    return `${currentCount} / ${debtLimitForPlan(planId)}`;
  }

  return {
    FREE_DEBT_LIMIT,
    debtLimitForPlan,
    canAddDebt,
    hasReachedDebtLimit,
    debtUsageSummary
  };
});
