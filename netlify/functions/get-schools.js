const { getSupabaseAdmin, headers, response } = require("./_shared/supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "GET") {
    return response(405, { error: "Metodo non consentito" });
  }

  try {
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
