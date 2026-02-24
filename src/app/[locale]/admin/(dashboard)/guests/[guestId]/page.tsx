import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getGuestById } from "@/app/[locale]/admin/(dashboard)/actions";
import GuestDetail from "@/components/admin/GuestDetail";

export default async function GuestDetailPage({
  params,
}: {
  params: Promise<{ guestId: string }>;
}) {
  const t = await getTranslations("admin");
  const { guestId } = await params;
  const guest = await getGuestById(guestId);
  if (!guest) notFound();

  const serialized = {
    ...guest,
    lastVisitAt: guest.lastVisitAt?.toISOString() ?? null,
    reservations: guest.reservations.map((r) => ({
      ...r,
      date: r.date.toISOString().slice(0, 10),
    })),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("guestDetail")}</h1>
      <GuestDetail guest={serialized} />
    </div>
  );
}
