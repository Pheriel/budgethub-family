const { createSupabaseAdminClient } = require("../config/supabase");

const VALID_PLANS = ["free", "solo", "family", "familyPlus"];
const VALID_DURATIONS = ["1m", "3m", "6m", "12m"];
const durationDays = { "1m": 30, "3m": 90, "6m": 180, "12m": 365 };
const extensionDays = [30, 90, 180, 365];
const profileSelect = "id,email,display_name,created_at,plan,billing_duration,subscription_status,current_period_end,stripe_customer_id,stripe_subscription_id,family_owner_id,is_suspended,suspended_at";
const legacyProfileSelect = "id,email,display_name,created_at,plan,billing_duration,subscription_status,current_period_end,stripe_customer_id,stripe_subscription_id,family_owner_id";

function superAdminEmails() {
  return (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isSuperAdminEmail(email) {
  return Boolean(email && superAdminEmails().includes(email.toLowerCase()));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function normalizeProfile(row) {
  return {
    id: row.id,
    email: row.email || "",
    name: row.display_name || "",
    createdAt: row.created_at || null,
    plan: row.plan || "free",
    billingDuration: row.billing_duration || null,
    subscriptionStatus: row.subscription_status || null,
    currentPeriodEnd: row.current_period_end || null,
    stripeCustomerId: row.stripe_customer_id || null,
    stripeSubscriptionId: row.stripe_subscription_id || null,
    familyOwnerId: row.family_owner_id || row.id,
    isSuspended: Boolean(row.is_suspended),
    suspendedAt: row.suspended_at || null,
    isActive: !row.is_suspended
  };
}

async function audit(supabase, actor, targetUserId, action, beforeState, afterState) {
  const payload = {
    actor_user_id: actor.id,
    actor_email: actor.email,
    target_user_id: targetUserId,
    action,
    before_state: beforeState,
    after_state: afterState
  };
  const { error } = await supabase.from("admin_audit_logs").insert(payload);
  if (error) {
    console.warn("Admin audit log skipped:", error.message);
    return false;
  }
  return true;
}

async function getProfileOrNull(supabase, userId) {
  let { data, error } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", userId)
    .maybeSingle();
  if (error && error.code === "42703") {
    const fallback = await supabase
      .from("profiles")
      .select(legacyProfileSelect)
      .eq("id", userId)
      .maybeSingle();
    data = fallback.data;
  }
  return data || null;
}

async function selectProfiles(supabase, { term, from, to }) {
  const safeTerm = term.replace(/[%_]/g, "\\$&");
  let request = supabase
    .from("profiles")
    .select(profileSelect, { count: "exact" });

  if (term) {
    request = request.or(`email.ilike.%${safeTerm}%,display_name.ilike.%${safeTerm}%,plan.ilike.%${safeTerm}%`);
  }

  let result = await request.order("created_at", { ascending: false }).range(from, to);
  if (result.error && result.error.code === "42703") {
    request = supabase
      .from("profiles")
      .select(legacyProfileSelect, { count: "exact" });
    if (term) {
      request = request.or(`email.ilike.%${safeTerm}%,display_name.ilike.%${safeTerm}%,plan.ilike.%${safeTerm}%`);
    }
    result = await request.order("created_at", { ascending: false }).range(from, to);
  }
  return result;
}

async function familyMemberCount(supabase, ownerId) {
  const { count } = await supabase
    .from("family_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ownerId);
  return count || 0;
}

async function familyLabel(supabase, ownerId) {
  const owner = await getProfileOrNull(supabase, ownerId);
  if (!owner) return ownerId;
  return owner.display_name || owner.email || ownerId;
}

async function enrichProfile(supabase, row) {
  const profile = normalizeProfile(row);
  return {
    ...profile,
    family: await familyLabel(supabase, profile.familyOwnerId),
    memberCount: await familyMemberCount(supabase, profile.familyOwnerId)
  };
}

async function listUsers({ query = "", page = 1, pageSize = 20 } = {}) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { status: 503, body: { error: "supabase_not_configured" } };

  const term = (query || "").trim();
  const currentPage = Math.max(1, Number(page) || 1);
  const limit = Math.min(50, Math.max(1, Number(pageSize) || 20));
  const from = (currentPage - 1) * limit;
  const to = from + limit - 1;
  const { data, error, count } = await selectProfiles(supabase, { term, from, to });

  if (error) return { status: 500, body: { error: "users_list_failed", detail: error.message } };

  const users = [];
  for (const row of data || []) users.push(await enrichProfile(supabase, row));
  return {
    status: 200,
    body: {
      users,
      page: currentPage,
      pageSize: limit,
      total: count || 0,
      hasPrevious: currentPage > 1,
      hasNext: (count || 0) > currentPage * limit
    }
  };
}

async function getUserDetails(userId) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { status: 503, body: { error: "supabase_not_configured" } };

  const profile = await getProfileOrNull(supabase, userId);
  if (!profile) return { status: 404, body: { error: "user_not_found" } };

  const { data: logs, error: logError } = await supabase
    .from("admin_audit_logs")
    .select("id,actor_email,action,before_state,after_state,created_at")
    .eq("target_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(25);

  return {
    status: 200,
    body: {
      user: await enrichProfile(supabase, profile),
      logs: logError ? [] : (logs || [])
    }
  };
}

async function accountUserIds(supabase, ownerId) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .or(`id.eq.${ownerId},family_owner_id.eq.${ownerId}`);
  return (data || []).map((row) => row.id);
}

async function setPlan({ actor, userId, plan, duration }) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { status: 503, body: { error: "supabase_not_configured" } };
  if (!VALID_PLANS.includes(plan)) return { status: 400, body: { error: "invalid_plan" } };
  if (plan !== "free" && !VALID_DURATIONS.includes(duration)) return { status: 400, body: { error: "invalid_duration" } };

  const profile = await getProfileOrNull(supabase, userId);
  if (!profile) return { status: 404, body: { error: "user_not_found" } };

  const ownerId = profile.family_owner_id || profile.id;
  const ids = await accountUserIds(supabase, ownerId);
  const beforeState = normalizeProfile(profile);
  const periodEnd = plan === "free" ? null : addDays(new Date(), durationDays[duration]).toISOString();
  const update = plan === "free"
    ? {
      plan: "free",
      billing_duration: null,
      subscription_status: "admin_free",
      current_period_end: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      cancel_at_period_end: false,
      plan_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    : {
      plan,
      billing_duration: duration,
      subscription_status: "admin_granted",
      current_period_end: periodEnd,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      cancel_at_period_end: false,
      plan_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

  const { error } = await supabase.from("profiles").update(update).in("id", ids.length ? ids : [ownerId]);
  if (error) return { status: 500, body: { error: "plan_update_failed" } };

  const after = await getProfileOrNull(supabase, userId);
  if (!after || after.plan !== plan) return { status: 500, body: { error: "plan_update_not_persisted" } };
  await audit(supabase, actor, userId, "set_plan", beforeState, { ...normalizeProfile(after), appliedToUserIds: ids });
  return getUserDetails(userId);
}

async function extendUser({ actor, userId, days }) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { status: 503, body: { error: "supabase_not_configured" } };
  const amount = Number(days);
  if (!extensionDays.includes(amount)) return { status: 400, body: { error: "invalid_extension" } };

  const profile = await getProfileOrNull(supabase, userId);
  if (!profile) return { status: 404, body: { error: "user_not_found" } };
  if ((profile.plan || "free") === "free") return { status: 400, body: { error: "cannot_extend_free_plan" } };

  const ownerId = profile.family_owner_id || profile.id;
  const ids = await accountUserIds(supabase, ownerId);
  const base = profile.current_period_end && new Date(profile.current_period_end) > new Date()
    ? new Date(profile.current_period_end)
    : new Date();
  const periodEnd = addDays(base, amount).toISOString();
  const update = {
    current_period_end: periodEnd,
    subscription_status: profile.subscription_status || "admin_granted",
    plan_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from("profiles").update(update).in("id", ids.length ? ids : [ownerId]);
  if (error) return { status: 500, body: { error: "extension_failed" } };

  const after = await getProfileOrNull(supabase, userId);
  await audit(supabase, actor, userId, "extend_subscription", normalizeProfile(profile), { ...normalizeProfile(after), days: amount, appliedToUserIds: ids });
  return getUserDetails(userId);
}

async function setSuspended({ actor, userId, suspended }) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { status: 503, body: { error: "supabase_not_configured" } };

  const profile = await getProfileOrNull(supabase, userId);
  if (!profile) return { status: 404, body: { error: "user_not_found" } };

  const update = {
    is_suspended: Boolean(suspended),
    suspended_at: suspended ? new Date().toISOString() : null,
    subscription_status: suspended ? "suspended" : (profile.plan === "free" ? "admin_free" : "admin_granted"),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from("profiles").update(update).eq("id", userId);
  if (error && error.code === "42703") return { status: 500, body: { error: "admin_migration_required" } };
  if (error) return { status: 500, body: { error: "suspension_failed" } };

  const after = await getProfileOrNull(supabase, userId);
  await audit(supabase, actor, userId, suspended ? "suspend_user" : "reactivate_user", normalizeProfile(profile), normalizeProfile(after));
  return getUserDetails(userId);
}

module.exports = {
  isSuperAdminEmail,
  listUsers,
  getUserDetails,
  setPlan,
  extendUser,
  setSuspended
};
