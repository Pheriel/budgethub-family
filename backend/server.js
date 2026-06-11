require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/auth.routes");
const familyRoutes = require("./routes/families.routes");
const memberRoutes = require("./routes/members.routes");
const debtRoutes = require("./routes/debts.routes");
const budgetRoutes = require("./routes/budgets.routes");
const transactionRoutes = require("./routes/transactions.routes");
const goalRoutes = require("./routes/goals.routes");
const billingRoutes = require("./routes/billing.routes");

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || true }));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "budgethub-family-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/families", familyRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/debts", debtRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/billing", billingRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`BudgetHub Family backend listening on port ${port}`);
});
