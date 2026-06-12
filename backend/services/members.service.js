const { createSupabaseAdminClient } = require("../config/supabase");

const planMemberLimits = { free: 1, solo: 1, family: 5, familyPlus: 10 };

// Invite un membre: crée son compte Supabase (courriel d'invitation avec choix
// du mot de passe), le relie au plan de l'invitant et l'ajoute à la famille.
async function inviteMember({ inviterId, email, name, role }) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { status: 503, body: { error: "Supabase admin client unavailable." } };
  }

  const { data: inviterProfile, error: profileError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", inviterId)
    .single();

  if (profileError || !inviterProfile) {
    return { status: 404, body: { error: "Inviter profile not found." } };
  }

  const limit = planMemberLimits[inviterProfile.plan] ?? 1;
  const { count } = await supabase
    .from("family_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", inviterId);

  if ((count ?? 0) >= limit) {
    return {
      status: 403,
      body: { error: "member_limit_reached", plan: inviterProfile.plan, limit }
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

    const { data: alreadyMember } = await supabase
      .from("family_members")
      .select("id")
      .eq("user_id", inviterId)
      .eq("invited_user_id", invitedUserId)
      .maybeSingle();

    if (alreadyMember) {
      return { status: 409, body: { error: "already_in_family" } };
    }
  } else {
    const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: process.env.CLIENT_URL || undefined,
      data: { invited_by: inviterId, display_name: name }
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

  // Le profil du membre hérite du plan de l'invitant
  await supabase
    .from("profiles")
    .update({ plan: inviterProfile.plan, invited_by: inviterId, display_name: name, updated_at: new Date().toISOString() })
    .eq("id", invitedUserId);

  const { data: memberRow, error: memberError } = await supabase
    .from("family_members")
    .insert({ user_id: inviterId, name, role, email, invited_user_id: invitedUserId })
    .select()
    .single();

  if (memberError) {
    return { status: 500, body: { error: "member_insert_failed" } };
  }

  return { status: 200, body: { invited: true, linkedExisting, member: memberRow } };
}

module.exports = { inviteMember };
