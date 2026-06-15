const { createSupabaseAdminClient } = require("../config/supabase");
const { normalizeRole, can } = require("../services/permissions");
const FAMILY_PLANS = ["family", "familyPlus"];

function superAdminEmails() {
  return (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

// Vérifie le jeton Supabase (Authorization: Bearer <access_token>) et attache
// req.user = { id, email, role, familyOwnerId, plan }. Ne jamais se fier au
// userId envoyé par le frontend.
async function requireAuth(req, res, next) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return res.status(503).json({ error: "Auth service unavailable." });
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "missing_token" });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data || !data.user) {
    return res.status(401).json({ error: "invalid_token" });
  }

  const userId = data.user.id;
  let { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan, family_owner_id, is_suspended")
    .eq("id", userId)
    .single();

  if (profileError && profileError.code === "42703") {
    const fallback = await supabase
      .from("profiles")
      .select("plan, family_owner_id")
      .eq("id", userId)
      .single();
    profile = fallback.data;
  }

  if (profile && profile.is_suspended && !superAdminEmails().includes((data.user.email || "").toLowerCase())) {
    return res.status(403).json({ error: "account_suspended" });
  }

  const familyOwnerId = (profile && profile.family_owner_id) || userId;
  let role = "Owner";
  if (familyOwnerId !== userId) {
    const { data: membership } = await supabase
      .from("family_members")
      .select("role")
      .eq("invited_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    role = normalizeRole(membership ? membership.role : "Viewer");
  }

  req.user = {
    id: userId,
    email: data.user.email,
    role,
    familyOwnerId,
    plan: profile ? profile.plan : "free"
  };
  req.supabaseAdmin = supabase;
  next();
}

// 403 clair si le rôle de l'utilisateur ne permet pas l'action
function requirePermission(action) {
  return (req, res, next) => {
    if (!req.user || !can(req.user.role, action)) {
      return res.status(403).json({
        error: "forbidden",
        action,
        role: req.user ? req.user.role : null
      });
    }
    next();
  };
}

function requireFamilyPlan(req, res, next) {
  if (!req.user || !FAMILY_PLANS.includes(req.user.plan)) {
    return res.status(403).json({
      error: "family_plan_required",
      plans: FAMILY_PLANS
    });
  }
  next();
}

module.exports = { requireAuth, requirePermission, requireFamilyPlan, FAMILY_PLANS };
