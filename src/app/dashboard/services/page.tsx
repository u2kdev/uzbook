import { getMyBusiness } from "@/server/auth/session";
import { getOwnerServices } from "@/server/business/public";
import { ServicesManager } from "@/components/dashboard/services-manager";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const { business } = await getMyBusiness();
  if (!business) return null;
  const services = await getOwnerServices(business.id);

  return (
    <ServicesManager
      currency={business.currency}
      services={services.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        category: service.category,
        durationMin: service.durationMin,
        bufferBeforeMin: service.bufferBeforeMin,
        bufferAfterMin: service.bufferAfterMin,
        price: service.price,
        isActive: service.isActive,
      }))}
    />
  );
}
