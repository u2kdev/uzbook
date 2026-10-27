import { requireAdmin } from "@/server/auth/session";
import { getAdminUsers } from "@/server/business/admin";
import { UserTable } from "@/components/admin/user-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Пользователи" };

export default async function AdminUsersPage() {
  const session = await requireAdmin();
  const users = await getAdminUsers();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
          Аккаунты
        </p>
        <h1 className="mt-1.5 text-[26px] leading-tight font-semibold tracking-[-0.03em]">
          Пользователи
        </h1>
        <p className="mt-1 text-[12.5px] text-muted">
          {users.length} аккаунтов · {users.filter((row) => row.businessesCount > 0).length} с
          бизнесом · {users.filter((row) => row.user.telegramId).length} с Telegram
        </p>
      </div>

      <UserTable
        canManage={session.role === "ADMIN"}
        rows={users.map(({ user, businessesCount, businessNames }) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          telegramLinked: Boolean(user.telegramId),
          createdAt: user.createdAt.toISOString(),
          businessesCount,
          businessNames,
          isSelf: user.id === session.id,
        }))}
      />
    </div>
  );
}
