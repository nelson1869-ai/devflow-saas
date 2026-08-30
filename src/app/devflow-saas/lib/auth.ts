import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";

export type UserRole = "Admin" | "Member" | "Viewer";

export type User = Readonly<{
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}>;

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
};

const SESSION_COOKIE_NAME = "devflow_session_user_id";

export async function getAllUsers(): Promise<readonly User[]> {
  const stmt = db.prepare("SELECT * FROM devflow_users ORDER BY name ASC");
  const rows = stmt.all() as UserRow[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    avatarUrl: r.avatar_url || undefined,
  }));
}

export async function getCurrentUser(): Promise<User> {
  const cookieStore = await cookies();
  const sessionUserId = cookieStore.get(SESSION_COOKIE_NAME)?.value || "user-1";

  const stmt = db.prepare("SELECT * FROM devflow_users WHERE id = ?");
  const row = stmt.get(sessionUserId) as UserRow | undefined;

  if (row) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      avatarUrl: row.avatar_url || undefined,
    };
  }

  // Default fallback
  const users = await getAllUsers();
  return users[0];
}
