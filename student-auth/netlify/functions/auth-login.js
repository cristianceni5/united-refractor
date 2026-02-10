const { getSupabaseClient, headers, response } = require("./_shared/supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "POST") {
    return response(405, { error: "Metodo non consentito" });
  }

  try {
    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return response(400, { error: "Email e password sono obbligatori" });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return response(401, { error: "Credenziali non valide" });
    }

    return response(200, {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: data.user,
    });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
