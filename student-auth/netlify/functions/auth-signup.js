const { getSupabaseClient, headers, response } = require("./_shared/supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "POST") {
    return response(405, { error: "Metodo non consentito" });
  }

  try {
    const { email, password, full_name, school_id } = JSON.parse(event.body);

    if (!email || !password || !full_name || !school_id) {
      return response(400, { error: "Email, password, nome completo e scuola sono obbligatori" });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, school_id },
      },
    });

    if (error) {
      return response(400, { error: error.message });
    }

    return response(200, {
      message: "Registrazione completata. Controlla la tua email per confermare l'account.",
      user: data.user,
      session: data.session,
    });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
