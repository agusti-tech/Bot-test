"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { getLocalizedValue, formatPrice } from "@/lib/utils";
import ChatWidgetWrapper from "@/components/chat/ChatWidgetWrapper";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { RestaurantPageProps } from "@/types/restaurant-page";

/** Haus Müller official site palette (haus-müller-köln.de) – kept per request */
const HAUS_MULLER = {
  black: "#000000",
  white: "#FFFFFF",
  shade1: "#93876f",
  shade2: "#a99f8c",
  main: "#beb7aa",
  secondary: "#eae8e4",
  text: "#2d2a26",
  textMuted: "#5c5549",
} as const;

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

function useReveal(threshold = 0.1) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setVisible(true);
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible] as const;
}

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

function rv(
  visible: boolean,
  delay = 0
): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(28px)",
    transition: `opacity 0.8s ease ${delay}s, transform 0.8s ease ${delay}s`,
  };
}

export default function PremiumRestaurantTemplate({
  restaurant,
  locale,
  openingHours,
}: RestaurantPageProps) {
  const t = useTranslations("restaurant");
  const tMenu = useTranslations("menu");
  const tDays = useTranslations("days");

  const [scrolled, setScrolled] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [aboutRef, aboutVisible] = useReveal();
  const [menuRef, menuVisible] = useReveal();
  const [reserveRef, reserveVisible] = useReveal();

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
  const settings = (restaurant.settings ?? {}) as Record<string, unknown>;
  const instagram = typeof settings.instagram === "string" ? settings.instagram : null;
  const ratings = settings.ratings as { google?: string; opentable?: string } | undefined;

  return (
    <div
      className="min-h-screen overflow-x-hidden max-w-[1440px] mx-auto"
      style={{
        background: HAUS_MULLER.white,
        color: HAUS_MULLER.text,
        fontFamily: "'Roboto', system-ui, sans-serif",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Fjalla+One:wght@400&family=Roboto:wght@400;700&display=swap"
        rel="stylesheet"
      />

      {/* Nav – responsive: hamburger + sheet on small screens, row on md+ */}
      <nav
        className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-between px-6 py-5 md:px-12 transition-all duration-[250ms]"
        style={{
          background: scrolled ? "rgba(255,255,255,0.95)" : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          color: HAUS_MULLER.text,
        }}
      >
        <div
          className="text-sm md:text-base tracking-[0.2em] font-medium shrink-0"
          style={{ fontFamily: "'Fjalla One', sans-serif" }}
        >
          {name.toUpperCase()}
        </div>

        {/* Desktop: horizontal links */}
        <div className="hidden md:flex items-center gap-6 lg:gap-10 shrink-0">
          <a href="#menu" className="text-[10px] tracking-widest uppercase text-[#5c5549] hover:text-[#93876f] transition-colors duration-200 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#93876f]">
            {t("menuTitle")}
          </a>
          <a href="#about" className="text-[10px] tracking-widest uppercase text-[#5c5549] hover:text-[#93876f] transition-colors duration-200 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#93876f]">
            {t("aboutUs")}
          </a>
          <a href="#reserve" className="text-[10px] tracking-widest uppercase text-[#5c5549] hover:text-[#93876f] transition-colors duration-200 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#93876f]">
            {t("contact")}
          </a>
          <a
            href={restaurant.phone ? `tel:${restaurant.phone}` : "#reserve"}
            className="border-2 border-[#000000] bg-[#000000] text-[#FFFFFF] text-[10px] tracking-widest uppercase px-5 py-2 hover:bg-[#2d2a26] hover:border-[#2d2a26] transition-colors duration-200 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000000]"
          >
            {t("reserve")}
          </a>
          {instagram && (
            <a
              href={`https://instagram.com/${instagram.replace(/^@/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] tracking-widest uppercase text-[#5c5549] hover:text-[#93876f] transition-colors duration-200 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#93876f]"
              aria-label={`${name} on Instagram`}
            >
              Instagram
            </a>
          )}
        </div>

        {/* Mobile: hamburger + sheet */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="md:hidden p-2 -mr-2 rounded-md cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#93876f]"
              style={{ color: HAUS_MULLER.text }}
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(85vw,320px)] flex flex-col pt-12" style={{ background: HAUS_MULLER.white }}>
            <div className="flex flex-col gap-6">
              <a href="#menu" className="text-[10px] tracking-widest uppercase py-2" style={{ color: HAUS_MULLER.textMuted }} onClick={() => setMobileNavOpen(false)}>
                {t("menuTitle")}
              </a>
              <a href="#about" className="text-[10px] tracking-widest uppercase py-2" style={{ color: HAUS_MULLER.textMuted }} onClick={() => setMobileNavOpen(false)}>
                {t("aboutUs")}
              </a>
              <a href="#reserve" className="text-[10px] tracking-widest uppercase py-2" style={{ color: HAUS_MULLER.textMuted }} onClick={() => setMobileNavOpen(false)}>
                {t("contact")}
              </a>
              <a
                href={restaurant.phone ? `tel:${restaurant.phone}` : "#reserve"}
                className="border-2 border-[#000000] bg-[#000000] text-[#FFFFFF] text-[10px] tracking-widest uppercase px-5 py-3 text-center mt-2 cursor-pointer"
                onClick={() => setMobileNavOpen(false)}
              >
                {t("reserve")}
              </a>
              {instagram && (
                <a
                  href={`https://instagram.com/${instagram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] tracking-widest uppercase py-2"
                  style={{ color: HAUS_MULLER.textMuted }}
                  aria-label={`${name} on Instagram`}
                  onClick={() => setMobileNavOpen(false)}
                >
                  Instagram
                </a>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </nav>

      {/* Hero – CTA above fold (UI UX Pro Max), official #beb7aa */}
      <section
        className="min-h-screen grid grid-cols-1 md:grid-cols-2 relative overflow-hidden"
        style={{ background: HAUS_MULLER.main }}
      >
        <div className="px-6 md:px-12 flex flex-col justify-center py-12 md:py-16 relative z-[2]">
          <p className="text-[10px] tracking-[0.4em] uppercase mb-4 flex items-center gap-3" style={{ color: HAUS_MULLER.shade1 }}>
            <span className="w-8 h-px inline-block" style={{ background: HAUS_MULLER.shade1 }} />
            {restaurant.address}
          </p>
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-normal leading-[1.08] mb-3"
            style={{ fontFamily: "'Fjalla One', sans-serif", color: HAUS_MULLER.text }}
          >
            <span className="block">{description.split(".")[0]}</span>
            <em className="italic not-italic" style={{ color: HAUS_MULLER.shade1 }}>
              {description.split(".").slice(1, 2).join(".").trim() || description}
            </em>
          </h1>
          <p className="text-xs font-normal leading-snug max-w-sm mb-6" style={{ color: HAUS_MULLER.textMuted }} title={description}>
            {description.split(".")[0].trim()}.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href={restaurant.phone ? `tel:${restaurant.phone}` : "#reserve"}
              className="bg-[#000000] text-[#FFFFFF] text-[10px] tracking-widest uppercase px-8 py-3.5 font-medium hover:bg-[#2d2a26] transition-all duration-200 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000000]"
            >
              {t("bookTable")}
            </a>
            <span className="text-[11px] tracking-widest" style={{ color: HAUS_MULLER.textMuted }}>
              {hoursSummary}
            </span>
          </div>
        </div>
        <div className="relative overflow-hidden" style={{ background: HAUS_MULLER.secondary }}>
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background:
                "linear-gradient(160deg,#eae8e4 0%,#beb7aa 50%,#a99f8c 100%)",
            }}
          />
          {restaurant.imageUrl ? (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-90"
              style={{ backgroundImage: `url(${restaurant.imageUrl})` }}
            />
          ) : (
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[clamp(4rem,12vw,10rem)] font-bold leading-none whitespace-nowrap select-none opacity-[0.06]"
              style={{
                fontFamily: "'Fjalla One', sans-serif",
                color: HAUS_MULLER.shade1,
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
              "linear-gradient(to bottom,transparent,rgba(147,135,111,0.25) 20%,rgba(147,135,111,0.25) 80%,transparent)",
          }}
        />
      </section>

      {/* Strip – 48px+ section spacing (skill), official palette */}
      <div
        className="border-t border-b py-4 overflow-hidden"
        style={{ borderColor: HAUS_MULLER.shade2, background: HAUS_MULLER.white }}
      >
        <div className="editorial-strip-scroll flex gap-12 w-max">
          {[
            restaurant.address,
            restaurant.phone ?? "",
            t("reserveRecommended"),
            ...(ratings?.google ? [`Google ${ratings.google}/5`] : []),
            ...(ratings?.opentable ? [`OpenTable ${ratings.opentable}/5`] : []),
          ].map(
            (item, i) => (
              <span
                key={i}
                className="text-[10px] tracking-widest uppercase flex-shrink-0"
                style={{ color: HAUS_MULLER.textMuted }}
              >
                <span className="mr-3" style={{ color: HAUS_MULLER.shade1 }}>◆</span>
                {item}
              </span>
            )
          )}
          {[
            restaurant.address,
            restaurant.phone ?? "",
            t("reserveRecommended"),
            ...(ratings?.google ? [`Google ${ratings.google}/5`] : []),
            ...(ratings?.opentable ? [`OpenTable ${ratings.opentable}/5`] : []),
          ].map(
            (item, i) => (
              <span
                key={`dup-${i}`}
                className="text-[10px] tracking-widest uppercase flex-shrink-0"
                style={{ color: HAUS_MULLER.textMuted }}
              >
                <span className="mr-3" style={{ color: HAUS_MULLER.shade1 }}>◆</span>
                {item}
              </span>
            )
          )}
        </div>
      </div>

      {/* About – SecondaryColor block, large gaps (skill) */}
      <section
        id="about"
        ref={aboutRef as React.RefObject<HTMLDivElement>}
        className="px-6 md:px-12 py-16 md:py-24 grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center border-t"
        style={{ borderColor: HAUS_MULLER.shade2, background: HAUS_MULLER.secondary }}
      >
        <div>
          <p
            className="text-[9px] tracking-[0.45em] uppercase mb-5 flex items-center gap-2"
            style={{ color: HAUS_MULLER.shade1, ...rv(aboutVisible, 0) }}
          >
            {t("ourApproach")}{" "}
            <span className="flex-1 h-px" style={{ background: HAUS_MULLER.shade2 }} />
          </p>
          <h2
            className="text-3xl md:text-4xl font-normal leading-tight mb-6"
            style={{
              fontFamily: "'Fjalla One', sans-serif",
              color: HAUS_MULLER.text,
              ...rv(aboutVisible, 0.1),
            }}
          >
            {t("aboutHeadline")}{" "}
            <span style={{ color: HAUS_MULLER.shade1 }}>{t("aboutHeadlineItalic")}</span>
          </h2>
          <p
            className="text-sm font-normal leading-relaxed"
            style={{ color: HAUS_MULLER.textMuted, ...rv(aboutVisible, 0.22) }}
          >
            {description}
          </p>
        </div>
        <div
          className="h-80 border relative overflow-hidden rounded-lg"
          style={{
            background: `linear-gradient(135deg, ${HAUS_MULLER.main} 0%, ${HAUS_MULLER.shade2} 100%)`,
            borderColor: HAUS_MULLER.shade2,
            ...rv(aboutVisible, 0.1),
          }}
        >
          <div
            className="absolute bottom-0 left-0 right-0 h-1/2"
            style={{
              background:
                "linear-gradient(to top,rgba(44,42,38,0.08),transparent)",
            }}
          />
          <div className="absolute bottom-8 left-8 right-8">
            <p
              className="text-lg leading-relaxed mb-2"
              style={{ fontFamily: "'Roboto', sans-serif", color: HAUS_MULLER.textMuted }}
            >
              {t("aboutQuote")}
            </p>
            <p className="text-[9px] tracking-widest uppercase" style={{ color: HAUS_MULLER.textMuted }}>
              {t("aboutQuoteAttribution")}
            </p>
          </div>
        </div>
      </section>

      {/* Menu – white block, 48px+ gaps, cursor-pointer + focus-visible on tabs */}
      <section
        id="menu"
        ref={menuRef as React.RefObject<HTMLDivElement>}
        className="px-6 md:px-12 py-16 md:py-24 border-t"
        style={{ borderColor: HAUS_MULLER.shade2, background: HAUS_MULLER.white }}
      >
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-8 mb-14">
          <div>
            <p
              className="text-[9px] tracking-[0.45em] uppercase mb-5 flex items-center gap-2"
              style={{ color: HAUS_MULLER.shade1, ...rv(menuVisible, 0) }}
            >
              {t("menuTitle")}{" "}
              <span className="flex-1 h-px" style={{ background: HAUS_MULLER.shade2 }} />
            </p>
            <h2
              className="text-3xl md:text-4xl font-normal m-0"
              style={{
                fontFamily: "'Fjalla One', sans-serif",
                color: HAUS_MULLER.text,
                ...rv(menuVisible, 0.1),
              }}
            >
              {t("seasonalMenu")}
            </h2>
          </div>
          <div className="flex flex-wrap gap-0 border-b-2" style={{ borderColor: HAUS_MULLER.shade2 }}>
            {categoriesWithItems.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategoryId(cat.id)}
                className={`text-[10px] tracking-widest uppercase py-2.5 px-5 md:px-6 border-b-2 transition-colors duration-200 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#93876f] ${
                  currentCategoryId === cat.id
                    ? "border-[#000000] text-[#000000]"
                    : "border-transparent text-[#5c5549] hover:text-[#2d2a26]"
                }`}
              >
                {getLocalizedValue(cat.name, locale)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {activeCategory?.items.map((item) => (
            <div
              key={item.id}
              className="py-6 border-b transition-colors duration-200 md:pr-12 md:odd:border-r md:odd:pr-12 md:even:pl-12"
              style={{ borderColor: HAUS_MULLER.secondary }}
            >
              <div className="flex justify-between items-baseline gap-4 mb-1.5">
                <span
                  className="text-lg font-normal"
                  style={{ fontFamily: "'Fjalla One', sans-serif", color: HAUS_MULLER.text }}
                >
                  {getLocalizedValue(item.name, locale)}
                </span>
                <span
                  className="text-base font-normal"
                  style={{ fontFamily: "'Roboto', sans-serif", color: HAUS_MULLER.shade1 }}
                >
                  {formatPrice(item.price)}
                </span>
              </div>
              {item.description && (
                <p className="text-xs font-normal leading-relaxed" style={{ color: HAUS_MULLER.textMuted }}>
                  {getLocalizedValue(item.description, locale)}
                </p>
              )}
              {item.dietaryTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.dietaryTags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[8px] tracking-wider uppercase px-2 py-0.5 border"
                      style={{ color: HAUS_MULLER.shade1, borderColor: HAUS_MULLER.shade2 }}
                    >
                      {tMenu(`dietary.${tag}` as "dietary.vegetarian")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-[11px] mt-8 tracking-wider" style={{ color: HAUS_MULLER.textMuted }}>
          {t("menuDisclaimer")}
        </p>
      </section>

      {/* Reserve – CTA section, official palette, focus-visible + cursor-pointer */}
      <section
        id="reserve"
        ref={reserveRef as React.RefObject<HTMLDivElement>}
        className="px-6 md:px-12 py-16 md:py-24 text-center border-t relative overflow-hidden"
        style={{ borderColor: HAUS_MULLER.shade2, background: HAUS_MULLER.secondary }}
      >
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-96 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse,rgba(147,135,111,0.08) 0%,transparent 70%)",
          }}
        />
        <p
          className="text-[9px] tracking-[0.45em] uppercase mb-5 flex items-center justify-center gap-2 relative"
          style={{ color: HAUS_MULLER.shade1, ...rv(reserveVisible, 0) }}
        >
          {t("reserve")}
        </p>
        <h2
          className="text-4xl md:text-5xl lg:text-6xl font-normal leading-tight mb-4 relative"
          style={{
            fontFamily: "'Fjalla One', sans-serif",
            color: HAUS_MULLER.text,
            ...rv(reserveVisible, 0.1),
          }}
        >
          {t("reserveHeadline")}{" "}
          <span style={{ color: HAUS_MULLER.shade1 }}>{t("reserveHeadlineItalic")}</span>
        </h2>
        <p
          className="text-sm font-normal mb-12 relative"
          style={{ color: HAUS_MULLER.textMuted, ...rv(reserveVisible, 0.22) }}
        >
          {t("reserveRecommended")}
        </p>
        <div
          className="flex flex-wrap items-center justify-center gap-6 mb-16 relative"
          style={rv(reserveVisible, 0.34)}
        >
          <a
            href={restaurant.phone ? `tel:${restaurant.phone}` : "#reserve"}
            className="bg-[#000000] text-[#FFFFFF] text-[11px] tracking-widest uppercase px-11 py-4 font-medium hover:bg-[#2d2a26] transition-colors duration-200 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000000]"
          >
            {t("bookTable")}
          </a>
          {restaurant.phone && (
            <a
              href={`tel:${restaurant.phone}`}
              className="border-2 text-[10px] tracking-widest uppercase px-7 py-3.5 transition-colors duration-200 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#93876f]"
              style={{
                borderColor: HAUS_MULLER.shade1,
                color: HAUS_MULLER.textMuted,
              }}
            >
              {restaurant.phone}
            </a>
          )}
        </div>
        <div
          className="flex flex-wrap justify-center gap-10 md:gap-16 border-t pt-10 relative"
          style={{ borderColor: HAUS_MULLER.shade2, ...rv(reserveVisible, 0.46) }}
        >
          <div className="text-left">
            <div className="text-[9px] tracking-widest uppercase mb-1.5" style={{ color: HAUS_MULLER.textMuted }}>
              {t("address")}
            </div>
            <div
              className="text-[15px] font-normal"
              style={{ fontFamily: "'Roboto', sans-serif", color: HAUS_MULLER.text }}
            >
              {restaurant.address}
            </div>
          </div>
          <div className="text-left">
            <div className="text-[9px] tracking-widest uppercase mb-1.5" style={{ color: HAUS_MULLER.textMuted }}>
              {t("openingHours")}
            </div>
            <div
              className="text-[15px] font-normal"
              style={{ fontFamily: "'Roboto', sans-serif", color: HAUS_MULLER.text }}
            >
              {hoursSummary}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="px-6 md:px-12 py-9 flex flex-col sm:flex-row justify-between items-center gap-4 border-t"
        style={{ borderColor: HAUS_MULLER.shade2, background: HAUS_MULLER.white }}
      >
        <div
          className="text-sm tracking-widest"
          style={{ fontFamily: "'Fjalla One', sans-serif", color: HAUS_MULLER.textMuted }}
        >
          {name.toUpperCase()} · {restaurant.address.split(",").pop()?.trim() ?? ""}
        </div>
        <div className="flex items-center gap-6">
          {instagram && (
            <a
              href={`https://instagram.com/${instagram.replace(/^@/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] tracking-widest uppercase transition-colors duration-200 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#93876f]"
              style={{ color: HAUS_MULLER.textMuted }}
              aria-label={`${name} on Instagram`}
            >
              @{instagram.replace(/^@/, "")}
            </a>
          )}
          <p className="text-[10px] tracking-wider" style={{ color: HAUS_MULLER.textMuted }}>
            © {new Date().getFullYear()} · {restaurant.slug}
          </p>
        </div>
      </footer>

      <ChatWidgetWrapper restaurantId={restaurant.id} restaurantName={name} />
    </div>
  );
}
