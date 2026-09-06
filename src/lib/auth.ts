export const AUTH_COOKIE = "geo_session";

/** Jeton dérivé du mot de passe : changer APP_PASSWORD invalide toutes les sessions. */
export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`geo-monitor:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
