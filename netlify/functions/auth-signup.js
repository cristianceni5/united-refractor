const { getSupabaseAdmin, getSupabaseClient, headers, response } = require("../../lib/supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "POST") {
    return response(405, { error: "Metodo non consentito" });
  }

  try {
    const { email, password, full_name, nickname } = JSON.parse(event.body);

    if (!email || !password || !full_name || !nickname) {
      return response(400, { error: "Email, password, nome completo e nickname sono obbligatori" });
    }

    // Valida nickname
    if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(nickname)) {
      return response(400, { error: "Nickname non valido (3-24 caratteri, lettere, numeri, _ . -)" });
    }

    // Controlla unicità nickname
    const admin0 = getSupabaseAdmin();
    const { data: existingNick } = await admin0
      .from("profiles")
      .select("id")
      .eq("nickname", nickname.toLowerCase())
      .maybeSingle();
    if (existingNick) {
      return response(400, { error: "Questo nickname è già in uso" });
    }

    const supabase = getSupabaseClient();

    // Usa signUp standard con email verification
    // Salva nickname e full_name nei user_metadata per creare il profilo dopo la verifica OTP
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, nickname: nickname.toLowerCase() },
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
        nickname: nickname.toLowerCase(),
        school_id: null,
        role: "studente",
      });

      return response(200, {
        message: "Registrazione completata!",
        user: data.user,
        session: data.session,
      });
    }

    // NON creare il profilo ora — verrà creato dopo la verifica OTP
    // I dati (full_name, nickname) sono salvati nei user_metadata di auth.users

    return response(200, {
      message: "Ti abbiamo inviato un'email di verifica! Controlla la tua casella di posta.",
      requiresConfirmation: true,
    });
  } catch (err) {
    console.error("Signup error:", err);
    return response(500, { error: "Errore interno del server" });
  }
};
