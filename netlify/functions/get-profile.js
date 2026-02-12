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

    const admin = getSupabaseAdmin();

    // Recupera info scuola se presente (e non è admin/co_admin)
    let school = null;
    if (profile.school_id && !['admin', 'co_admin'].includes(profile.role)) {
      const { data: schoolData } = await admin
        .from("schools")
        .select("id, name, city, province, logo_url")
        .eq("id", profile.school_id)
        .single();
      school = schoolData || null;
    }

    // Conta i post dell'utente
    const { count: postsCount } = await admin
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", user.id);

    // Se l'utente non ha una scuola, controlla se ha una richiesta pendente
    let pending_school_request = null;
    if (!profile.school_id && !['admin', 'co_admin'].includes(profile.role)) {
      const { data: pendingReq } = await admin
        .from("school_requests")
        .select("id, name, city, created_at")
        .eq("requested_by", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      pending_school_request = pendingReq || null;
    }

    return response(200, {
      profile: {
        ...profile,
        school,
        posts_count: postsCount || 0,
        pending_school_request,
      },
    });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
