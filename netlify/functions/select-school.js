const { getSupabaseAdmin, extractToken, getUserFromToken, headers, response } = require("../../lib/supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "PUT") {
    return response(405, { error: "Metodo non consentito" });
  }

  try {
    const token = extractToken(event);
    if (!token) return response(401, { error: "Non autenticato" });
    const user = await getUserFromToken(token);
    if (!user) {
      return response(401, { error: "Non autenticato" });
    }

    const { school_id } = JSON.parse(event.body);

    if (!school_id) {
      return response(400, { error: "Seleziona una scuola" });
    }

    // Admin e co_admin non hanno una scuola di appartenenza
    const admin = getSupabaseAdmin();
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (callerProfile && ['admin', 'co_admin'].includes(callerProfile.role)) {
      return response(403, { error: "Gli amministratori non hanno una scuola di appartenenza" });
    }

    // Verifica che la scuola esista
    const { data: school, error: schoolErr } = await admin
      .from("schools")
      .select("id, name")
      .eq("id", school_id)
      .single();

    if (schoolErr || !school) {
      return response(404, { error: "Scuola non trovata" });
    }

    // Aggiorna il profilo con la scuola selezionata
    const { error: updateErr } = await admin
      .from("profiles")
      .update({ school_id, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (updateErr) {
      return response(500, { error: "Errore nell'aggiornamento del profilo" });
    }

    return response(200, {
      message: `Scuola "${school.name}" selezionata con successo!`,
      school_id,
    });
  } catch (err) {
    console.error("Select school error:", err);
    return response(500, { error: "Errore interno del server" });
  }
};
