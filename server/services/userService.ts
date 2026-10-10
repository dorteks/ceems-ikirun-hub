import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma, type UserRow as DbUserRow } from "@/server/db/prisma";
import {
  HUBS,
  ROLES,
  type Hub,
  type Role,
  type UserRecord,
  type UserStatus,
} from "@/lib/auth/types";
import { generateTemporaryPassword } from "@/lib/auth/password";

type PrismaUserRole =
  | "SUPER_ADMINISTRATOR"
  | "DATA_MANAGER"
  | "SUPERVISOR"
  | "ENUMERATOR"
  | "VIEWER";

type PrismaHub = "ALL" | "OSOGBO" | "EDE" | "ILE_IFE" | "ILESA" | "IKIRUN";

type PrismaUserStatus = "ACTIVE" | "SUSPENDED";

type UserRow = Omit<DbUserRow, "role" | "hub" | "status"> & {
  role: PrismaUserRole;
  hub: PrismaHub;
  status: PrismaUserStatus;
};

export { HUBS, ROLES };
export type { Hub, Role, UserRecord };

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function toRole(role: PrismaUserRole): Role {
  const map: Record<PrismaUserRole, Role> = {
    SUPER_ADMINISTRATOR: "Super Administrator",
    DATA_MANAGER: "Data Manager",
    SUPERVISOR: "Supervisor",
    ENUMERATOR: "Enumerator",
    VIEWER: "Viewer",
  };

  return map[role] ?? "Viewer";
}

function toHub(hub: PrismaHub): Hub {
  const map: Record<PrismaHub, Hub> = {
    ALL: "All",
    OSOGBO: "Osogbo",
    EDE: "Ede",
    ILE_IFE: "Ile-Ife",
    ILESA: "Ilesa",
    IKIRUN: "Ikirun",
  };

  return map[hub] ?? "All";
}

function toStatus(status: PrismaUserStatus): UserStatus {
  return status === "SUSPENDED" ? "Suspended" : "Active";
}

function fromRole(role: Role): PrismaUserRole {
  const map: Record<Role, PrismaUserRole> = {
    "Super Administrator": "SUPER_ADMINISTRATOR",
    "Data Manager": "DATA_MANAGER",
    Supervisor: "SUPERVISOR",
    Enumerator: "ENUMERATOR",
    Viewer: "VIEWER",
  };

  return map[role];
}

function fromHub(hub: Hub): PrismaHub {
  const map: Record<Hub, PrismaHub> = {
    All: "ALL",
    Osogbo: "OSOGBO",
    Ede: "EDE",
    "Ile-Ife": "ILE_IFE",
    Ilesa: "ILESA",
    Ikirun: "IKIRUN",
  };

  return map[hub];
}

function serializeUser(user: UserRow): UserRecord {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: toRole(user.role),
    hub: toHub(user.hub),
    status: toStatus(user.status),
    mustChangePassword: user.must_change_password,
    lastLoginAt: user.last_login_at?.toISOString() ?? null,
    createdAt: user.created_at.toISOString(),
    updatedAt: user.updated_at.toISOString(),
  };
}

export function generatePasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [scheme, salt, hash] = passwordHash.split("$");

  if (scheme !== "scrypt" || !salt || !hash) {
    return false;
  }

  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return users.map(serializeUser);
}

export async function getUserById(id: number) {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? serializeUser(user) : null;
}

export async function getUserByLogin(identifier: string) {
  const normalized = normalize(identifier);
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: normalized }, { email: normalized }],
    },
  });

  return user;
}

async function getUserForReset(identifier: number | string) {
  if (typeof identifier === "number") {
    return prisma.user.findUnique({ where: { id: identifier } });
  }

  const trimmed = identifier.trim();

  if (!trimmed) {
    return null;
  }

  const byId = Number(trimmed);
  if (Number.isInteger(byId) && String(byId) === trimmed) {
    const userById = await prisma.user.findUnique({ where: { id: byId } });
    if (userById) return userById;
  }

  return getUserByLogin(trimmed);
}

export async function authenticateUser(identifier: string, password: string) {
  const user = await getUserByLogin(identifier);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return { ok: false as const, error: "Incorrect username or password." };
  }

  if (user.status === "SUSPENDED") {
    return {
      ok: false as const,
      error: "This account is suspended. Contact an administrator.",
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { last_login_at: new Date() },
  });

  const refreshed = await prisma.user.findUnique({ where: { id: user.id } });

  return {
    ok: true as const,
    user: serializeUser(refreshed ?? user),
    mustChangePassword:
      refreshed?.must_change_password ?? user.must_change_password,
  };
}

export async function createUser(input: {
  name: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  role: Role;
  hub: Hub;
  password?: string | null;
  createdBy?: string | null;
}) {
  const username = normalize(input.username);
  const email = input.email?.trim().toLowerCase() || null;

  if (!ROLES.includes(input.role)) {
    return {
      ok: false as const,
      error: "Invalid user role.",
    };
  }

  if (!HUBS.includes(input.hub)) {
    return {
      ok: false as const,
      error: "Invalid hub selection.",
    };
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username }, ...(email ? [{ email }] : [])],
    },
  });

  if (existing) {
    return {
      ok: false as const,
      error: "An account with that username or email already exists.",
    };
  }

  const password = input.password?.trim() || generateTemporaryPassword();
  const created = await prisma.user.create({
    data: {
      name: input.name.trim(),
      username,
      email,
      phone: input.phone?.trim() || null,
      role: fromRole(input.role),
      hub: fromHub(input.hub),
      status: "ACTIVE",
      password_hash: generatePasswordHash(password),
      must_change_password: true,
      created_by: input.createdBy ?? null,
      updated_by: input.createdBy ?? null,
    },
  });

  return {
    ok: true as const,
    user: serializeUser(created),
    generatedPassword: password,
  };
}

export async function changePassword(
  userId: number,
  currentPassword: string,
  nextPassword: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    return { ok: false as const, error: "You are not signed in." };
  }

  if (!verifyPassword(currentPassword, user.password_hash)) {
    return { ok: false as const, error: "Current password is incorrect." };
  }

  if (nextPassword.length < 8) {
    return {
      ok: false as const,
      error: "New password must be at least 8 characters.",
    };
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      password_hash: generatePasswordHash(nextPassword),
      must_change_password: false,
      updated_by: user.username,
    },
  });

  return {
    ok: true as const,
    user: serializeUser(updated),
  };
}

export async function resetUserPassword(
  identifier: number | string,
  adminUsername: string | null,
) {
  const user = await getUserForReset(identifier);

  if (!user) {
    return { ok: false as const, error: "User not found." };
  }

  const password = generateTemporaryPassword();

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      password_hash: generatePasswordHash(password),
      must_change_password: true,
      updated_by: adminUsername ?? null,
    },
  });

  return {
    ok: true as const,
    user: serializeUser(updated),
    generatedPassword: password,
  };
}

export async function getSessionUser(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user ? serializeUser(user) : null;
}
