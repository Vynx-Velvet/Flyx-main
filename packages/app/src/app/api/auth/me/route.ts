/**
 * GET /api/auth/me
 *
 * Return the currently authenticated user, or null.
 * Used by the client-side useAuth hook.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { findAccountById } from "@/lib/db";
import { isMasterRequest } from "@/lib/request-master";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ user: null });
    }

    const account = findAccountById(session.sub);
    if (!account) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: account.id,
        username: account.username,
        isAdmin: account.isAdmin,
        isMaster: isMasterRequest(request),
      },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
