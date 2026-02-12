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
    if (!profile) {
      return response(404, { error: "Profilo non trovato" });
    }

    // Admin e co_admin vedono tutte le scuole, gli altri solo la propria
    if (!['admin', 'co_admin'].includes(profile.role) && !profile.school_id) {
      return response(400, { error: "Nessuna scuola associata al profilo" });
    }

    const admin = getSupabaseAdmin();
    let query = admin
      .from("posts")
      .select("id, school_id, author_id, title, body, image_url, category, pinned, status, discount, created_at, updated_at, profiles(full_name, avatar_url)")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });

    // Admin e co_admin vedono tutto (anche pending); gli altri vedono solo approved
    if (!['admin', 'co_admin'].includes(profile.role)) {
      query = query.eq("status", "approved");
    }

    // Admin e co_admin vedono tutto; gli altri vedono la propria scuola + post globali (school_id IS NULL)
    if (!['admin', 'co_admin'].includes(profile.role) && profile.school_id) {
      query = query.or(`school_id.eq.${profile.school_id},school_id.is.null`);
    }

    const params = event.queryStringParameters || {};
    if (params.category) {
      query = query.eq("category", params.category);
    }
    if (params.status) {
      query = query.eq("status", params.status);
    }

    const { data, error } = await query;

    if (error) {
      return response(400, { error: error.message });
    }

    const posts = data.map((p) => ({
      ...p,
      author_name: p.profiles?.full_name || "Sconosciuto",
      author_avatar_url: p.profiles?.avatar_url || null,
      is_own: p.author_id === user.id,
      status: p.status || "approved",
      discount: p.discount || null,
      profiles: undefined,
    }));

    return response(200, { posts });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
