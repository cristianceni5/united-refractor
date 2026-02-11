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
    if (!profile || !['admin', 'rappresentante'].includes(profile.role)) {
      return response(403, { error: "Solo amministratori e rappresentanti possono modificare scuole" });
    }

    const { school_id, name, city, address, province, description, logo_url } = JSON.parse(event.body);

    if (!school_id) {
      return response(400, { error: "ID scuola obbligatorio" });
    }

    if (!name || !city) {
      return response(400, { error: "Nome e città sono obbligatori" });
    }

    const admin = getSupabaseAdmin();

    const updateData = { name, city };
    if (address !== undefined) updateData.address = address || null;
    if (province !== undefined) updateData.province = province || null;
    if (description !== undefined) updateData.description = description || null;
    if (logo_url !== undefined) updateData.logo_url = logo_url || null;

    const { data, error } = await admin
      .from("schools")
      .update(updateData)
      .eq("id", school_id)
      .select()
      .single();

    if (error) {
      return response(400, { error: error.message });
    }

    return response(200, { school: data, message: "Scuola aggiornata con successo!" });
  } catch (err) {
    console.error("Update school error:", err);
    return response(500, { error: "Errore interno del server" });
  }
};
