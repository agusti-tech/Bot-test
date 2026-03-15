"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

/** Renders Header and Footer only when not on a restaurant public page (Premium/Editorial have their own nav). */
export default function ConditionalAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const isRestaurantPage = pathname.includes("/restaurants/");

  return (
    <>
      {!isRestaurantPage && <Header />}
      <main className="flex-1">{children}</main>
      {!isRestaurantPage && <Footer />}
    </>
  );
}
