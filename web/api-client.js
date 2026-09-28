(function (root) {
  "use strict";

  const localHosts = new Set(["localhost", "127.0.0.1"]);
  const host = root.location && root.location.hostname;
  const baseUrl = localHosts.has(host) ? "http://localhost:3000" : "https://budgethubfamily.com";

  function request(path, options) {
    if (typeof path !== "string" || !/^\/api\/[a-z0-9/_?=&.%-]*$/i.test(path) || path.startsWith("//")) {
      throw new TypeError("Expected an application API path beginning with /api/");
    }
    return root.fetch(`${baseUrl}${path}`, options);
  }

  const api = Object.freeze({ baseUrl, request });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BudgetHubWebApi = api;
})(typeof window !== "undefined" ? window : globalThis);
