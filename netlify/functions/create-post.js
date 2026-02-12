const { extractToken, getUserFromToken, getUserProfile, getSupabaseAdmin, headers, response } = require("../../lib/supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "POST") {
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
    if (!profile) {
      return response(403, { error: "Profilo non trovato" });
    }

    const { title, body, image_url, category, pinned, discount, target_global, target_school_ids } = JSON.parse(event.body);

    if (!title || !body) {
      return response(400, { error: "Titolo e corpo sono obbligatori" });
    }

    const normalizedCategory = category || "altro";
    const isConvenzione = normalizedCategory === "convenzione";
    const isAdminOrCoAdmin = ["admin", "co_admin"].includes(profile.role);

    // Solo admin/co_admin/rappresentante possono creare post
    if (!["admin", "co_admin", "rappresentante"].includes(profile.role)) {
      return response(403, { error: "Solo admin, co-admin e rappresentanti possono creare post" });
    }

    const requestedGlobal = target_global === true;
    const requestedSchoolIds = Array.isArray(target_school_ids)
      ? [...new Set(target_school_ids
        .filter((id) => typeof id === "string" && id.trim())
        .map((id) => id.trim()))]
      : [];

    let destinationSchoolIds = [];
    let isGlobal = false;

    if (isAdminOrCoAdmin) {
      if (requestedGlobal) {
        isGlobal = true;
      } else if (target_global === false) {
        if (requestedSchoolIds.length === 0) {
          return response(400, { error: "Seleziona almeno una scuola di destinazione o imposta Globale" });
        }
        destinationSchoolIds = requestedSchoolIds;
      } else {
        // Compatibilità con client vecchi: admin/co_admin senza campo destinazione => globale
        isGlobal = true;
      }
    } else if (profile.role === "rappresentante" && isConvenzione) {
      if (requestedGlobal) {
        isGlobal = true;
      } else if (target_global === false) {
        if (requestedSchoolIds.length === 0) {
          return response(400, { error: "Seleziona almeno una scuola di destinazione o imposta Globale" });
        }
        destinationSchoolIds = requestedSchoolIds;
      } else {
        // Compatibilità con client vecchi: convenzioni rappresentante senza campo destinazione => globale
        isGlobal = true;
      }
    } else {
      if (!profile.school_id) {
        return response(400, { error: "Nessuna scuola associata al profilo" });
      }
      destinationSchoolIds = [profile.school_id];
    }

    if (!isGlobal && destinationSchoolIds.length > 0) {
      const admin = getSupabaseAdmin();
      const { data: schools, error: schoolsError } = await admin
        .from("schools")
        .select("id")
        .in("id", destinationSchoolIds);

      if (schoolsError) {
        return response(400, { error: schoolsError.message });
      }

      if (!schools || schools.length !== destinationSchoolIds.length) {
        return response(400, { error: "Una o più scuole di destinazione non sono valide" });
      }
    }

    const postStatus = "approved";

    const admin = getSupabaseAdmin();
    const insertRows = isGlobal
      ? [{
          school_id: null,
          author_id: user.id,
          title,
          body,
          image_url: image_url || null,
          category: normalizedCategory,
          pinned: pinned || false,
          status: postStatus,
          discount: isConvenzione && discount ? discount : null,
        }]
      : destinationSchoolIds.map((schoolId) => ({
          school_id: schoolId,
          author_id: user.id,
          title,
          body,
          image_url: image_url || null,
          category: normalizedCategory,
          pinned: pinned || false,
          status: postStatus,
          discount: isConvenzione && discount ? discount : null,
        }));

    const { data, error } = await admin
      .from("posts")
      .insert(insertRows)
      .select();

    if (error) {
      return response(400, { error: error.message });
    }

    const posts = Array.isArray(data) ? data : [];
    return response(201, {
      post: posts[0] || null,
      posts,
      created_count: posts.length,
      is_global: isGlobal,
    });
  } catch (err) {
    return response(500, { error: "Errore interno del server" });
  }
};
