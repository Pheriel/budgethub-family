const { createSupabaseAdminClient } = require("../config/supabase");
const { ASSIGNABLE_ROLES, normalizeRole, can, canRemoveMember } = require("./permissions");

const planMemberLimits = { free: 1, solo: 1, family: 5, familyPlus: 10 };
const productionUrl = "https://budgethubfamily.com";

function clientUrl() {
  const value = process.env.CLIENT_URL || productionUrl;
  return value.includes("localhost") || value.includes("127.0.0.1") ? productionUrl : value;
}

// Invite un membre: crée son compte Supabase (courriel d'invitation menant à
// l'écran "Créer votre mot de passe"), le relie au plan du propriétaire de la
// famille et l'ajoute à la famille. `inviter` vient du jeton vérifié.
async function inviteMember({ inviter, email, name, role, lang = "en" }) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { status: 503, body: { error: "Supabase admin client unavailable." } };
  }

  const familyOwnerId = inviter.familyOwnerId;
  const { data: ownerProfile, error: profileError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", familyOwnerId)
    .single();

  if (profileError || !ownerProfile) {
    return { status: 404, body: { error: "Owner profile not found." } };
  }

  const limit = planMemberLimits[ownerProfile.plan] ?? 1;
  const { count } = await supabase
    .from("family_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", familyOwnerId);

  if ((count ?? 0) >= limit) {
    return {
      status: 403,
      body: { error: "member_limit_reached", plan: ownerProfile.plan, limit }
    };
  }

  // Si le courriel a déjà un compte, on le rattache à la famille au lieu d'échouer
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let invitedUserId;
  let linkedExisting = false;

  if (existingProfile) {
    invitedUserId = existingProfile.id;
    linkedExisting = true;

    if (invitedUserId === familyOwnerId || invitedUserId === inviter.id) {
      return { status: 409, body: { error: "already_in_family" } };
    }

    const { data: alreadyMember } = await supabase
      .from("family_members")
      .select("id")
      .eq("user_id", familyOwnerId)
      .eq("invited_user_id", invitedUserId)
      .maybeSingle();

    if (alreadyMember) {
      return { status: 409, body: { error: "already_in_family" } };
    }
  } else {
    const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${clientUrl()}/auth/confirm`,
      data: {
        invited_by: inviter.id,
        display_name: name,
        lang,
        language: lang,
        locale: lang === "fr" ? "fr-CA" : "en"
      }
    });

    if (inviteError) {
      console.error("Supabase invite failed:", inviteError.status, inviteError.code, inviteError.message);
      if (inviteError.code === "over_email_send_rate_limit" || inviteError.status === 429) {
        return { status: 429, body: { error: "email_rate_limited" } };
      }
      if (inviteError.code === "email_address_invalid") {
        return { status: 400, body: { error: "email_invalid" } };
      }
      return { status: 502, body: { error: "invite_failed" } };
    }
    invitedUserId = invited.user.id;
  }

  // Le membre hérite du plan ET rejoint la famille du propriétaire (données partagées)
  await supabase
    .from("profiles")
    .update({
      plan: ownerProfile.plan,
      invited_by: inviter.id,
      family_owner_id: familyOwnerId,
      display_name: name,
      updated_at: new Date().toISOString()
    })
    .eq("id", invitedUserId);

  // user_id = propriétaire de la famille pour une liste de membres cohérente
  const { data: memberRow, error: memberError } = await supabase
    .from("family_members")
    .insert({ user_id: familyOwnerId, name, role, email, invited_user_id: invitedUserId })
    .select()
    .single();

  if (memberError) {
    return { status: 500, body: { error: "member_insert_failed" } };
  }

  return { status: 200, body: { invited: true, linkedExisting, member: memberRow } };
}

// Retire un membre de la famille (Owner: tout le monde, Admin: Viewer/Editor)
async function removeMember({ actor, memberId }) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { status: 503, body: { error: "Supabase admin client unavailable." } };
  }

  const { data: member } = await supabase
    .from("family_members")
    .select("id, user_id, role, invited_user_id")
    .eq("id", memberId)
    .maybeSingle();

  if (!member) {
    return { status: 404, body: { error: "member_not_found" } };
  }
  // Le membre doit appartenir à la même famille que l'acteur
  if (member.user_id !== actor.familyOwnerId) {
    return { status: 403, body: { error: "forbidden", action: "removeMembers" } };
  }
  if (!canRemoveMember(actor.role, member.role)) {
    return { status: 403, body: { error: "forbidden", action: "removeMembers", targetRole: normalizeRole(member.role) } };
  }

  const { error: deleteError } = await supabase
    .from("family_members")
    .delete()
    .eq("id", memberId);

  if (deleteError) {
    return { status: 500, body: { error: "member_delete_failed" } };
  }

  // Détache le compte invité de la famille (il redevient un compte indépendant)
  if (member.invited_user_id) {
    await supabase
      .from("profiles")
      .update({
        family_owner_id: null,
        invited_by: null,
        plan: "free",
        updated_at: new Date().toISOString()
      })
      .eq("id", member.invited_user_id);
  }

  return { status: 200, body: { removed: true } };
}

// Change le rôle d'un membre (Owner uniquement, jamais vers Owner)
async function changeMemberRole({ actor, memberId, role }) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { status: 503, body: { error: "Supabase admin client unavailable." } };
  }
  if (!can(actor.role, "changeRoles")) {
    return { status: 403, body: { error: "forbidden", action: "changeRoles" } };
  }
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return { status: 400, body: { error: "invalid_role" } };
  }

  const { data: member } = await supabase
    .from("family_members")
    .select("id, user_id")
    .eq("id", memberId)
    .maybeSingle();

  if (!member) {
    return { status: 404, body: { error: "member_not_found" } };
  }
  if (member.user_id !== actor.familyOwnerId) {
    return { status: 403, body: { error: "forbidden", action: "changeRoles" } };
  }

  const { data: updated, error: updateError } = await supabase
    .from("family_members")
    .update({ role })
    .eq("id", memberId)
    .select()
    .single();

  if (updateError) {
    return { status: 500, body: { error: "member_update_failed" } };
  }

  return { status: 200, body: { updated: true, member: updated } };
}

module.exports = { inviteMember, removeMember, changeMemberRole };
