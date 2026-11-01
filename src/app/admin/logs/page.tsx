import { requireAdmin } from "@/server/auth/session";
import { getPlatformAuditLogs } from "@/server/business/admin";
import { AuditLogViewer } from "@/components/admin/audit-log-viewer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Логи платформы" };

export default async function AdminLogsPage() {
  await requireAdmin();
  const logs = await getPlatformAuditLogs(300);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
          Полный журнал аудита
        </p>
        <h1 className="mt-1.5 text-[26px] leading-tight font-semibold tracking-[-0.03em]">
          Логи всего: Провайдеры · Салоны · Админы
        </h1>
        <p className="mt-1 text-[12.5px] text-muted">
          Отслеживайте отдельно действия каждого провайдера, каждого салона (клиента) и команды
          администраторов.
        </p>
      </div>

      <AuditLogViewer
        logs={logs.map((row) => ({
          id: row.log.id,
          action: row.log.action,
          entityType: row.log.entityType,
          entityId: row.log.entityId,
          details: (row.log.details ?? {}) as Record<string, unknown>,
          createdAt: row.log.createdAt.toISOString(),
          actorName: row.actorName,
          actorEmail: row.actorEmail,
          actorUsername: row.actorUsername,
          actorRole: row.actorRole,
          businessName: row.businessName,
        }))}
      />
    </div>
  );
}
