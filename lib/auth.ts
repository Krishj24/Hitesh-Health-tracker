/**
 * Optional lock. With no APP_PIN environment variable set, the app is open to
 * anyone with the link -- which is the default. Set APP_PIN in Vercel to require
 * a shared code before anything is visible.
 */

export const COOKIE = "care_session";

export function pinRequired(): boolean {
  return !!process.env.APP_PIN;
}

/** Cookie holds a hash, so the PIN itself is never stored on the device. */
export async function pinToken(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`post-op-care:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
