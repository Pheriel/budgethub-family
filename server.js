require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const memberRoutes = require("./routes/members.routes");
const billingRoutes = require("./routes/billing.routes");
const diagnosticsRoutes = require("./routes/diagnostics.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: false
}));

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:5180",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5180"
].filter(Boolean);
app.use(cors({ origin: allowedOrigins }));

// Le webhook Stripe doit recevoir le corps brut, avant express.json().
app.use("/api/billing", billingRoutes);
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "budgethub-family" });
});

app.use("/api/members", memberRoutes);
app.use("/api/diagnostics", diagnosticsRoutes);
app.use("/api/admin", adminRoutes);

const staticRoot = __dirname;

app.get(["/", "/index.html"], (_req, res) => {
  res.sendFile(path.join(staticRoot, "index.html"));
});

app.get(["/app.js", "/styles.css"], (req, res) => {
  res.sendFile(path.join(staticRoot, req.path.slice(1)));
});

app.use("/assets", express.static(path.join(staticRoot, "assets")));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Route not found" });
  }
  res.sendFile(path.join(staticRoot, "index.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`BudgetHub Family backend listening on port ${port}`);
});
