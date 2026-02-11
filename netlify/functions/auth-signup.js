const { getSupabaseAdmin, headers, response } = require("../../lib/supabase");

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

    const supabase = getSupabaseAdmin();

    // 1. Crea utente in auth.users tramite admin API
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name, school_id },
      email_confirm: true,
    });

    if (error) {
      return response(400, { error: error.message });
    }

    // 2. Crea profilo manualmente in profiles (bypass del trigger)
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: data.user.id,
        email: email,
        full_name: full_name,
        school_id: school_id,
        role: "studente",
      });

    if (profileError) {
      // Se il profilo fallisce, elimina l'utente creato per non lasciare orfani
      await supabase.auth.admin.deleteUser(data.user.id);
      return response(500, { error: "Errore nella creazione del profilo: " + profileError.message });
    }

    // 3. Effettua il login per ottenere la sessione
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return response(200, {
      message: "Registrazione completata con successo.",
      user: data.user,
      session: loginData?.session || null,
    });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
