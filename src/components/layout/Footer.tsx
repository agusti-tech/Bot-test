import { useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/50 py-6">
      <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
        &copy; {year} Restaurant App. {t("rights")}.
      </div>
    </footer>
  );
}
