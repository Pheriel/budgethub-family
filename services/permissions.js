// Source de vérité des rôles famille et de leurs permissions.
// Owner  : tout (Stripe, membres, rôles, données, suppression famille)
// Admin  : données + inviter, retirer Viewer/Editor; pas de Stripe, pas de rôles
// Editor : données (dettes en lecture incluse); pas de membres ni Stripe
// Viewer : lecture seule
const ROLES = ["Owner", "Admin", "Editor", "Viewer"];

const PERMISSIONS = {
  Owner: {
    manageBilling: true,
    inviteMembers: true,
    removeMembers: true,
    changeRoles: true,
    editData: true,
    deleteFamily: true
  },
  Admin: {
    manageBilling: false,
    inviteMembers: true,
    removeMembers: true,
    changeRoles: false,
    editData: true,
    deleteFamily: false
  },
  Editor: {
    manageBilling: false,
    inviteMembers: false,
    removeMembers: false,
    changeRoles: false,
    editData: true,
    deleteFamily: false
  },
  Viewer: {
    manageBilling: false,
    inviteMembers: false,
    removeMembers: false,
    changeRoles: false,
    editData: false,
    deleteFamily: false
  }
};

// "Parent" est l'ancien nom du rôle Editor
function normalizeRole(role) {
  if (role === "Parent") return "Editor";
  return ROLES.includes(role) ? role : "Viewer";
}

function can(role, action) {
  const rules = PERMISSIONS[normalizeRole(role)];
  return Boolean(rules && rules[action]);
}

// Un Admin ne peut retirer que des Viewer/Editor; le Owner peut retirer tout le monde
function canRemoveMember(actorRole, targetRole) {
  const actor = normalizeRole(actorRole);
  const target = normalizeRole(targetRole);
  if (actor === "Owner") return target !== "Owner";
  if (actor === "Admin") return target === "Viewer" || target === "Editor";
  return false;
}

// Rôles attribuables à un membre invité (jamais Owner)
const ASSIGNABLE_ROLES = ["Admin", "Editor", "Viewer"];

module.exports = { ROLES, ASSIGNABLE_ROLES, PERMISSIONS, normalizeRole, can, canRemoveMember };
