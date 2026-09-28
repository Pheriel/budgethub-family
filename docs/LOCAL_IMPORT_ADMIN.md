# Import Free et gestion Super Admin (Web)

## Préparation

Appliquer `supabase/migrations/20260928180000_local_free_import.sql` dans un environnement de test avant toute mise en production. La migration ajoute un registre d'import unique par utilisateur, la fonction `import_local_free` et une règle restrictive qui coupe l'accès aux données des comptes suspendus, même avec un ancien jeton JWT.

## Vérification de test

1. Dans un navigateur de test, saisir des données Free sur deux mois; créer un compte Free **vide** dans l'environnement de test.
2. Vérifier le résumé sous **Compte → Reprendre mes données Free**, importer et comparer les lignes cloud, le revenu récent et la copie `bh_month_demo_...` dans le navigateur.
3. Relancer la même fonction avec le même contenu : elle doit retourner le résultat précédent sans nouvelle ligne. Essayer un contenu différent : elle doit renvoyer `already_imported`.
4. Dans un compte cloud déjà rempli, l'import doit renvoyer `cloud_data_present` sans changement. Provoquer une erreur de contrainte : aucune ligne ni registre partiel ne doit rester.
5. Avec un compte de test, dans **Super Admin → Comptes et accès**, envoyer un lien de réinitialisation, puis désactiver et réactiver le compte. Vérifier les nouvelles connexions, un ancien JWT, le courriel de récupération, les droits admin et le journal d'actions.

L'import est volontairement limité à un compte Free cloud vide et à 60 mois. Il reprend les dettes et objectifs du dernier état, les transactions de chaque mois, les dépenses récurrentes une seule fois et le revenu du dernier mois renseigné. Aucun contenu local n'est effacé automatiquement. Le mot de passe n'est jamais communiqué à l'administrateur : le titulaire choisit son nouveau mot de passe avec le lien reçu.
