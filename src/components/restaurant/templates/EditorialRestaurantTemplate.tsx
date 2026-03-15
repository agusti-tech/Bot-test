"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { getLocalizedValue, formatPrice } from "@/lib/utils";
import ChatWidgetWrapper from "@/components/chat/ChatWidgetWrapper";
import type { RestaurantPageProps } from "@/types/restaurant-page";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

function formatHoursSummary(
  openingHours: RestaurantPageProps["openingHours"],
  tDays: (key: string) => string,
  t: (key: string) => string
): string {
  const parts: string[] = [];
  DAYS.forEach((day) => {
    const h = openingHours[day];
    if (h) parts.push(`${tDays(day)} ${h.open}–${h.close}`);
  });
  if (parts.length === 0) return t("closed");
  return parts.slice(0, 2).join(", ") + (parts.length > 2 ? "…" : "");
}

export default function EditorialRestaurantTemplate({
  restaurant,
  locale,
  openingHours,
}: RestaurantPageProps) {
  const t = useTranslations("restaurant");
  const tMenu = useTranslations("menu");
  const tDays = useTranslations("days");

  const [scrolled, setScrolled] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const categoriesWithItems = restaurant.categories.filter(
    (c) => c.items.length > 0
  );
  const firstCategoryId = categoriesWithItems[0]?.id ?? null;
  const currentCategoryId = activeCategoryId ?? firstCategoryId;
  const activeCategory = categoriesWithItems.find(
    (c) => c.id === currentCategoryId
  );

  useEffect(() => {
    if (!activeCategoryId && firstCategoryId) setActiveCategoryId(firstCategoryId);
  }, [firstCategoryId, activeCategoryId]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const hoursSummary = formatHoursSummary(openingHours, tDays, t);
  const name = getLocalizedValue(restaurant.name, locale);
  const description = getLocalizedValue(restaurant.description, locale);

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{
        background: "#0a0806",
        color: "#f2e8d6",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400;1,500&family=DM+Sans:wght@200;300;400;500&display=swap"
        rel="stylesheet"
      />

      {/* Nav */}
      <nav
        className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-between px-6 py-5 md:px-12 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(10,8,6,0.92)" : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
        }}
      >
        <div
          className="text-sm md:text-base tracking-[0.2em] font-medium"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {name.split(" ").map((word, i) => (
            <span key={i}>
              {word}
              {i < name.split(" ").length - 1 ? " " : ""}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-6 md:gap-10">
          <a
            href="#menu"
            className="text-[10px] tracking-widest uppercase text-[#7a6a58] hover:text-[#c8863c] transition-colors"
          >
            {t("menuTitle")}
          </a>
          <a
            href="#about"
            className="text-[10px] tracking-widest uppercase text-[#7a6a58] hover:text-[#c8863c] transition-colors"
          >
            {t("aboutUs")}
          </a>
          <a
            href="#reserve"
            className="text-[10px] tracking-widest uppercase text-[#7a6a58] hover:text-[#c8863c] transition-colors"
          >
            {t("contact")}
          </a>
          <a
            href={restaurant.phone ? `tel:${restaurant.phone}` : "#reserve"}
            className="border border-[rgba(200,134,60,0.18)] text-[#c8863c] text-[10px] tracking-widest uppercase px-5 py-2 hover:bg-[#c8863c] hover:text-[#0a0806] transition-all"
          >
            {t("reserve")}
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="min-h-screen grid grid-cols-1 md:grid-cols-2 relative overflow-hidden">
        <div className="px-6 md:px-12 flex flex-col justify-end pb-16 md:pb-20 relative z-[2]">
          <p className="text-[10px] tracking-[0.4em] uppercase text-[#c8863c] mb-6 flex items-center gap-3">
            <span className="w-8 h-px bg-[#c8863c] inline-block" />
            {restaurant.address}
          </p>
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-normal leading-[1.08] mb-5"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            <span className="block">{description.split(".")[0]}</span>
            <em className="italic text-[#c8863c]">
              {description.split(".").slice(1, 2).join(".") || description}
            </em>
          </h1>
          <p className="text-sm font-light text-[#7a6a58] leading-relaxed max-w-md mb-10">
            {description}
          </p>
          <div className="flex flex-wrap items-center gap-6">
            <a
              href={restaurant.phone ? `tel:${restaurant.phone}` : "#reserve"}
              className="bg-[#c8863c] text-[#0a0806] text-[10px] tracking-widest uppercase px-8 py-3.5 font-medium hover:bg-[#e8a95a] hover:-translate-y-0.5 transition-all"
            >
              {t("bookTable")}
            </a>
            <span className="text-[11px] text-[#3a3028] tracking-widest">
              {hoursSummary}
            </span>
          </div>
        </div>
        <div className="relative overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(160deg,#1a1008 0%,#0d0804 40%,#050302 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 40% 50%,rgba(200,134,60,0.13) 0%,transparent 65%)",
            }}
          />
          {restaurant.imageUrl ? (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-40"
              style={{ backgroundImage: `url(${restaurant.imageUrl})` }}
            />
          ) : (
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[clamp(4rem,12vw,10rem)] font-bold leading-none whitespace-nowrap select-none opacity-[0.04]"
              style={{
                fontFamily: "'Playfair Display', serif",
                color: "#c8863c",
              }}
            >
              {name.split(" ").pop() ?? name}
            </div>
          )}
        </div>
        <div
          className="absolute left-1/2 top-0 bottom-0 w-px z-[3] hidden md:block"
          style={{
            background:
              "linear-gradient(to bottom,transparent,rgba(200,134,60,0.18) 20%,rgba(200,134,60,0.18) 80%,transparent)",
          }}
        />
      </section>

      {/* Strip */}
      <div className="border-t border-b border-[rgba(200,134,60,0.18)] py-4 overflow-hidden">
        <div className="editorial-strip-scroll flex gap-12 w-max">
          {[restaurant.address, restaurant.phone ?? "", t("reserveRecommended")].map(
            (item, i) => (
              <span
                key={i}
                className="text-[10px] tracking-widest uppercase text-[#3d3228] flex-shrink-0"
              >
                <span className="text-[#c8863c] mr-3">◆</span>
                {item}
              </span>
            )
          )}
          {[restaurant.address, restaurant.phone ?? "", t("reserveRecommended")].map(
            (item, i) => (
              <span
                key={`dup-${i}`}
                className="text-[10px] tracking-widest uppercase text-[#3d3228] flex-shrink-0"
              >
                <span className="text-[#c8863c] mr-3">◆</span>
                {item}
              </span>
            )
          )}
        </div>
      </div>

      {/* About */}
      <section
        id="about"
        className="px-6 md:px-12 py-24 md:py-28 grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center border-t border-[rgba(200,134,60,0.18)]"
      >
        <div>
          <p className="text-[9px] tracking-[0.45em] uppercase text-[#c8863c] mb-5 flex items-center gap-2">
            {t("ourApproach")}{" "}
            <span className="flex-1 h-px bg-[rgba(200,134,60,0.18)]" />
          </p>
          <h2
            className="text-3xl md:text-4xl font-normal leading-tight mb-6"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {t("aboutHeadline")}{" "}
            <em className="italic text-[#c8863c]">{t("aboutHeadlineItalic")}</em>
          </h2>
          <p className="text-sm font-light text-[#9a8a78] leading-relaxed">
            {description}
          </p>
        </div>
        <div className="h-80 bg-gradient-to-br from-[#160f08] to-[#0d0804] border border-[rgba(200,134,60,0.18)] relative overflow-hidden">
          <div
            className="absolute bottom-0 left-0 right-0 h-1/2"
            style={{
              background:
                "linear-gradient(to top,rgba(200,134,60,0.06),transparent)",
            }}
          />
          <div className="absolute bottom-8 left-8 right-8">
            <p
              className="text-lg italic text-[rgba(200,134,60,0.5)] leading-relaxed mb-2"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {t("aboutQuote")}
            </p>
            <p className="text-[9px] tracking-widest uppercase text-[#3a3028]">
              {t("aboutQuoteAttribution")}
            </p>
          </div>
        </div>
      </section>

      {/* Menu */}
      <section
        id="menu"
        className="px-6 md:px-12 py-24 md:py-28 border-t border-[rgba(200,134,60,0.18)]"
      >
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-8 mb-14">
          <div>
            <p className="text-[9px] tracking-[0.45em] uppercase text-[#c8863c] mb-5 flex items-center gap-2">
              {t("menuTitle")}{" "}
              <span className="flex-1 h-px bg-[rgba(200,134,60,0.18)]" />
            </p>
            <h2
              className="text-3xl md:text-4xl font-normal m-0"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {t("seasonalMenu")}
            </h2>
          </div>
          <div className="flex flex-wrap gap-0 border-b border-[rgba(200,134,60,0.18)]">
            {categoriesWithItems.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategoryId(cat.id)}
                className={`text-[10px] tracking-widest uppercase py-2.5 px-5 md:px-6 border-b-2 transition-all ${
                  currentCategoryId === cat.id
                    ? "text-[#c8863c] border-[#c8863c]"
                    : "border-transparent text-[#4a3f35] hover:text-[#f2e8d6]"
                }`}
              >
                {getLocalizedValue(cat.name, locale)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {activeCategory?.items.map((item, idx) => (
            <div
              key={item.id}
              className="py-6 border-b border-[rgba(255,255,255,0.05)] hover:border-[rgba(200,134,60,0.18)] transition-colors md:pr-12 md:odd:border-r md:odd:pr-12 md:even:pl-12"
            >
              <div className="flex justify-between items-baseline gap-4 mb-1.5">
                <span
                  className="text-lg font-normal"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {getLocalizedValue(item.name, locale)}
                </span>
                <span
                  className="text-base text-[#c8863c] italic"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {formatPrice(item.price)}
                </span>
              </div>
              {item.description && (
                <p className="text-xs font-light text-[#5a4f44] leading-relaxed">
                  {getLocalizedValue(item.description, locale)}
                </p>
              )}
              {item.dietaryTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.dietaryTags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[8px] tracking-wider uppercase text-[#c8863c] border border-[rgba(200,134,60,0.25)] px-2 py-0.5"
                    >
                      {tMenu(`dietary.${tag}` as "dietary.vegetarian")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[#2e2520] mt-8 tracking-wider">
          {t("menuDisclaimer")}
        </p>
      </section>

      {/* Reserve */}
      <section
        id="reserve"
        className="px-6 md:px-12 py-24 md:py-32 text-center border-t border-[rgba(200,134,60,0.18)] relative overflow-hidden"
      >
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-96 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse,rgba(200,134,60,0.06) 0%,transparent 70%)",
          }}
        />
        <p className="text-[9px] tracking-[0.45em] uppercase text-[#c8863c] mb-5 flex items-center justify-center gap-2">
          {t("reserve")}
        </p>
        <h2
          className="text-4xl md:text-5xl lg:text-6xl font-normal leading-tight mb-4 relative"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {t("reserveHeadline")}{" "}
          <em className="italic text-[#c8863c]">{t("reserveHeadlineItalic")}</em>
        </h2>
        <p className="text-sm font-light text-[#7a6a58] mb-12 relative">
          {t("reserveRecommended")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 mb-16 relative">
          <a
            href={restaurant.phone ? `tel:${restaurant.phone}` : "#reserve"}
            className="bg-[#c8863c] text-[#0a0806] text-[11px] tracking-widest uppercase px-11 py-4 font-medium hover:bg-[#e8a95a] transition-colors"
          >
            {t("bookTable")}
          </a>
          {restaurant.phone && (
            <a
              href={`tel:${restaurant.phone}`}
              className="border border-[rgba(200,134,60,0.18)] text-[#7a6a58] text-[10px] tracking-widest uppercase px-7 py-3.5 hover:border-[rgba(200,134,60,0.5)] hover:text-[#c8863c] transition-all"
            >
              {restaurant.phone}
            </a>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-10 md:gap-16 border-t border-[rgba(200,134,60,0.18)] pt-10 relative">
          <div className="text-left">
            <div className="text-[9px] tracking-widest uppercase text-[#3a3028] mb-1.5">
              {t("address")}
            </div>
            <div
              className="text-[15px]"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {restaurant.address}
            </div>
          </div>
          <div className="text-left">
            <div className="text-[9px] tracking-widest uppercase text-[#3a3028] mb-1.5">
              {t("openingHours")}
            </div>
            <div
              className="text-[15px]"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {hoursSummary}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-9 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-[rgba(200,134,60,0.18)]">
        <div
          className="text-sm tracking-widest text-[#2e2520]"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {name.toUpperCase()} · {restaurant.address.split(",").pop()?.trim() ?? ""}
        </div>
        <p className="text-[10px] text-[#1e1a16] tracking-wider">
          © {new Date().getFullYear()} · {restaurant.slug}
        </p>
      </footer>

      <ChatWidgetWrapper
        restaurantId={restaurant.id}
        restaurantName={name}
      />
    </div>
  );
}
