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
    if (!profile || profile.role !== "admin") {
      return response(403, { error: "Solo gli amministratori possono moderare gli spotted" });
    }

    const { spotted_id, status } = JSON.parse(event.body);

    if (!spotted_id || !status) {
      return response(400, { error: "spotted_id e status sono obbligatori" });
    }

    if (!["approved", "rejected"].includes(status)) {
      return response(400, { error: "Status deve essere 'approved' o 'rejected'" });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("spotted")
      .update({ status })
      .eq("id", spotted_id)
      .select("id, body, status, likes_count, created_at")
      .single();

    if (error) {
      return response(400, { error: error.message });
    }

    return response(200, { spotted: data });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
