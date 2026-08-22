import type { AppUser } from "./auth";
import { hasOperationalAdminAccess } from "./auth";

export const OPERATIONS_PERMISSIONS = [
  "programme.plans.manage",
  "programme.rosters.manage",
  "programme.committees.manage",
  "leave.review_squad",
  "leave.approve",
  "promotion.rules.manage",
  "promotion.review",
  "service.verify_squad",
  "service.approve",
  "band.view",
  "band.manage_profiles",
  "band.manage_instruments",
  "band.manage_programme",
] as const;

export function hasPermission(user: AppUser, permission: string) {
  return user.role !== "viewer" &&
    (hasOperationalAdminAccess(user) || user.custom_permissions.includes(permission));
}

export function isSquadOperationsUser(user: AppUser) {
  return user.role !== "viewer" && ["nco", "squad_leader"].includes(user.role);
}

export function canManageSquadRecord(user: AppUser, section: string, squad: string) {
  if (hasOperationalAdminAccess(user)) return true;
  return isSquadOperationsUser(user) && user.member_section === section && user.squad === squad;
}

export function canManageScopedPermission(user: AppUser, permission: string, section: string, squad: string) {
  if (hasOperationalAdminAccess(user)) return true;
  if (isSquadOperationsUser(user)) return user.member_section === section && user.squad === squad;
  return user.custom_permissions.includes(permission) && user.member_section === section && user.squad === squad;
}

export function canViewMemberScope(user: AppUser, member: { section: string; squad: string; email?: string }) {
  if (user.role === "viewer" || hasOperationalAdminAccess(user)) return true;
  if (member.email && member.email.toLowerCase() === user.email.toLowerCase()) return true;
  return isSquadOperationsUser(user) && user.member_section === member.section && user.squad === member.squad;
}

export async function linkedMember(db: D1Database, user: AppUser) {
  return db.prepare("SELECT id, name, section, squad, email, emergency_contact_number, parents_name, rank FROM members WHERE LOWER(email) = LOWER(?) LIMIT 1")
    .bind(user.email).first<{ id: number; name: string; section: string; squad: string; email: string; emergency_contact_number: string; parents_name: string; rank: string }>();
}
