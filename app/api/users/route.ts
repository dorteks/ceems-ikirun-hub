import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  HUBS,
  ROLES,
  createUser,
  deleteUser,
  getSessionUser,
  listUsers,
  type Hub,
  type Role,
} from "../../../server/services/userService";
import { recordAuditEvent } from "../../../server/services/auditService";

const SESSION_COOKIE = "ceems_session";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get(SESSION_COOKIE)?.value);
  if (!Number.isInteger(userId)) return null;
  return getSessionUser(userId);
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    if (user.role !== "Super Administrator") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await listUsers();
    return NextResponse.json({ users }, { status: 200 });
  } catch (error: unknown) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    if (user.role !== "Super Administrator") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;

    if (!body.name || !body.username || !body.role || !body.hub) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const role = String(body.role);
    const hub = String(body.hub);

    if (!ROLES.includes(role as Role) || !HUBS.includes(hub as Hub)) {
      return NextResponse.json(
        { error: "Invalid role or hub selection" },
        { status: 400 },
      );
    }

    const result = await createUser({
      name: String(body.name),
      username: String(body.username),
      email: body.email ? String(body.email) : null,
      phone: body.phone ? String(body.phone) : null,
      role: role as Role,
      hub: hub as Hub,
      password: body.password ? String(body.password) : null,
      createdBy: user.username,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await recordAuditEvent({
      actorName: user.name,
      actorUsername: user.username,
      actorRole: user.role,
      action: "Created user",
      entityType: "user",
      entityId: result.user.id,
      entityLabel: result.user.username,
      beforeValue: "—",
      afterValue: `${result.user.role} · ${result.user.hub}`,
      metadata: {
        status: result.user.status,
        source: "users",
      },
    });

    return NextResponse.json(
      {
        user: result.user,
        generatedPassword: result.generatedPassword,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    if (user.role !== "Super Administrator") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const username = String(body.username ?? "").trim();
    const userId = Number(body.userId);
    const identifier = username || (Number.isInteger(userId) ? userId : null);

    if (identifier == null || identifier === "") {
      return NextResponse.json(
        { error: "Missing username or userId" },
        { status: 400 },
      );
    }

    const result = await deleteUser(identifier, user.username);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await recordAuditEvent({
      actorName: user.name,
      actorUsername: user.username,
      actorRole: user.role,
      action: "Deleted user",
      entityType: "user",
      entityId: result.user.id,
      entityLabel: result.user.username,
      beforeValue: `${result.user.role} · ${result.user.hub}`,
      afterValue: "removed",
      metadata: {
        status: result.user.status,
        source: "admin-user-delete",
      },
    });

    return NextResponse.json({ user: result.user }, { status: 200 });
  } catch (error: unknown) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 },
    );
  }
}
