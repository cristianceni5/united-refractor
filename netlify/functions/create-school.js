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
    if (!profile || !['admin', 'co_admin', 'rappresentante'].includes(profile.role)) {
      return response(403, { error: "Solo admin, co-admin e rappresentanti possono creare scuole" });
    }

    const { name, city, address, province, description, logo_url } = JSON.parse(event.body);

    if (!name || !city) {
      return response(400, { error: "Nome e citta sono obbligatori" });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("schools")
      .insert({ name, city, address, province, description: description || null, logo_url: logo_url || null })
      .select()
      .single();

    if (error) {
      return response(400, { error: error.message });
    }

    return response(201, { school: data });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
