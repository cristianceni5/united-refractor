const { getSupabaseClient, getSupabaseAdmin, headers, response } = require("../../lib/supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "POST") {
    return response(405, { error: "Metodo non consentito" });
  }

  try {
    const { email, otp, type } = JSON.parse(event.body);

    if (!email || !otp) {
      return response(400, { error: "Email e codice OTP sono obbligatori" });
    }

    const validTypes = ["signup", "recovery"];
    const otpType = validTypes.includes(type) ? type : "signup";

    const supabase = getSupabaseClient();

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: otpType,
    });

    if (error) {
      return response(400, { error: "Codice OTP non valido o scaduto" });
    }

    if (!data.session) {
      return response(400, { error: "Verifica non riuscita, riprova" });
    }

    // Per signup: verifica che il profilo esista
    if (otpType === "signup" && data.user) {
      const admin = getSupabaseAdmin();
      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .single();

      if (!profile) {
        // Crea profilo se non esiste (fallback)
        const meta = data.user.user_metadata || {};
        await admin.from("profiles").upsert({
          id: data.user.id,
          email: data.user.email,
          full_name: meta.full_name || data.user.email.split("@")[0],
          school_id: meta.school_id || null,
          role: "studente",
        });
      }
    }

    return response(200, {
      message: otpType === "signup" ? "Email verificata con successo!" : "Codice verificato!",
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: data.user,
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return response(500, { error: "Errore interno del server" });
  }
};
