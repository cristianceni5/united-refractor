const { getSupabaseAdmin, headers, response } = require("../../lib/supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "POST") {
    return response(405, { error: "Metodo non consentito" });
  }

  try {
    const { access_token, refresh_token } = JSON.parse(event.body);

    if (!access_token) {
      return response(400, { error: "Token mancante" });
    }

    const admin = getSupabaseAdmin();

    // Verifica il token e ottieni l'utente
    const { data: { user }, error: userError } = await admin.auth.getUser(access_token);

    if (userError || !user) {
      return response(401, { error: "Token non valido" });
    }

    // Controlla se il profilo esiste già
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!existingProfile) {
      // Crea profilo per utenti OAuth
      const fullName = user.user_metadata?.full_name
        || user.user_metadata?.name
        || `${user.user_metadata?.given_name || ""} ${user.user_metadata?.family_name || ""}`.trim()
        || user.email?.split("@")[0]
        || "Utente";

      const { error: profileError } = await admin
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email,
          full_name: fullName,
          role: "studente",
          school_id: null, // Lo sceglierà dopo
        });

      if (profileError) {
        console.error("Profile creation error:", profileError);
        return response(200, {
          user,
          needsSchool: true,
          message: "Login effettuato, ma non siamo riusciti a creare il profilo.",
        });
      }

      return response(200, {
        user,
        needsSchool: true,
        message: "Benvenuto! Seleziona la tua scuola per completare la registrazione.",
      });
    }

    // Controlla se è bannato
    if (existingProfile.banned_until && new Date(existingProfile.banned_until) > new Date()) {
      const until = new Date(existingProfile.banned_until);
      const isPermanent = until.getFullYear() >= 2099;
      const reason = existingProfile.ban_reason ? ` Motivo: ${existingProfile.ban_reason}` : "";
      const msg = isPermanent
        ? `Il tuo account è stato bannato permanentemente.${reason}`
        : `Il tuo account è sospeso fino al ${until.toLocaleString("it-IT")}.${reason}`;
      return response(403, { error: msg });
    }

    // Controlla se manca la scuola
    const needsSchool = !existingProfile.school_id;

    return response(200, {
      user,
      needsSchool,
    });
  } catch (err) {
    console.error("Auth verify error:", err);
    return response(500, { error: "Errore interno del server" });
  }
};
