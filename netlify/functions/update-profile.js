const { extractToken, getUserFromToken, getSupabaseAdmin, headers, response } = require("../../lib/supabase");

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

    const { full_name, classe, sezione, bio, avatar_url } = JSON.parse(event.body);

    const updates = { updated_at: new Date().toISOString() };
    if (full_name !== undefined) updates.full_name = full_name;
    if (classe !== undefined) updates.classe = classe;
    if (sezione !== undefined) updates.sezione = sezione;
    if (bio !== undefined) updates.bio = bio;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      return response(400, { error: error.message });
    }

    return response(200, { profile: data });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
