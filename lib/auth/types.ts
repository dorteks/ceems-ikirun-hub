export const ROLES = [
  "Super Administrator",
  "Data Manager",
  "Supervisor",
  "Enumerator",
  "Viewer",
] as const;

export type Role = (typeof ROLES)[number];

export const HUBS = [
  "All",
  "Osogbo",
  "Ikirun",
  "Ede",
  "Ile-Ife",
  "Ilesa",
] as const;
export type Hub = (typeof HUBS)[number];

export const USER_STATUSES = ["Active", "Suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface UserRecord {
  id: number;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  hub: Hub;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}
