/**
 * GET /api/auth/me
 *
 * Return the currently authenticated user, or null.
 * Used by the client-side useAuth hook.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { findAccountById } from "@/lib/db";

export async function GET() {
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
      },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
