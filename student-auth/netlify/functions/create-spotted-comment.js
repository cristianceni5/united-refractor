const { extractToken, getUserFromToken, getSupabaseAdmin, headers, response } = require("./_shared/supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "POST") {
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

    const { spotted_id, body } = JSON.parse(event.body);

    if (!spotted_id || !body || !body.trim()) {
      return response(400, { error: "spotted_id e body sono obbligatori" });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("spotted_comments")
      .insert({
        spotted_id,
        author_id: user.id,
        body: body.trim(),
      })
      .select("id, spotted_id, body, created_at")
      .single();

    if (error) {
      return response(400, { error: error.message });
    }

    return response(201, { comment: { ...data, is_own: true } });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
