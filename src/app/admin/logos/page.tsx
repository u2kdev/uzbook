import { requireAdmin } from "@/server/auth/session";
import { getTrustedLogos } from "@/server/actions/logos";
import { LogoManager } from "@/components/admin/logo-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Карусель логотипов (Нам доверяют)" };

export default async function AdminLogosPage() {
  const session = await requireAdmin();
  const logos = await getTrustedLogos(false);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
          Витрина партнёров · PNG
        </p>
        <h1 className="mt-1.5 text-[26px] leading-tight font-semibold tracking-[-0.03em]">
          Карусель «Нам доверяют»
        </h1>
        <p className="mt-1 text-[12.5px] text-muted">
          Загружайте логотипы в формате PNG — они автоматически крутятся в бесконечной ленте на
          главной странице сайта.
        </p>
      </div>

      <LogoManager canManage={session.role === "ADMIN"} initialLogos={logos} />
    </div>
  );
}
