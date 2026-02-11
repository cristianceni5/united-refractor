const { extractToken, getUserFromToken, getUserProfile, getSupabaseAdmin, headers, response } = require("../../lib/supabase");

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
    if (!profile || !profile.school_id) {
      return response(400, { error: "Profilo o scuola non trovata" });
    }

    const admin = getSupabaseAdmin();
    const params = event.queryStringParameters || {};

    // Admin vede anche pending, gli altri solo approved
    let query = admin
      .from("spotted")
      .select("id, school_id, author_id, body, status, likes_count, created_at")
      .eq("school_id", profile.school_id)
      .order("created_at", { ascending: false });

    if (params.status && profile.role === "admin") {
      query = query.eq("status", params.status);
    } else if (profile.role === "admin" && !params.status) {
      // Admin vede tutto di default
    } else {
      // Non-admin vedono solo gli approved
      query = query.eq("status", "approved");
    }

    const { data, error } = await query;

    if (error) {
      return response(400, { error: error.message });
    }

    // Verifica quali spotted l'utente ha likato
    const spottedIds = data.map((s) => s.id);
    let userLikes = [];
    if (spottedIds.length > 0) {
      const { data: likes } = await admin
        .from("spotted_likes")
        .select("spotted_id")
        .eq("user_id", user.id)
        .in("spotted_id", spottedIds);
      userLikes = (likes || []).map((l) => l.spotted_id);
    }

    // Rimuovi author_id dalla risposta, aggiungi is_own e liked
    const spotted = data.map((s) => ({
      id: s.id,
      body: s.body,
      status: s.status,
      likes_count: s.likes_count,
      created_at: s.created_at,
      is_own: s.author_id === user.id,
      liked: userLikes.includes(s.id),
    }));

    return response(200, { spotted });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
