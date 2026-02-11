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
    let query = admin
      .from("posts")
      .select("id, school_id, author_id, title, body, image_url, category, pinned, created_at, updated_at, profiles(full_name, avatar_url)")
      .eq("school_id", profile.school_id)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });

    const params = event.queryStringParameters || {};
    if (params.category) {
      query = query.eq("category", params.category);
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
      profiles: undefined,
    }));

    return response(200, { posts });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
