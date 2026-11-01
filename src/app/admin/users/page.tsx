import { requireAdmin } from "@/server/auth/session";
import { getAdminUsers } from "@/server/business/admin";
import { UserTable } from "@/components/admin/user-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Пользователи по ролям" };

export default async function AdminUsersPage() {
  const session = await requireAdmin();
  const users = await getAdminUsers();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
          Раздельные списки по ролям
        </p>
        <h1 className="mt-1.5 text-[26px] leading-tight font-semibold tracking-[-0.03em]">
          Админы · Саппорты · Провайдеры · Клиенты
        </h1>
        <p className="mt-1 text-[12.5px] text-muted">
          Всего {users.length} аккаунтов · выберите вкладку ниже для фильтрации по роли.
        </p>
      </div>

      <UserTable
        canManage={session.role === "ADMIN"}
        rows={users.map(({ user, businessesCount, businessNames, connectedByProviderCount }) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username ?? null,
          phone: user.phone,
          role: user.role,
          commissionPercent: user.commissionPercent ?? 60,
          payoutCard: user.payoutCard ?? null,
          createdAt: user.createdAt.toISOString(),
          businessesCount,
          businessNames,
          connectedByProviderCount,
          isSelf: user.id === session.id,
        }))}
      />
    </div>
  );
}
