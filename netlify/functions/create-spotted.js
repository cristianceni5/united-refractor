const { extractToken, getUserFromToken, getUserProfile, getSupabaseAdmin, isBanned, getBanMessage, headers, response } = require("../../lib/supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "POST") {
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
    if (!profile) {
      return response(404, { error: "Profilo non trovato" });
    }

    if (isBanned(profile)) {
      return response(403, { error: getBanMessage(profile) });
    }

    // Admin e co_admin possono creare spotted globali (senza scuola)
    const isGlobal = ['admin', 'co_admin'].includes(profile.role);
    if (!isGlobal && !profile.school_id) {
      return response(400, { error: "Nessuna scuola associata al profilo" });
    }

    const { body } = JSON.parse(event.body);

    if (!body || !body.trim()) {
      return response(400, { error: "Il testo e' obbligatorio" });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("spotted")
      .insert({
        school_id: isGlobal ? null : profile.school_id,
        author_id: user.id,
        body: body.trim(),
        status: isGlobal ? "approved" : "pending",
      })
      .select("id, body, status, likes_count, created_at")
      .single();

    if (error) {
      return response(400, { error: error.message });
    }

    return response(201, {
      spotted: { ...data, is_own: true, liked: false },
      message: "Spotted inviato! Sara' visibile dopo l'approvazione di un amministratore.",
    });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
