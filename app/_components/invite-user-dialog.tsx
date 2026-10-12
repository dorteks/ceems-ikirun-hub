"use client";

import { useState } from "react";
import { Copy, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HUBS, ROLES, type Hub, type Role, useAuth } from "@/lib/auth/auth";
import { generateTemporaryPassword } from "@/lib/auth/password";
import Spinner from "@/components/ui/spinner";

export function InviteUserDialog() {
  const { inviteUser, isSuperAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("Enumerator");
  const [hub, setHub] = useState<Hub>("Osogbo");
  const [password, setPassword] = useState(() => generateTemporaryPassword());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isSuperAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Invite user
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite user</DialogTitle>
          <DialogDescription>
            Create an account with a username, role, and hub scope. The user is
            prompted to change the temporary password after first sign-in.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (submitting) return;

            setSubmitting(true);
            setError(null);

            try {
              const res = await inviteUser({
                name,
                username,
                email,
                phone,
                role,
                hub,
                password,
              });
              if (!res.ok) {
                setError(res.error ?? "Unable to create account.");
                return;
              }
              setError(null);
              setOpen(false);
              setName("");
              setUsername("");
              setEmail("");
              setPhone("");
              setPassword(generateTemporaryPassword());
              toast.success(
                `Account created for ${username}. Temporary password generated.`,
              );
              if (res.generatedPassword) {
                navigator.clipboard
                  ?.writeText(res.generatedPassword)
                  .catch(() => {
                    // ignore clipboard failures
                  });
              }
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
              <span className="text-sm text-destructive">{error}</span>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="invite-name">Full name</Label>
            <Input
              id="invite-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-username">Username</Label>
            <Input
              id="invite-username"
              placeholder="supervisor.001"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="name@utility.ng"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-phone">Phone</Label>
            <Input
              id="invite-phone"
              type="tel"
              placeholder="08030000001"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hub scope</Label>
              <Select value={hub} onValueChange={(v) => setHub(v as Hub)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HUBS.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h === "All" ? "All hubs" : h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {hub === "All"
              ? "Can manage data across every business hub."
              : `Can only manage data belonging to the ${hub} business hub.`}
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="invite-password">Temporary password</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2 text-xs"
                onClick={() => setPassword(generateTemporaryPassword())}
              >
                <RotateCcw className="size-3.5" /> Regenerate
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                id="invite-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() =>
                  navigator.clipboard?.writeText(password).catch(() => {
                    // ignore clipboard failures
                  })
                }
                aria-label="Copy temporary password"
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The user must change this password after first login.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Spinner />
                  Creating...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
