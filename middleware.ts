import { NextResponse, type NextRequest } from "next/server";

import { COOKIE, pinRequired, pinToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  if (!pinRequired()) return NextResponse.next();

  const expected = await pinToken(process.env.APP_PIN!);
  if (request.cookies.get(COOKIE)?.value === expected) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!login|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest).*)",
  ],
};
