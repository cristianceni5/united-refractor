const { extractToken, getUserFromToken, getUserProfile, getSupabaseAdmin, headers, response } = require("../../lib/supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "DELETE") {
    return response(405, { error: "Metodo non consentito" });
  }

  try {
    const token = extractToken(event);
    if (!token) {
      return response(401, { error: "Non autenticato" });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return response(401, { error: "Token non valido" });
    }

    const profile = await getUserProfile(user.id);
    if (!profile || profile.role !== 'admin') {
      return response(403, { error: "Solo gli admin possono eliminare utenti" });
    }

    const { user_id } = JSON.parse(event.body);

    if (!user_id) {
      return response(400, { error: "user_id obbligatorio" });
    }

    // Non puoi eliminare te stesso
    if (user_id === user.id) {
      return response(400, { error: "Non puoi eliminare te stesso" });
    }

    // Non puoi eliminare un altro admin
    const targetProfile = await getUserProfile(user_id);
    if (!targetProfile) {
      return response(404, { error: "Utente non trovato" });
    }
    if (targetProfile.role === "admin") {
      return response(403, { error: "Non puoi eliminare un altro amministratore" });
    }

    const admin = getSupabaseAdmin();

    // 1. Elimina il profilo dalla tabella profiles (le FK con ON DELETE CASCADE
    //    elimineranno spotted_likes, spotted_comments, ecc.)
    const { error: profileError } = await admin
      .from("profiles")
      .delete()
      .eq("id", user_id);

    if (profileError) {
      return response(400, { error: "Errore eliminazione profilo: " + profileError.message });
    }

    // 2. Elimina l'utente da auth.users usando l'admin API di Supabase
    const { error: authError } = await admin.auth.admin.deleteUser(user_id);

    if (authError) {
      return response(400, { error: "Profilo eliminato ma errore eliminazione auth: " + authError.message });
    }

    return response(200, { message: "Utente eliminato completamente" });
  } catch (err) {
    console.error("Delete user error:", err);
    return response(500, { error: "Errore interno del server" });
  }
};
