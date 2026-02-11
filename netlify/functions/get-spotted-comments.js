const { extractToken, getUserFromToken, getSupabaseAdmin, headers, response } = require("./_shared/supabase");

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
    const spotted_id = params.spotted_id;

    if (!spotted_id) {
      return response(400, { error: "spotted_id obbligatorio" });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("spotted_comments")
      .select("id, spotted_id, author_id, body, created_at")
      .eq("spotted_id", spotted_id)
      .order("created_at", { ascending: true });

    if (error) {
      return response(400, { error: error.message });
    }

    // Rimuovi author_id, aggiungi is_own
    const comments = data.map((c) => ({
      id: c.id,
      spotted_id: c.spotted_id,
      body: c.body,
      created_at: c.created_at,
      is_own: c.author_id === user.id,
    }));

    return response(200, { comments });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
