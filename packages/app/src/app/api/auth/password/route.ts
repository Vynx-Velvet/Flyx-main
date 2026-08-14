/**
 * PATCH /api/auth/password — Change own password or reset another user's (admin)
 *
 * Body: { currentPassword?, newPassword, userId? }
 * - Without userId: changes current user's password (requires currentPassword)
 * - With userId (admin only): resets another user's password
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { findAccountById } from "@/lib/db";
import { readFileSync, writeFileSync, existsSync, renameSync } from "fs";
import path from "path";

const DB_DIR = process.env.FLYX_DATA_DIR || path.resolve(process.cwd(), ".flyx");
const DB_PATH = path.join(DB_DIR, "store.json");

export const runtime = "nodejs";

/**
 * Read store.json directly (bypasses the in-memory cache for writes).
 * Shape-validates like lib/db: a file that parses but isn't a store
 * (partial write, older schema) reads as "no accounts" instead of
 * throwing a TypeError mid-request.
 */
function loadStore(): any | null {
  if (!existsSync(DB_PATH)) return null;
  try {
    const parsed = JSON.parse(readFileSync(DB_PATH, "utf-8"));
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.accounts)) {
      console.warn("[auth/password] store.json has an unexpected shape");
      return null;
    }
    return parsed;
  } catch {
    console.warn("[auth/password] store.json is unreadable");
    return null;
  }
}

/** Atomic write (tmp + rename) — a crash mid-write must never truncate the store. */
function saveStore(store: any): void {
  const tmp = DB_PATH + ".tmp";
  writeFileSync(tmp, JSON.stringify(store, null, 2), "utf-8");
  renameSync(tmp, DB_PATH);
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword, userId } = await request.json();

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }

    const store = loadStore();
    if (!store) {
      return NextResponse.json({ error: "No accounts found" }, { status: 404 });
    }

    // Resetting a specific user's password (by ID)
    if (userId) {
      if (!session.isAdmin) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
      const targetIdx = store.accounts.findIndex((a: any) => a.id === userId);
      if (targetIdx === -1) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      store.accounts[targetIdx].passwordHash = await hashPassword(newPassword);
      saveStore(store);
      return NextResponse.json({ ok: true });
    }

    // Changing own password
    // Admin can change their own without old password (e.g. auto-generated pw unknown)
    if (session.isAdmin) {
      const selfIdx = store.accounts.findIndex((a: any) => a.id === session.sub);
      if (selfIdx === -1) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }
      store.accounts[selfIdx].passwordHash = await hashPassword(newPassword);
      saveStore(store);
      return NextResponse.json({ ok: true });
    }

    // Non-admin: require current password
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 });
    }

    const selfIdx = store.accounts.findIndex((a: any) => a.id === session.sub);
    if (selfIdx === -1) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const valid = await verifyPassword(currentPassword, store.accounts[selfIdx].passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    store.accounts[selfIdx].passwordHash = await hashPassword(newPassword);
    saveStore(store);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/password]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
