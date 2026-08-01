"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCompanyByPin } from "@/lib/clients";
import {
  CLIENT_COOKIE,
  CLIENT_MAX_AGE,
  createClientToken,
} from "@/lib/clientsession";

/** PIN-only login — same PINs as the Awaj ET reports app. */
export async function login(formData: FormData) {
  const pin = String(formData.get("password") || "").trim();

  if (/^\d{4,10}$/.test(pin)) {
    const company = await getCompanyByPin(pin);
    if (company && !company.active) {
      // Correct PIN, suspended account — no session is issued; the
      // login page shows a blurred dashboard + "contact your account
      // manager" notice instead of the form.
      redirect("/login?suspended=1");
    }
    if (company) {
      const token = await createClientToken(
        company.$id,
        company.fbPageId ?? "",
        company.name
      );
      (await cookies()).set(CLIENT_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: CLIENT_MAX_AGE,
      });
      redirect("/");
    }
  }

  // Small delay to slow brute-force attempts.
  await new Promise((r) => setTimeout(r, 750));
  redirect("/login?error=1");
}

export async function logout() {
  (await cookies()).delete(CLIENT_COOKIE);
  redirect("/login");
}
