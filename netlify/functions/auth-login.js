const { getSupabaseClient, getSupabaseAdmin, headers, response } = require("../../lib/supabase");

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
      if (error.message && error.message.toLowerCase().includes("email not confirmed")) {
        return response(401, { error: "Email non ancora verificata. Controlla la tua casella di posta (anche lo spam) per il codice di verifica." });
      }
      return response(401, { error: "Credenziali non valide" });
    }

    // Controlla se l'utente e' bannato
    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from("profiles")
      .select("banned_until, ban_reason")
      .eq("id", data.user.id)
      .single();

    if (profile && profile.banned_until && new Date(profile.banned_until) > new Date()) {
      const until = new Date(profile.banned_until);
      const isPermanent = until.getFullYear() >= 2099;
      const reason = profile.ban_reason ? ` Motivo: ${profile.ban_reason}` : "";
      const msg = isPermanent
        ? `Il tuo account e' stato bannato permanentemente.${reason}`
        : `Il tuo account e' sospeso fino al ${until.toLocaleString("it-IT")}.${reason}`;
      return response(403, { error: msg });
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
