const { extractToken, getUserFromToken, getUserProfile, getSupabaseAdmin, headers, response } = require("../../lib/supabase");

const VALID_ROLES = ["admin", "co_admin", "rappresentante", "studente"];

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "PUT") {
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
    if (!profile || !['admin', 'co_admin'].includes(profile.role)) {
      return response(403, { error: "Solo admin e co-admin possono modificare i ruoli" });
    }

    const { user_id, role } = JSON.parse(event.body);

    if (!user_id || !role) {
      return response(400, { error: "user_id e role sono obbligatori" });
    }

    if (!VALID_ROLES.includes(role)) {
      return response(400, { error: `Ruolo non valido. Ruoli disponibili: ${VALID_ROLES.join(", ")}` });
    }

    // Co-admin non può promuovere ad admin
    if (profile.role === 'co_admin' && role === 'admin') {
      return response(403, { error: "Un co-admin non può promuovere un utente ad admin" });
    }

    // Co-admin non può modificare il ruolo di un admin
    const targetProfile = await getUserProfile(user_id);
    if (!targetProfile) {
      return response(404, { error: "Utente non trovato" });
    }
    if (profile.role === 'co_admin' && targetProfile.role === 'admin') {
      return response(403, { error: "Un co-admin non può modificare il ruolo di un admin" });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("profiles")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("id", user_id)
      .select()
      .single();

    if (error) {
      return response(400, { error: error.message });
    }

    return response(200, { profile: data });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
