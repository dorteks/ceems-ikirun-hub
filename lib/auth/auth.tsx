import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_PASSWORD } from "./password";
import { HUBS, ROLES, type Hub, type Role, type UserRecord } from "./types";

export { ROLES, HUBS };
export type { Role, Hub, UserRecord as AccountRecord };

interface AuthValue {
  ready: boolean;
  user: UserRecord | null;
  accounts: UserRecord[];
  defaultPassword: string;
  signIn: (
    identifier: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string; mustChangePassword?: boolean }>;
  signOut: () => void;
  inviteUser: (input: {
    name: string;
    username: string;
    email?: string;
    phone?: string;
    role: Role;
    hub: Hub;
    password?: string;
  }) => Promise<{ ok: boolean; error?: string; generatedPassword?: string }>;
  changePassword: (
    current: string,
    next: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  resetUserPassword: (username: string) => Promise<{
    ok: boolean;
    error?: string;
    generatedPassword?: string;
  }>;
  deleteUser: (username: string) => Promise<{
    ok: boolean;
    error?: string;
  }>;
  canManageHub: (hub: string) => boolean;
  isSuperAdmin: boolean;
  isDataManager: boolean;
  isSupervisor: boolean;
  isEnumerator: boolean;
  isViewer: boolean;
  adminAccess: boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<UserRecord[]>([]);
  const [user, setUser] = useState<UserRecord | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });

        if (!response.ok) {
          if (!cancelled) {
            setUser(null);
            setAccounts([]);
          }
          return;
        }

        const data = (await response.json()) as {
          user: UserRecord;
          users?: UserRecord[];
        };

        if (cancelled) return;

        setUser(data.user);
        setAccounts(data.users ?? [data.user]);
      } catch {
        if (!cancelled) {
          setUser(null);
          setAccounts([]);
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const value: AuthValue = useMemo(() => {
    const isSuperAdmin = user?.role === "Super Administrator";
    const isDataManager = user?.role === "Data Manager";
    const isSupervisor = user?.role === "Supervisor";
    const isEnumerator = user?.role === "Enumerator";
    const isViewer = user?.role === "Viewer";

    const adminAccess = isSuperAdmin || isDataManager || isSupervisor;

    return {
      ready,
      user,
      accounts,
      defaultPassword: DEFAULT_PASSWORD,
      isSuperAdmin,
      isDataManager,
      isSupervisor,
      isEnumerator,
      isViewer,
      adminAccess,
      signIn: async (identifier, password) => {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ identifier, password }),
        });

        const data = (await response.json().catch(() => null)) as {
          user?: UserRecord;
          users?: UserRecord[];
          mustChangePassword?: boolean;
          error?: string;
        } | null;

        if (!response.ok || !data?.user) {
          return {
            ok: false,
            error: data?.error ?? "Unable to sign in.",
          };
        }

        setUser(data.user);
        setAccounts(data.users ?? [data.user]);

        return {
          ok: true,
          mustChangePassword: data.mustChangePassword ?? false,
        };
      },
      signOut: () => {
        setUser(null);
        setAccounts([]);
        void fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
      },
      inviteUser: async (input) => {
        if (!isSuperAdmin) {
          return {
            ok: false as const,
            error: "Only a Super Administrator can create accounts.",
          };
        }

        const response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(input),
        });
        const data = (await response.json().catch(() => null)) as {
          user?: UserRecord;
          generatedPassword?: string;
          error?: string;
        } | null;

        if (!response.ok || !data?.user) {
          return {
            ok: false as const,
            error: data?.error ?? "Unable to create account.",
          };
        }

        setAccounts((current) => [...current, data.user!]);

        return {
          ok: true as const,
          generatedPassword: data.generatedPassword,
        };
      },
      changePassword: async (current, next) => {
        if (!user) {
          return { ok: false as const, error: "You are not signed in." };
        }

        const response = await fetch("/api/auth/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            currentPassword: current,
            nextPassword: next,
          }),
        });
        const data = (await response.json().catch(() => null)) as {
          error?: string;
          user?: UserRecord;
        } | null;

        if (!response.ok) {
          return {
            ok: false as const,
            error: data?.error ?? "Unable to update password.",
          };
        }

        if (data?.user) {
          setUser(data.user);
          setAccounts((current) =>
            current.map((account) =>
              account.id === data.user!.id ? data.user! : account,
            ),
          );
        }

        return { ok: true as const };
      },
      resetUserPassword: async (username) => {
        if (!isSuperAdmin) {
          return {
            ok: false as const,
            error: "Only a Super Administrator can reset passwords.",
          };
        }

        const response = await fetch("/api/users/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username }),
        });
        const data = (await response.json().catch(() => null)) as {
          error?: string;
          generatedPassword?: string;
          user?: UserRecord;
        } | null;

        if (!response.ok || !data?.generatedPassword) {
          return {
            ok: false as const,
            error: data?.error ?? "Unable to reset password.",
          };
        }

        if (data.user) {
          setAccounts((current) =>
            current.map((account) =>
              account.id === data.user!.id
                ? { ...account, mustChangePassword: true }
                : account,
            ),
          );
        }

        return {
          ok: true as const,
          generatedPassword: data.generatedPassword,
        };
      },
      deleteUser: async (username) => {
        if (!isSuperAdmin) {
          return {
            ok: false as const,
            error: "Only a Super Administrator can delete accounts.",
          };
        }

        const response = await fetch("/api/users", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username }),
        });
        const data = (await response.json().catch(() => null)) as {
          error?: string;
          user?: UserRecord;
        } | null;

        if (!response.ok || !data?.user) {
          return {
            ok: false as const,
            error: data?.error ?? "Unable to delete account.",
          };
        }

        setAccounts((current) =>
          current.filter((account) => account.id !== data.user!.id),
        );

        return { ok: true as const };
      },
      canManageHub: (hub: string) =>
        !!user && (user.hub === "All" || user.hub === hub),
    };
  }, [accounts, ready, user]);

  useEffect(() => {
    if (!ready) return;

    const roleToDomain: Record<Role, string | null> = {
      "Super Administrator": "administrator",
      "Data Manager": "data_manager",
      Supervisor: "supervisor",
      Enumerator: "enumerator",
      Viewer: "viewer",
    };

    const domain = user ? (roleToDomain[user.role] ?? null) : null;

    if (domain) {
      document.documentElement.setAttribute("data-dashboard-domain", domain);
    } else {
      document.documentElement.removeAttribute("data-dashboard-domain");
    }
  }, [ready, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
