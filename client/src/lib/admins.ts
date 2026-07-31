import { Admin } from "@/types";

/**
 * Работает ли администратор в этом филиале (основной или дополнительный)?
 *
 * Смотрим и `branchIds`, и `branches`: сервер отдаёт оба, но полагаться на один
 * нельзя — раньше `branchIds` вообще не приходил, и проверка молча вырождалась
 * в «только основной филиал», пряча мульти-филиальных администраторов.
 */
export function worksInBranch(admin: Admin, branchId?: string | null): boolean {
  if (!branchId) return true;
  if (admin.branchIds?.length) return admin.branchIds.includes(branchId);
  if (admin.branches?.length) return admin.branches.some((b) => b.id === branchId);
  return admin.branchId === branchId;
}

/**
 * Администраторы для формы брони: сначала те, кто действительно работает в этом
 * филиале, затем все остальные.
 *
 * Список намеренно не обрезается по филиалу: главный аккаунт вправе оформить
 * бронь на любого администратора — например, когда сотрудник подменяет коллегу
 * в другом филиале. Обычный администратор этот список не видит: сервер всё
 * равно проставляет ему его собственный adminId.
 */
export function adminsForBranch(admins: Admin[], branchId?: string | null): Admin[] {
  const here: Admin[] = [];
  const elsewhere: Admin[] = [];
  for (const a of admins) (worksInBranch(a, branchId) ? here : elsewhere).push(a);
  return [...here, ...elsewhere];
}

/** Подпись в списке: у «чужого» администратора показываем его филиал. */
export function adminOptionLabel(admin: Admin, branchId?: string | null): string {
  if (worksInBranch(admin, branchId)) return admin.fullName;
  return admin.branch?.name ? `${admin.fullName} · ${admin.branch.name}` : admin.fullName;
}
