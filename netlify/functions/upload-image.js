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

    const { image, filename, contentType, folder } = JSON.parse(event.body);

    if (!image) {
      return response(400, { error: "Nessuna immagine fornita" });
    }

    // Remove data URL prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Max 8MB
    if (buffer.length > 8 * 1024 * 1024) {
      return response(400, { error: "Immagine troppo grande (max 8MB)" });
    }

    const admin = getSupabaseAdmin();
    const ext = (filename || "image.jpg").split(".").pop() || "jpg";
    const uploadFolder = folder === "avatars" ? "avatars" : "posts";
    const filePath = `${uploadFolder}/${user.id}/${Date.now()}.${ext}`;

    const { data, error } = await admin.storage
      .from("images")
      .upload(filePath, buffer, {
        contentType: contentType || "image/jpeg",
        upsert: false,
      });

    if (error) {
      console.error("Upload error:", error);
      return response(400, { error: "Errore nel caricamento: " + error.message });
    }

    const { data: urlData } = admin.storage
      .from("images")
      .getPublicUrl(filePath);

    return response(200, { url: urlData.publicUrl });
  } catch (err) {
    console.error("Upload error:", err);
    return response(500, { error: "Errore interno del server" });
  }
};
