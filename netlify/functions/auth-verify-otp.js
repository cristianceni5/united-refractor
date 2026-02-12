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

    // Per signup: crea il profilo ORA che l'email è verificata
    if (otpType === "signup" && data.user) {
      const admin = getSupabaseAdmin();
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!existingProfile) {
        const meta = data.user.user_metadata || {};
        let nickname = meta.nickname || data.user.email.split("@")[0].toLowerCase();

        // Safety check: unicità nickname (raro, ma possibile in caso di race condition)
        const { data: nickTaken } = await admin
          .from("profiles")
          .select("id")
          .eq("nickname", nickname)
          .maybeSingle();

        if (nickTaken) {
          nickname = nickname + "_" + Math.random().toString(36).slice(2, 6);
        }

        await admin.from("profiles").insert({
          id: data.user.id,
          email: data.user.email,
          full_name: meta.full_name || data.user.email.split("@")[0],
          nickname: nickname,
          school_id: null,
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
