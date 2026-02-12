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

    // IMPORTANTE: Elimina prima dall'auth, il CASCADE eliminerà automaticamente
    // il profilo e tutte le righe correlate (spotted_likes, spotted_comments, posts, ecc.)
    // grazie ai vincoli ON DELETE CASCADE nel database
    const { error: authError } = await admin.auth.admin.deleteUser(user_id);

    if (authError) {
      return response(400, { error: "Errore eliminazione utente: " + authError.message });
    }

    // Il profilo e tutti i dati correlati sono stati eliminati automaticamente
    // grazie al vincolo ON DELETE CASCADE (auth.users → profiles)
    return response(200, {
      message: "Utente eliminato completamente da auth e database",
      deletedUserId: user_id
    });
  } catch (err) {
    console.error("Delete user error:", err);
    return response(500, { error: "Errore interno del server" });
  }
};
