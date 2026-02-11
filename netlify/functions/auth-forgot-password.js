const { getSupabaseClient, headers, response } = require("../../lib/supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "POST") {
    return response(405, { error: "Metodo non consentito" });
  }

  try {
    const { email } = JSON.parse(event.body);

    if (!email) {
      return response(400, { error: "L'email è obbligatoria" });
    }

    const supabase = getSupabaseClient();

    // Invia email di recupero password con OTP code
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      console.error("Forgot password error:", error);
      // Non rivelare se l'email esiste o no (sicurezza)
    }

    // Rispondi sempre con successo per sicurezza
    return response(200, {
      message: "Se l'email è registrata, riceverai un codice di recupero.",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    return response(500, { error: "Errore interno del server" });
  }
};
