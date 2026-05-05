const AUTH_URL = "https://functions.poehali.dev/29e51a83-aa51-4a4b-b52f-043dea9d6b1c";

export const TOKEN_KEY = "primechat_token";
export const USER_KEY = "primechat_user";

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

async function authPost(action: string, data: object = {}, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["X-Auth-Token"] = token;
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...data }),
  });
  return res.json();
}

export async function register(login: string, password: string, name: string) {
  return authPost("register", { login, password, name });
}

export async function login(loginStr: string, password: string) {
  return authPost("login", { login: loginStr, password });
}

export async function fetchMe(token: string) {
  return authPost("me", {}, token);
}

export async function updateProfile(token: string, data: { name?: string; bio?: string }) {
  return authPost("update-profile", data, token);
}

export async function logout(token: string) {
  await authPost("logout", {}, token);
  clearSession();
}
