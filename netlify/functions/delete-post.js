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
    if (!profile || !["admin", "rappresentante"].includes(profile.role)) {
      return response(403, { error: "Accesso negato" });
    }

    const { post_id } = JSON.parse(event.body);

    if (!post_id) {
      return response(400, { error: "post_id obbligatorio" });
    }

    const admin = getSupabaseAdmin();

    // Verifica che il post esista
    const { data: existingPost, error: fetchError } = await admin
      .from("posts")
      .select("author_id")
      .eq("id", post_id)
      .single();

    if (fetchError || !existingPost) {
      return response(404, { error: "Post non trovato" });
    }

    if (existingPost.author_id !== user.id && profile.role !== "admin") {
      return response(403, { error: "Puoi eliminare solo i tuoi post" });
    }

    const { error } = await admin
      .from("posts")
      .delete()
      .eq("id", post_id);

    if (error) {
      return response(400, { error: error.message });
    }

    return response(200, { message: "Post eliminato" });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
