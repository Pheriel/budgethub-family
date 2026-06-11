const express = require("express");

const {
  configDiagnostics,
  supabaseDiagnostics,
  stripeDiagnostics
} = require("../controllers/diagnostics.controller");

const router = express.Router();

router.get("/config", configDiagnostics);
router.get("/supabase", supabaseDiagnostics);
router.get("/stripe", stripeDiagnostics);

module.exports = router;
