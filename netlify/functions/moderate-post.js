const { extractToken, getUserFromToken, getUserProfile, getSupabaseAdmin, headers, response } = require("../../lib/supabase");

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
    if (!profile || !['admin', 'co_admin'].includes(profile.role)) {
      return response(403, { error: "Solo admin e co-admin possono moderare i post" });
    }

    const { post_id, status } = JSON.parse(event.body);

    if (!post_id || !status) {
      return response(400, { error: "post_id e status sono obbligatori" });
    }

    if (!["approved", "rejected"].includes(status)) {
      return response(400, { error: "Status deve essere 'approved' o 'rejected'" });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("posts")
      .update({ status })
      .eq("id", post_id)
      .select("id, title, category, status, discount, created_at")
      .single();

    if (error) {
      return response(400, { error: error.message });
    }

    return response(200, { post: data });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
