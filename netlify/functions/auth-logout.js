const { getSupabaseWithToken, extractToken, headers, response } = require("./_shared/supabase");

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
      return response(401, { error: "Token mancante" });
    }

    const supabase = getSupabaseWithToken(token);
    const { error } = await supabase.auth.signOut();

    if (error) {
      return response(400, { error: error.message });
    }

    return response(200, { message: "Logout effettuato" });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
