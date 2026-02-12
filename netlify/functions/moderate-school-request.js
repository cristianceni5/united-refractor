const { getSupabaseAdmin, extractToken, getUserFromToken, getUserProfile, headers, response } = require("../../lib/supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "PUT") {
    return response(405, { error: "Metodo non consentito" });
  }

  try {
    const token = extractToken(event);
    if (!token) return response(401, { error: "Non autenticato" });
    const user = await getUserFromToken(token);
    if (!user) {
      return response(401, { error: "Non autenticato" });
    }

    const admin = getSupabaseAdmin();

    // Solo admin/co_admin
    const profile = await getUserProfile(user.id);
    if (!profile || !["admin", "co_admin"].includes(profile.role)) {
      return response(403, { error: "Non autorizzato" });
    }

    const { request_id, action } = JSON.parse(event.body);

    if (!request_id || !["approved", "rejected"].includes(action)) {
      return response(400, { error: "Parametri non validi" });
    }

    // Recupera la richiesta
    const { data: req, error: reqErr } = await admin
      .from("school_requests")
      .select("*")
      .eq("id", request_id)
      .eq("status", "pending")
      .single();

    if (reqErr || !req) {
      return response(404, { error: "Richiesta non trovata o già gestita" });
    }

    if (action === "approved") {
      // Crea la scuola
      const { data: newSchool, error: schoolErr } = await admin
        .from("schools")
        .insert({
          name: req.name,
          city: req.city,
          province: req.province,
          address: req.address,
        })
        .select()
        .single();

      if (schoolErr) {
        console.error("Create school from request error:", schoolErr);
        return response(500, { error: "Errore nella creazione della scuola" });
      }

      // Aggiorna la richiesta con lo status e l'id della scuola creata
      const { error: updateReqErr } = await admin
        .from("school_requests")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          school_id: newSchool.id,
        })
        .eq("id", request_id);

      if (updateReqErr) {
        console.error("Update request error:", updateReqErr);
        return response(500, { error: "Errore nell'aggiornamento della richiesta" });
      }

      // Assegna automaticamente la scuola al richiedente se non ne ha una
      const { data: requesterProfile } = await admin
        .from("profiles")
        .select("school_id")
        .eq("id", req.requested_by)
        .single();

      if (requesterProfile && !requesterProfile.school_id) {
        const { error: assignErr } = await admin
          .from("profiles")
          .update({ school_id: newSchool.id, updated_at: new Date().toISOString() })
          .eq("id", req.requested_by);

        if (assignErr) {
          console.error("Assign school error:", assignErr);
        }
      }

      return response(200, {
        message: `Scuola "${req.name}" approvata e creata!`,
        school: newSchool,
      });
    } else {
      // Rejected
      const { error: rejectErr } = await admin
        .from("school_requests")
        .update({
          status: "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", request_id);

      if (rejectErr) {
        console.error("Reject request error:", rejectErr);
        return response(500, { error: "Errore nel rifiuto della richiesta" });
      }

      return response(200, {
        message: `Richiesta per "${req.name}" rifiutata.`,
      });
    }
  } catch (err) {
    console.error("Moderate school request error:", err);
    return response(500, { error: "Errore interno del server" });
  }
};
