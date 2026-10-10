"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Network,
  Upload,
  Map,
  History,
  Shield,
  Zap,
  Search,
  Bell,
  Menu,
  LogOut,
  KeyRound,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth/auth";
import { TimeDisplay } from "@/components/dashboard/time-display";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
};

const nav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customers", label: "Customers", icon: Users },
  {
    to: "/import",
    label: "Import & Export",
    icon: Upload,
    adminOnly: true,
  },
  { to: "/enumeration", label: "Enumeration", icon: ClipboardList },
  { to: "/network", label: "Network", icon: Network, adminOnly: true },
  { to: "/map", label: "Map", icon: Map, adminOnly: true },
  {
    to: "/audit",
    label: "Audit trail",
    icon: History,
    adminOnly: true,
  },
  {
    to: "/administration",
    label: "Administration",
    icon: Shield,
    adminOnly: true,
  },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { adminAccess } = useAuth();
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {nav
        .filter((item) => !item.adminOnly || adminAccess)
        .map((item) => {
          const active =
            pathname === item.to || pathname.startsWith(`${item.to}/`);

          return (
            <Link
              key={item.to}
              href={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active &&
                  "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_0_var(--sidebar-primary)]",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}

{
  /* <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36" role="img" aria-label="CEEMS logo">
  <rect width="36" height="36" rx="6" fill="oklch(0.79 0.16 76)" />
  <svg x="8" y="8" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="oklch(0.24 0.05 60)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
  </svg>
</svg> */
}

function Brand() {
  return (
    <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-[13.5px]">
      <span className="flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
        <Zap className="size-5" />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-sidebar-accent-foreground">
          CEEMS IKIRUN HUB
        </p>
        <p className="text-xs text-sidebar-foreground/70">
          Enumeration Platform
        </p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [customerCount, setCustomerCount] = useState<number | null>(null);

  const router = useRouter();
  const { user, signOut } = useAuth();

  const initials = (user?.name ?? "")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    const loadCustomerCount = async () => {
      try {
        const response = await fetch("/api/customers?page=1&size=1", {
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (typeof data.total === "number") {
          setCustomerCount(data.total);
        } else {
          setCustomerCount(null);
        }
      } catch {
        setCustomerCount(null);
      }
    };

    void loadCustomerCount();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-sidebar lg:flex">
        <Brand />
        <NavList />

        <div className="mt-auto">
          <TimeDisplay />

          <div className="border-t border-sidebar-border p-4 text-xs text-sidebar-foreground/70">
            <div>
              <p className="font-medium text-sidebar-accent-foreground">
                Osun Distribution
              </p>
              <p>
                {customerCount === null
                  ? "Loading records..."
                  : `All hubs · ${customerCount} records synced`}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur md:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Brand />
              <NavList onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search account, meter, NIN, phone…"
              className="pl-9"
              aria-label="Global search"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="size-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-accent"
                  aria-label="Account menu"
                >
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {initials || "--"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-left text-xs leading-tight sm:block">
                    <span className="block font-medium">{user?.name}</span>
                    <span className="block text-muted-foreground">
                      {user?.role}
                    </span>
                  </span>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <span className="block text-sm font-medium">
                    {user?.email}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {user?.hub === "All" ? "All hubs" : `${user?.hub} hub only`}
                  </span>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem onSelect={() => router.push("/account")}>
                  <KeyRound className="size-4" />
                  My Account
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() => {
                    signOut();
                    router.push("/auth/login");
                  }}
                >
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] bg-muted/40 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string | ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
