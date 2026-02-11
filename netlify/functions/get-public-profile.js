const { extractToken, getUserFromToken, getSupabaseAdmin, headers, response } = require("../../lib/supabase");

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

    const params = event.queryStringParameters || {};
    const userId = params.id;

    if (!userId) {
      return response(400, { error: "ID utente mancante" });
    }

    const admin = getSupabaseAdmin();

    // Fetch profile with school info
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, full_name, email, role, classe, sezione, bio, avatar_url, school_id, created_at")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      return response(404, { error: "Profilo non trovato" });
    }

    // Fetch school name if exists
    let school = null;
    if (profile.school_id) {
      const { data: schoolData } = await admin
        .from("schools")
        .select("id, name, city, province, logo_url")
        .eq("id", profile.school_id)
        .single();
      school = schoolData || null;
    }

    // Count user's posts
    const { count: postsCount } = await admin
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId);

    return response(200, {
      profile: {
        ...profile,
        school,
        posts_count: postsCount || 0,
      },
    });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
