import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { COOKIE, pinRequired, pinToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function signIn(formData: FormData) {
  "use server";

  const pin = String(formData.get("pin") ?? "");
  if (!process.env.APP_PIN || pin !== process.env.APP_PIN) {
    redirect("/login?e=1");
  }
  const store = await cookies();
  store.set(COOKIE, await pinToken(pin), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  if (!pinRequired()) redirect("/");
  const { e } = await searchParams;

  return (
    <div className="flex min-h-[70vh] flex-col justify-center">
      <h1 className="text-2xl font-bold">Post-op care</h1>
      <p className="mt-1 text-sm text-slate-500">Enter the shared code to continue.</p>
      <form action={signIn} className="mt-6 space-y-3">
        <input
          type="password"
          name="pin"
          inputMode="numeric"
          autoComplete="current-password"
          className="field text-center text-2xl tracking-widest"
          placeholder="••••"
          autoFocus
          required
        />
        {e && <p className="text-sm text-rose-600">That code did not match.</p>}
        <button className="btn-primary w-full">Open</button>
      </form>
    </div>
  );
}
