const { getSupabaseAdmin, headers, response } = require("../../lib/supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "GET") {
    return response(405, { error: "Metodo non consentito" });
  }

  try {
    // Debug: controlla se le env vars sono impostate
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("ENV VARS MISSING:", {
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      });
      return response(500, { error: "Configurazione server mancante: variabili d'ambiente non impostate" });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("schools")
      .select("*")
      .order("name");

    if (error) {
      return response(400, { error: error.message });
    }

    return response(200, { schools: data });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
