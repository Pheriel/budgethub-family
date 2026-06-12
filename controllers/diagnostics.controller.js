const {
  getConfigStatus,
  testSupabaseConnection,
  testStripeConnection
} = require("../services/diagnostics.service");

function configDiagnostics(_req, res) {
  res.json(getConfigStatus());
}

async function supabaseDiagnostics(_req, res) {
  const result = await testSupabaseConnection();
  res.status(result.success ? 200 : 503).json(result);
}

async function stripeDiagnostics(_req, res) {
  const result = await testStripeConnection();
  res.status(result.success ? 200 : 503).json(result);
}

module.exports = {
  configDiagnostics,
  supabaseDiagnostics,
  stripeDiagnostics
};
