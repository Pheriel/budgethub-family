const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const clientCode = fs.readFileSync(path.join(__dirname, "../web/api-client.js"), "utf8");

function clientFor(hostname) {
  const calls = [];
  const window = { location: { hostname }, fetch: (...args) => { calls.push(args); return Promise.resolve({ ok: true }); } };
  vm.runInNewContext(clientCode, { window });
  return { api: window.BudgetHubWebApi, calls };
}

test("web API uses an explicit local or production origin and preserves request options", async () => {
  for (const host of ["localhost", "127.0.0.1", "budgethubfamily.com", "preview.example"]) {
    const { api, calls } = clientFor(host);
    const base = ["localhost", "127.0.0.1"].includes(host) ? "http://localhost:3000" : "https://budgethubfamily.com";
    const options = { method: "POST", headers: { Authorization: "Bearer test" } };
    await api.request("/api/support/tickets", options);
    assert.equal(api.baseUrl, base);
    assert.equal(calls[0][0], `${base}/api/support/tickets`);
    assert.equal(calls[0][1], options);
    assert.throws(() => api.request("https://evil.example/api/steal"), /Expected an application API path/);
    assert.throws(() => api.request("//evil.example/api/steal"), /Expected an application API path/);
  }
});

test("Free browser data is not cleared or seeded with fictional records at startup", () => {
  const app = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
  assert.match(app, /loadMonthData\(\);/);
  assert.doesNotMatch(app, /cleanupLegacyFinancialStorage\(\)|const demoData\s*=/);
});
