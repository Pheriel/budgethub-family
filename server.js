require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const fs = require("fs");
const path = require("path");

const memberRoutes = require("./routes/members.routes");
const billingRoutes = require("./routes/billing.routes");
const diagnosticsRoutes = require("./routes/diagnostics.routes");
const adminRoutes = require("./routes/admin.routes");
const supportRoutes = require("./routes/support.routes");
const familyRoutes = require("./routes/family.routes");

const app = express();
const port = process.env.PORT || 3000;
const JSON_BODY_LIMIT = "100kb";
const staticRoot = __dirname;
const indexTemplate = fs.readFileSync(path.join(staticRoot, "index.html"), "utf8");
const PUBLIC_PAGE_META = Object.freeze({
  "/": {
    title: "BudgetHub Family | Budget familial moderne",
    description: "BudgetHub Family rassemble vos dettes, votre budget, vos transactions et vos objectifs dans un espace simple, seul ou en famille."
  },
  "/pricing": {
    title: "Tarifs | BudgetHub Family",
    description: "Comparez les plans Free, Solo, Family et Family Plus de BudgetHub Family, à partir de 0 $ par mois."
  },
  "/terms": {
    title: "Conditions d’utilisation | BudgetHub Family",
    description: "Consultez les conditions d’utilisation de BudgetHub Family, notamment les règles relatives aux comptes et aux abonnements."
  },
  "/privacy": {
    title: "Politique de confidentialité | BudgetHub Family",
    description: "Découvrez comment BudgetHub Family traite et protège les données nécessaires au fonctionnement du service."
  },
  "/cookies": {
    title: "Politique relative aux cookies | BudgetHub Family",
    description: "Consultez la politique de BudgetHub Family concernant les cookies, le stockage local et les technologies essentielles."
  },
  "/legal": {
    title: "Mentions légales | BudgetHub Family",
    description: "Consultez les mentions légales, les coordonnées de l’exploitant et les fournisseurs techniques de BudgetHub Family."
  },
  "/refund-policy": {
    title: "Politique de remboursement | BudgetHub Family",
    description: "Consultez les conditions d’annulation et de remboursement des abonnements BudgetHub Family."
  },
  "/login": {
    title: "Connexion | BudgetHub Family",
    description: "Connectez-vous à votre espace BudgetHub Family."
  },
  "/register": {
    title: "Créer un compte | BudgetHub Family",
    description: "Créez votre compte BudgetHub Family pour accéder à votre espace."
  },
  "/signup": {
    title: "Créer un compte | BudgetHub Family",
    description: "Créez votre compte BudgetHub Family pour accéder à votre espace."
  }
});

function renderIndexForPath(requestPath) {
  const page = PUBLIC_PAGE_META[requestPath] || PUBLIC_PAGE_META["/"];
  const canonicalPath = requestPath === "/signup" ? "/register" : requestPath;
  const canonical = `https://budgethubfamily.com${canonicalPath === "/" ? "/" : canonicalPath}`;
  return indexTemplate
    .replace(/<title>[^<]*<\/title>/, `<title>${page.title}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${page.description}" />`)
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${canonical}" />`);
}

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
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "budgethub-family" });
});

app.use("/api/members", memberRoutes);
app.use("/api/family", familyRoutes);
app.use("/api/diagnostics", diagnosticsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/support", supportRoutes);

app.get("/index.html", (_req, res) => {
  res.type("html").send(renderIndexForPath("/"));
});

app.get(Object.keys(PUBLIC_PAGE_META), (req, res) => {
  res.type("html").send(renderIndexForPath(req.path));
});

app.get(["/app.js", "/styles.css"], (req, res) => {
  res.sendFile(path.join(staticRoot, req.path.slice(1)));
});

app.use("/assets", express.static(path.join(staticRoot, "assets")));
app.use("/shared", express.static(path.join(staticRoot, "shared")));

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

// Hostinger charge le fichier d'entree avec require(), donc require.main !== module
// meme en production. On desactive l'ecoute uniquement pendant les tests.
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`BudgetHub Family backend listening on port ${port}`);
  });
}

module.exports = { app, PUBLIC_PAGE_META, renderIndexForPath };
