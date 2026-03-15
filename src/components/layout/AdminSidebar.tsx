"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Store,
  UtensilsCrossed,
  CalendarDays,
  LogOut,
  Armchair,
  Map,
  Monitor,
  List,
  Users,
  BarChart3,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AdminSidebar() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const pathname = usePathname();

  const links = [
    {
      href: `/${locale}/admin`,
      label: t("dashboard"),
      icon: LayoutDashboard,
      exact: true,
    },
    {
      href: `/${locale}/admin/analytics`,
      label: t("analytics"),
      icon: BarChart3,
    },
    {
      href: `/${locale}/admin/restaurant`,
      label: t("restaurantInfo"),
      icon: Store,
    },
    {
      href: `/${locale}/admin/menu`,
      label: t("menuManagement"),
      icon: UtensilsCrossed,
    },
    {
      href: `/${locale}/admin/tables`,
      label: t("tables"),
      icon: Armchair,
    },
    {
      href: `/${locale}/admin/floor-plan`,
      label: t("floorPlan"),
      icon: Map,
    },
    {
      href: `/${locale}/admin/reservations`,
      label: t("reservations"),
      icon: CalendarDays,
    },
    {
      href: `/${locale}/admin/guests`,
      label: t("guests"),
      icon: Users,
    },
    {
      href: `/${locale}/admin/waitlist`,
      label: t("waitlist"),
      icon: List,
    },
    {
      href: `/${locale}/admin/dashboard`,
      label: t("hostDashboard"),
      icon: Monitor,
    },
  ];

  return (
    <aside className="w-64 border-r bg-muted/30 min-h-[calc(100vh-4rem)]">
      <nav className="flex flex-col p-4 gap-1">
        {links.map((link) => {
          const isActive = link.exact
            ? pathname === link.href
            : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}

        <div className="mt-auto pt-4 border-t mt-8">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground"
            onClick={() => signOut({ callbackUrl: `/${locale}/admin/login` })}
          >
            <LogOut className="h-4 w-4" />
            {t("logout")}
          </Button>
        </div>
      </nav>
    </aside>
  );
}
