const { extractToken, getUserFromToken, getUserProfile, getSupabaseAdmin, headers, response } = require("../../lib/supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "DELETE") {
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
      return response(400, { error: "Profilo non trovato" });
    }

    const { comment_id } = JSON.parse(event.body);

    if (!comment_id) {
      return response(400, { error: "comment_id obbligatorio" });
    }

    const admin = getSupabaseAdmin();

    const { data: existing, error: fetchError } = await admin
      .from("spotted_comments")
      .select("author_id")
      .eq("id", comment_id)
      .single();

    if (fetchError || !existing) {
      return response(404, { error: "Commento non trovato" });
    }

    if (existing.author_id !== user.id && profile.role !== "admin") {
      return response(403, { error: "Non puoi eliminare questo commento" });
    }

    const { error } = await admin
      .from("spotted_comments")
      .delete()
      .eq("id", comment_id);

    if (error) {
      return response(400, { error: error.message });
    }

    return response(200, { message: "Commento eliminato" });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
