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
    const schoolId = params.id;

    if (!schoolId) {
      return response(400, { error: "ID scuola mancante" });
    }

    const admin = getSupabaseAdmin();

    // Fetch school
    const { data: school, error } = await admin
      .from("schools")
      .select("*")
      .eq("id", schoolId)
      .single();

    if (error || !school) {
      return response(404, { error: "Scuola non trovata" });
    }

    // Count students in this school
    const { count: studentsCount } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId);

    // Count posts from this school
    const { count: postsCount } = await admin
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId);

    // Get recent members (max 12)
    const { data: members } = await admin
      .from("profiles")
      .select("id, full_name, avatar_url, role, classe, sezione")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(12);

    return response(200, {
      school: {
        ...school,
        students_count: studentsCount || 0,
        posts_count: postsCount || 0,
        members: members || [],
      },
    });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
