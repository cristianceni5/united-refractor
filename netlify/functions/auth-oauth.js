const { getSupabaseClient, headers, response } = require("../../lib/supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "POST") {
    return response(405, { error: "Metodo non consentito" });
  }

  try {
    const { provider } = JSON.parse(event.body);

    if (provider !== "google") {
      return response(400, { error: "Provider non supportato." });
    }

    const supabase = getSupabaseClient();
    const siteUrl = process.env.URL || "http://localhost:8888";

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${siteUrl}/auth-callback.html`,
        queryParams: provider === "google" ? {
          access_type: "offline",
          prompt: "consent",
        } : {},
      },
    });

    if (error) {
      return response(400, { error: error.message });
    }

    return response(200, { url: data.url });
  } catch (err) {
    console.error("OAuth error:", err);
    return response(500, { error: "Errore interno del server" });
  }
};
