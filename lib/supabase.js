const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

function getSupabaseWithToken(token) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Content-Type": "application/json",
};

function response(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

async function getUserFromToken(token) {
  const supabase = getSupabaseWithToken(token);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

async function getUserProfile(userId) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data;
}

function extractToken(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) return null;
  return authHeader.replace("Bearer ", "");
}

function isBanned(profile) {
  if (!profile || !profile.banned_until) return false;
  return new Date(profile.banned_until) > new Date();
}

function getBanMessage(profile) {
  const until = new Date(profile.banned_until);
  const isPermanent = until.getFullYear() >= 2099;
  const reason = profile.ban_reason ? ` Motivo: ${profile.ban_reason}` : "";
  if (isPermanent) {
    return `Il tuo account e' stato bannato permanentemente.${reason}`;
  }
  return `Il tuo account e' sospeso fino al ${until.toLocaleString("it-IT")}.${reason}`;
}

module.exports = {
  getSupabaseClient,
  getSupabaseAdmin,
  getSupabaseWithToken,
  headers,
  response,
  getUserFromToken,
  getUserProfile,
  extractToken,
  isBanned,
  getBanMessage,
};
