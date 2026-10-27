import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBookingByToken } from "@/server/booking/service";
import { ManageBooking } from "@/components/public/manage-booking";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ваша запись", robots: { index: false } };

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const booking = await getBookingByToken(token);
  if (!booking) notFound();

  return (
    <ManageBooking
      initial={{
        token: booking.manageToken,
        startAt: booking.startAt.toISOString(),
        endAt: booking.endAt.toISOString(),
        status: booking.status,
        price: booking.price,
        durationMin: booking.durationMin,
        clientName: booking.clientName,
        serviceName: booking.service.name,
        serviceId: booking.service.id,
        staffName: booking.staff.name,
        staffId: booking.staff.id,
        businessName: booking.business.name,
        businessSlug: booking.business.slug,
        timezone: booking.business.timezone,
        currency: booking.business.currency,
        address: booking.business.address
          ? `${booking.business.city ? `${booking.business.city}, ` : ""}${booking.business.address}`
          : null,
        phone: booking.business.phone,
      }}
    />
  );
}
