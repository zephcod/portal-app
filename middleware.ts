import { NextRequest, NextResponse } from "next/server";
import { CLIENT_COOKIE, verifyClientToken } from "@/lib/clientsession";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(CLIENT_COOKIE)?.value;
  if (token && (await verifyClientToken(token))) {
    return NextResponse.next();
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything requires a client session except the login page + statics
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
