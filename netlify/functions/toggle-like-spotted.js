const { extractToken, getUserFromToken, getUserProfile, getSupabaseAdmin, isBanned, getBanMessage, headers, response } = require("./_shared/supabase");

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
    if (profile && isBanned(profile)) {
      return response(403, { error: getBanMessage(profile) });
    }

    const { spotted_id } = JSON.parse(event.body);

    if (!spotted_id) {
      return response(400, { error: "spotted_id obbligatorio" });
    }

    const admin = getSupabaseAdmin();

    // Controlla se il like esiste gia'
    const { data: existing } = await admin
      .from("spotted_likes")
      .select("id")
      .eq("spotted_id", spotted_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      // Rimuovi like
      await admin
        .from("spotted_likes")
        .delete()
        .eq("id", existing.id);

      // Recupera il conteggio aggiornato
      const { data: spotted } = await admin
        .from("spotted")
        .select("likes_count")
        .eq("id", spotted_id)
        .single();

      return response(200, { liked: false, likes_count: spotted?.likes_count || 0 });
    } else {
      // Aggiungi like
      await admin
        .from("spotted_likes")
        .insert({ spotted_id, user_id: user.id });

      const { data: spotted } = await admin
        .from("spotted")
        .select("likes_count")
        .eq("id", spotted_id)
        .single();

      return response(200, { liked: true, likes_count: spotted?.likes_count || 0 });
    }
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
