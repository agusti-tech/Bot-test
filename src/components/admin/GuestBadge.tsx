"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

interface GuestBadgeProps {
  name: string;
  totalVisits: number;
  noShowCount: number;
  className?: string;
}

export default function GuestBadge({
  name,
  totalVisits,
  noShowCount,
  className,
}: GuestBadgeProps) {
  const t = useTranslations("admin");
  const isFirstTime = totalVisits === 0;
  const hasNoShowWarning = noShowCount >= 2;

  return (
    <span className={className}>
      <span>{name}</span>
      {isFirstTime && (
        <Badge variant="secondary" className="ml-1.5 text-xs">
          {t("firstTime")}
        </Badge>
      )}
      {hasNoShowWarning && !isFirstTime && (
        <Badge variant="destructive" className="ml-1.5 text-xs">
          {t("noShowWarning")}
        </Badge>
      )}
      {!isFirstTime && !hasNoShowWarning && totalVisits > 0 && (
        <span className="ml-1.5 text-muted-foreground text-xs">
          {t("visitsCount", { count: totalVisits })}
        </span>
      )}
    </span>
  );
}
