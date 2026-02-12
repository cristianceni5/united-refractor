const { getSupabaseAdmin, extractToken, getUserFromToken, getUserProfile, headers, response } = require("../../lib/supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "GET") {
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

    // Se l'utente non ha una scuola, controlla se ha una richiesta pendente
    if (!profile.school_id) {
      const admin = getSupabaseAdmin();
      const { data: pendingReq } = await admin
        .from("school_requests")
        .select("id, name, city, created_at")
        .eq("requested_by", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      profile.pending_school_request = pendingReq || null;
    }

    return response(200, { profile });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
