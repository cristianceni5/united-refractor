const { getSupabaseClient, getSupabaseAdmin, headers, response } = require("../../lib/supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "POST") {
    return response(405, { error: "Metodo non consentito" });
  }

  try {
    const { email, otp, new_password } = JSON.parse(event.body);

    if (!email || !otp || !new_password) {
      return response(400, { error: "Email, codice OTP e nuova password sono obbligatori" });
    }

    if (new_password.length < 6) {
      return response(400, { error: "La password deve essere di almeno 6 caratteri" });
    }

    const supabase = getSupabaseClient();

    // Verifica OTP di tipo recovery
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "recovery",
    });

    if (error || !data.session) {
      return response(400, { error: "Codice OTP non valido o scaduto" });
    }

    // Aggiorna la password usando il token della sessione appena ottenuta
    const admin = getSupabaseAdmin();
    const { error: updateError } = await admin.auth.admin.updateUserById(
      data.user.id,
      { password: new_password }
    );

    if (updateError) {
      console.error("Reset password error:", updateError);
      return response(500, { error: "Errore durante il reset della password" });
    }

    return response(200, {
      message: "Password reimpostata con successo! Ora puoi accedere.",
    });
  } catch (err) {
    console.error("Reset password error:", err);
    return response(500, { error: "Errore interno del server" });
  }
};
