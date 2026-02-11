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
    if (!profile || !["admin", "co_admin", "rappresentante"].includes(profile.role)) {
      return response(403, { error: "Accesso negato" });
    }

    const admin = getSupabaseAdmin();
    let query = admin.from("profiles").select("*").order("full_name");

    const params = event.queryStringParameters || {};
    if (params.role) {
      query = query.eq("role", params.role);
    }
    if (params.classe) {
      query = query.eq("classe", params.classe);
    }

    const { data, error } = await query;

    if (error) {
      return response(400, { error: error.message });
    }

    return response(200, { users: data });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
