"use client";

import { useState } from "react";
import { ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "../_components/app-shell";
import { StatusBadge } from "../_components/status-badge";
import { InviteUserDialog } from "../_components/invite-user-dialog";
import { ResetPasswordDialog } from "../_components/reset-password-dialog";
import { useAuth, type AccountRecord } from "@/lib/auth/auth";
import { Button } from "@/components/ui/button";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";

// export const Route = createFileRoute("/administration")({
//   head: () => ({
//     meta: [
//       { title: "Administration — Users, Roles & Permissions | CEEMS" },
//       {
//         name: "description",
//         content: "Manage system users, assign roles and configure the permission matrix for enumeration operations.",
//       },
//       { property: "og:title", content: "Administration — Users, Roles & Permissions | CEEMS" },
//       { property: "og:description", content: "User accounts, role assignment and granular permission control." },
//     ],
//   }),
//   component: AdminPage,
// });

const roles = [
  "Super Administrator",
  "Data Manager",
  "Supervisor",
  "Enumerator",
  "Viewer",
];
const permissions = [
  { name: "View customers", grants: [true, true, true, true, true] },
  { name: "Edit customers", grants: [true, true, true, false, false] },
  { name: "Delete customers", grants: [true, false, false, false, false] },
  { name: "Import data", grants: [true, true, false, false, false] },
  { name: "Export data", grants: [true, true, true, false, false] },
  { name: "Approve enumeration", grants: [true, true, true, false, false] },
  { name: "Manage users", grants: [true, false, false, false, false] },
  { name: "View audit log", grants: [true, true, false, false, false] },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

export default function AdminPage() {
  const { accounts, user, isSuperAdmin, deleteUser } = useAuth();
  const [deleteTarget, setDeleteTarget] = useState<AccountRecord | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;

    setDeletingId(deleteTarget.id);

    try {
      const result = await deleteUser(deleteTarget.username);

      if (!result.ok) {
        throw new Error(result.error ?? "Unable to remove user.");
      }

      toast.success(`${deleteTarget.name} removed successfully.`);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to remove user.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (!isSuperAdmin) {
    return (
      <PageHeader
        title="Administration"
        description="You do not have access to manage users and roles."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Administration"
        description={
          user
            ? `Users, roles and permission matrix for ${user.name}`
            : "Users, roles and permission matrix"
        }
        actions={<InviteUserDialog />}
      />

      <Tabs defaultValue="users" className={"flex flex-col"}>
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="permissions">Roles & permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="pt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Username
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        Email
                      </TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Hub
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Password
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((u) => (
                      <TableRow key={u.username}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8">
                              <AvatarFallback className="bg-secondary text-xs">
                                {initials(u.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{u.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {u.username}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {u.email}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className="bg-muted rounded-sm font-semibold px-2 py-1"
                            variant="secondary"
                          >
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {u.hub}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            className="rounded-sm"
                            value={u.status}
                          />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge
                            variant={
                              u.mustChangePassword ? "destructive" : "secondary"
                            }
                            className="rounded-sm"
                          >
                            {u.mustChangePassword ? "Temporary" : "Set"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <ResetPasswordDialog
                              username={u.username}
                              name={u.name}
                            />
                            {u.username !== user?.username && (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => setDeleteTarget(u)}
                                disabled={deletingId === u.id}
                              >
                                <Trash2 className="size-4" />
                                Remove
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          <DeleteConfirmationDialog
            open={Boolean(deleteTarget)}
            onOpenChange={(open) => {
              if (!open) setDeleteTarget(null);
            }}
            onConfirm={handleDeleteUser}
            title="Remove user?"
            description={`This will permanently delete ${deleteTarget?.name ?? "this user"} from the system. This action cannot be undone. You can add them back later if needed.`}
            confirmLabel="Remove user"
            isDeleting={deletingId !== null}
            confirmationText={deleteTarget?.username ?? ""}
          />
        </TabsContent>

        <TabsContent value="permissions" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" /> Permission
                matrix
              </CardTitle>
              <CardDescription>
                Role-based access control across modules
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-44">Permission</TableHead>
                      {roles.map((r) => (
                        <TableHead key={r} className="text-center text-xs">
                          {r}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {permissions.map((p) => (
                      <TableRow key={p.name}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        {p.grants.map((g, i) => (
                          <TableCell key={i} className="text-center">
                            <Checkbox
                              defaultChecked={g}
                              aria-label={`${p.name} for ${roles[i]}`}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
