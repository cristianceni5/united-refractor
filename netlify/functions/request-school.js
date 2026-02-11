const { getSupabaseAdmin, extractToken, getUserFromToken, headers, response } = require("../../lib/supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "POST") {
    return response(405, { error: "Metodo non consentito" });
  }

  try {
    const token = extractToken(event);
    if (!token) return response(401, { error: "Non autenticato" });
    const user = await getUserFromToken(token);
    if (!user) {
      return response(401, { error: "Non autenticato" });
    }

    const { name, city, province, address } = JSON.parse(event.body);

    if (!name || !city) {
      return response(400, { error: "Nome scuola e città sono obbligatori" });
    }

    const admin = getSupabaseAdmin();

    // Controlla se esiste già una richiesta pendente per la stessa scuola+città da questo utente
    const { data: existing } = await admin
      .from("school_requests")
      .select("id")
      .eq("requested_by", user.id)
      .eq("status", "pending")
      .ilike("name", name.trim())
      .ilike("city", city.trim())
      .maybeSingle();

    if (existing) {
      return response(400, { error: "Hai già inviato una richiesta per questa scuola. Attendi la revisione." });
    }

    // Controlla se la scuola esiste già nel sistema
    const { data: existingSchool } = await admin
      .from("schools")
      .select("id, name")
      .ilike("name", name.trim())
      .ilike("city", city.trim())
      .maybeSingle();

    if (existingSchool) {
      return response(400, { error: `La scuola "${existingSchool.name}" esiste già! Selezionala dalla lista.` });
    }

    // Crea la richiesta
    const { data: req, error: insertErr } = await admin
      .from("school_requests")
      .insert({
        name: name.trim(),
        city: city.trim(),
        province: province ? province.trim().toUpperCase() : null,
        address: address ? address.trim() : null,
        requested_by: user.id,
        status: "pending",
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Insert school request error:", insertErr);
      return response(500, { error: "Errore nell'invio della richiesta" });
    }

    return response(200, {
      message: "Richiesta inviata! Un amministratore la esaminerà al più presto.",
      request: req,
    });
  } catch (err) {
    console.error("Request school error:", err);
    return response(500, { error: "Errore interno del server" });
  }
};
