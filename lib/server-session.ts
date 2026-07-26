import { cookies } from "next/headers";
import {
  CLIENT_COOKIE,
  verifyClientToken,
  type ClientSession,
} from "./clientsession";

/** The logged-in client's session, or null. */
export async function getSession(): Promise<ClientSession | null> {
  const token = (await cookies()).get(CLIENT_COOKIE)?.value;
  return token ? verifyClientToken(token) : null;
}
