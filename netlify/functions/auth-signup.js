const { getSupabaseAdmin, getSupabaseClient, headers, response } = require("../../lib/supabase");

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

    // Usa signUp standard con email verification
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, school_id },
        emailRedirectTo: `${process.env.URL || 'http://localhost:8888'}/auth-callback.html`,
      },
    });

    if (error) {
      return response(400, { error: error.message });
    }

    // Se l'utente è già confermato (in dev con auto-confirm)
    if (data.session) {
      const admin = getSupabaseAdmin();
      // Crea profilo
      await admin.from("profiles").upsert({
        id: data.user.id,
        email: email,
        full_name: full_name,
        school_id: school_id,
        role: "studente",
      });

      return response(200, {
        message: "Registrazione completata!",
        user: data.user,
        session: data.session,
      });
    }

    // Email non ancora confermata - crea profilo in anticipo
    if (data.user) {
      const admin = getSupabaseAdmin();
      await admin.from("profiles").upsert({
        id: data.user.id,
        email: email,
        full_name: full_name,
        school_id: school_id,
        role: "studente",
      });
    }

    return response(200, {
      message: "Ti abbiamo inviato un'email di verifica! Controlla la tua casella di posta.",
      requiresConfirmation: true,
    });
  } catch (err) {
    console.error("Signup error:", err);
    return response(500, { error: "Errore interno del server" });
  }
};
