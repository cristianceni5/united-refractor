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
    if (!token) return response(401, { error: "Non autenticato" });
    const user = await getUserFromToken(token);
    if (!user) {
      return response(401, { error: "Non autenticato" });
    }

    // Solo admin/co_admin possono vedere le richieste
    const profile = await getUserProfile(user.id);
    if (!profile || !["admin", "co_admin"].includes(profile.role)) {
      return response(403, { error: "Non autorizzato" });
    }

    const admin = getSupabaseAdmin();

    const status = event.queryStringParameters?.status || "pending";

    const { data: requests, error } = await admin
      .from("school_requests")
      .select(`
        *,
        requester:profiles!requested_by(full_name, email, avatar_url)
      `)
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Get school requests error:", error);
      return response(500, { error: "Errore nel recupero delle richieste" });
    }

    return response(200, { requests: requests || [] });
  } catch (err) {
    console.error("Get school requests error:", err);
    return response(500, { error: "Errore interno del server" });
  }
};
