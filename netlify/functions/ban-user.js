const { extractToken, getUserFromToken, getUserProfile, getSupabaseAdmin, headers, response } = require("../../lib/supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "PUT") {
    return response(405, { error: "Metodo non consentito" });
  }

  try {
    const token = extractToken(event);
    if (!token) {
      return response(401, { error: "Non autenticato" });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return response(401, { error: "Token non valido" });
    }

    const profile = await getUserProfile(user.id);
    if (!profile || profile.role !== "admin") {
      return response(403, { error: "Solo gli amministratori possono bannare utenti" });
    }

    const { user_id, action, duration_hours, reason } = JSON.parse(event.body);

    if (!user_id || !action) {
      return response(400, { error: "user_id e action sono obbligatori" });
    }

    // Non puoi bannare te stesso
    if (user_id === user.id) {
      return response(400, { error: "Non puoi bannare te stesso" });
    }

    // Non puoi bannare un altro admin
    const targetProfile = await getUserProfile(user_id);
    if (!targetProfile) {
      return response(404, { error: "Utente non trovato" });
    }
    if (targetProfile.role === "admin") {
      return response(403, { error: "Non puoi bannare un altro amministratore" });
    }

    const admin = getSupabaseAdmin();
    let banned_until = null;

    if (action === "ban") {
      // Ban permanente: data lontanissima
      banned_until = "2099-12-31T23:59:59Z";
    } else if (action === "kick") {
      // Kick temporaneo
      const hours = parseInt(duration_hours) || 24;
      banned_until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    } else if (action === "unban") {
      banned_until = null;
    } else {
      return response(400, { error: "action deve essere 'ban', 'kick' o 'unban'" });
    }

    const { data, error } = await admin
      .from("profiles")
      .update({
        banned_until,
        ban_reason: action === "unban" ? null : (reason || null),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user_id)
      .select()
      .single();

    if (error) {
      return response(400, { error: error.message });
    }

    const messages = {
      ban: "Utente bannato permanentemente",
      kick: `Utente sospeso per ${duration_hours || 24} ore`,
      unban: "Ban rimosso",
    };

    return response(200, { profile: data, message: messages[action] });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
