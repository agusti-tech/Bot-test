import { getTranslations } from "next-intl/server";
import GuestManager from "@/components/admin/GuestManager";

export default async function GuestsPage() {
  const t = await getTranslations("admin");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("guests")}</h1>
      <GuestManager />
    </div>
  );
}
