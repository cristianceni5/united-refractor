const { extractToken, getUserFromToken, getUserProfile, getSupabaseAdmin, headers, response } = require("../../lib/supabase");

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

    const profile = await getUserProfile(user.id);
    if (!profile) {
      return response(403, { error: "Profilo non trovato" });
    }

    const { title, body, image_url, category, pinned, discount } = JSON.parse(event.body);

    if (!title || !body) {
      return response(400, { error: "Titolo e corpo sono obbligatori" });
    }

    const isConvenzione = category === "convenzione";

    // Solo admin/co_admin/rappresentante possono creare post
    if (!["admin", "co_admin", "rappresentante"].includes(profile.role)) {
      return response(403, { error: "Solo admin, co-admin e rappresentanti possono creare post" });
    }

    // Admin e co_admin possono creare post globali (senza scuola)
    // Le convenzioni sono sempre globali
    const isGlobal = ['admin', 'co_admin'].includes(profile.role) || isConvenzione;
    if (!isGlobal && !profile.school_id) {
      return response(400, { error: "Nessuna scuola associata al profilo" });
    }

    const postStatus = "approved";

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("posts")
      .insert({
        school_id: isGlobal ? null : profile.school_id,
        author_id: user.id,
        title,
        body,
        image_url: image_url || null,
        category: category || "altro",
        pinned: pinned || false,
        status: postStatus,
        discount: isConvenzione && discount ? discount : null,
      })
      .select()
      .single();

    if (error) {
      return response(400, { error: error.message });
    }

    return response(201, { post: data });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
