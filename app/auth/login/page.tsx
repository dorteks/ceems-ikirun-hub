"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, LogIn, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/lib/auth/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [dbCheckState, setDbCheckState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | {
        status: "success";
        users: number;
        customers: number;
        durationMs: number;
      }
    | { status: "error"; message: string }
  >({ status: "idle" });

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Zap className="size-5" />
          </span>

          <div className="leading-tight">
            <p className="text-base font-semibold">CEEMS IKIRUN HUB</p>
            <p className="text-xs text-muted-foreground">
              Enumeration Platform
            </p>
          </div>
        </div>

        <Card className="space-y-6 py-6">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use your username and password.</CardDescription>
          </CardHeader>

          <CardContent>
            <form
              className="space-y-6"
              onSubmit={async (e) => {
                e.preventDefault();

                if (signingIn) return;

                setError(null);
                setSigningIn(true);

                try {
                  const res = await signIn(username, password);

                  if (!res.ok) {
                    setError(res.error ?? "Unable to sign in.");
                    return;
                  }

                  router.push(
                    res.mustChangePassword ? "/account" : "/dashboard",
                  );
                } catch {
                  setError("Unable to sign in. Please try again.");
                } finally {
                  setSigningIn(false);
                }
              }}
            >
              {error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <span className="text-sm text-destructive">{error}</span>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="superadmin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={signingIn}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={signingIn}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={signingIn}>
                {signingIn ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="size-4" />
                    Sign in
                  </>
                )}
              </Button>
            </form>

            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <p className="text-muted-foreground">Forgot your password?</p>
              <Button asChild variant="link" className="h-auto p-0">
                <Link href="/auth/forgot-password">Reset it here</Link>
              </Button>
            </div>

            <div className="mt-4 rounded-lg border bg-muted/30 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Database check</p>
                  <p className="text-xs text-muted-foreground">
                    Hit the public health endpoint to confirm the app can reach
                    the database.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    setDbCheckState({ status: "loading" });

                    try {
                      const response = await fetch("/api/health/db", {
                        method: "GET",
                        cache: "no-store",
                      });

                      const data = (await response
                        .json()
                        .catch(() => null)) as {
                        ok?: boolean;
                        error?: string;
                        users?: number;
                        customers?: number;
                        durationMs?: number;
                      } | null;

                      if (!response.ok || !data?.ok) {
                        setDbCheckState({
                          status: "error",
                          message:
                            data?.error ??
                            "The database health check did not succeed.",
                        });
                        return;
                      }

                      setDbCheckState({
                        status: "success",
                        users: data.users ?? 0,
                        customers: data.customers ?? 0,
                        durationMs: data.durationMs ?? 0,
                      });
                    } catch {
                      setDbCheckState({
                        status: "error",
                        message: "Unable to reach the health-check endpoint.",
                      });
                    }
                  }}
                  disabled={dbCheckState.status === "loading"}
                >
                  {dbCheckState.status === "loading" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}
                  Check database
                </Button>
              </div>

              {dbCheckState.status === "success" ? (
                <Alert className="mt-4 border-success/40 bg-success/10">
                  <CheckCircle2 className="size-4 text-success" />
                  <AlertDescription>
                    Connected. {dbCheckState.users} users and{" "}
                    {dbCheckState.customers} customers are reachable in{" "}
                    {dbCheckState.durationMs}ms.
                  </AlertDescription>
                </Alert>
              ) : null}

              {dbCheckState.status === "error" ? (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{dbCheckState.message}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 flex flex-col gap-1">
          <p className="text-center text-xs text-muted-foreground">
            Accounts are created by a Super Administrator.
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Contact your administrator for access.
          </p>
        </div>
      </div>
    </div>
  );
}
