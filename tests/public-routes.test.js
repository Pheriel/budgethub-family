const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

const { app, PUBLIC_PAGE_META } = require("../server");

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("public and legal routes return route-specific SEO metadata", async () => {
  for (const [path, meta] of Object.entries(PUBLIC_PAGE_META)) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200, `${path} should return 200`);
    assert.match(response.headers.get("content-type") || "", /text\/html/);
    const html = await response.text();
    assert.ok(html.includes(`<title>${meta.title}</title>`), `${path} should have its own title`);
    assert.ok(html.includes(`content="${meta.description}"`), `${path} should have its own description`);
    const canonicalPath = path === "/signup" ? "/register" : path;
    const canonical = `https://budgethubfamily.com${canonicalPath === "/" ? "/" : canonicalPath}`;
    assert.ok(html.includes(`<link rel="canonical" href="${canonical}" />`), `${path} should have a canonical URL`);
  }
});

test("application deep links still return the SPA", async () => {
  for (const path of ["/dashboard", "/debts", "/account"]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200, `${path} should return the SPA`);
    assert.match(await response.text(), /id="appView"/);
  }
});

test("anonymous callers cannot access administration APIs", async () => {
  const response = await fetch(`${baseUrl}/api/admin/me`);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "missing_token" });
});

test("unknown API routes return JSON 404 responses", async () => {
  const response = await fetch(`${baseUrl}/api/not-a-route`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Route not found" });
});
