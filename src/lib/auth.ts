const AUTH_URL = "https://functions.poehali.dev/29e51a83-aa51-4a4b-b52f-043dea9d6b1c";

export const TOKEN_KEY = "messenger_token";
export const USER_KEY = "messenger_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function saveSession(token: string, user: object) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function sendOtp(phone: string) {
  const res = await fetch(`${AUTH_URL}/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  return res.json();
}

export async function verifyOtp(phone: string, code: string, name?: string) {
  const res = await fetch(`${AUTH_URL}/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code, name }),
  });
  return res.json();
}

export async function fetchMe(token: string) {
  const res = await fetch(`${AUTH_URL}/me`, {
    headers: { "X-Auth-Token": token },
  });
  return res.json();
}

export async function updateProfile(token: string, data: { name?: string; username?: string; bio?: string }) {
  const res = await fetch(`${AUTH_URL}/update-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Auth-Token": token },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function logout(token: string) {
  await fetch(`${AUTH_URL}/logout`, {
    method: "POST",
    headers: { "X-Auth-Token": token },
  });
  clearSession();
}
