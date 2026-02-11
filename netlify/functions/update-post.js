const { extractToken, getUserFromToken, getUserProfile, getSupabaseAdmin, headers, response } = require("./_shared/supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "PUT") {
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

    const { post_id, title, body, image_url, category, pinned } = JSON.parse(event.body);

    if (!post_id) {
      return response(400, { error: "post_id obbligatorio" });
    }

    const admin = getSupabaseAdmin();

    // Verifica che il post esista e che l'utente sia autore o admin
    const { data: existingPost, error: fetchError } = await admin
      .from("posts")
      .select("*")
      .eq("id", post_id)
      .single();

    if (fetchError || !existingPost) {
      return response(404, { error: "Post non trovato" });
    }

    if (existingPost.author_id !== user.id && profile.role !== "admin") {
      return response(403, { error: "Puoi modificare solo i tuoi post" });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (body !== undefined) updates.body = body;
    if (image_url !== undefined) updates.image_url = image_url;
    if (category !== undefined) updates.category = category;
    if (pinned !== undefined) updates.pinned = pinned;

    const { data, error } = await admin
      .from("posts")
      .update(updates)
      .eq("id", post_id)
      .select()
      .single();

    if (error) {
      return response(400, { error: error.message });
    }

    return response(200, { post: data });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
