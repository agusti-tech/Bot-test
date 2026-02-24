"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useLocale } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getGuests } from "@/app/[locale]/admin/(dashboard)/actions";
import GuestBadge from "./GuestBadge";

type GuestRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  totalVisits: number;
  noShowCount: number;
  lastVisitAt: Date | null;
  seatingPreference: string | null;
};

export default function GuestManager() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const list = await getGuests(search || undefined);
      setGuests(list);
    });
  }, [search]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {t("guests")}
        </CardTitle>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchGuests")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <p className="text-muted-foreground text-sm">{t("loading") ?? "Loading..."}</p>
        ) : guests.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noGuests")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("guestName")}</TableHead>
                <TableHead>{t("guestPhone")}</TableHead>
                <TableHead>{t("email")}</TableHead>
                <TableHead>{t("visits")}</TableHead>
                <TableHead>{t("noShows")}</TableHead>
                <TableHead>{t("lastVisit")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {guests.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>
                    <Link
                      href={`/${locale}/admin/guests/${g.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      <GuestBadge
                        name={g.name}
                        totalVisits={g.totalVisits}
                        noShowCount={g.noShowCount}
                      />
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{g.phone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{g.email ?? "—"}</TableCell>
                  <TableCell>{g.totalVisits}</TableCell>
                  <TableCell>{g.noShowCount}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {g.lastVisitAt
                      ? new Date(g.lastVisitAt).toLocaleDateString()
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
