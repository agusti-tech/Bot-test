"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, AlertTriangle, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateGuest } from "@/app/[locale]/admin/(dashboard)/actions";
import GuestBadge from "./GuestBadge";
import { toast } from "sonner";

type ReservationRow = {
  id: string;
  date: string;
  time: string;
  partySize: number;
  status: string;
  guestName: string;
};

type GuestDetailData = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  dietaryRestrictions: string[];
  tags: string[];
  seatingPreference: string | null;
  totalVisits: number;
  noShowCount: number;
  lastVisitAt: string | null;
  reservations: ReservationRow[];
};

function parseCommaList(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function GuestDetail({ guest }: { guest: GuestDetailData }) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const router = useRouter();
  const hasNoShowWarning = guest.noShowCount >= 2;
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(guest.name);
  const [editNotes, setEditNotes] = useState(guest.notes ?? "");
  const [editTags, setEditTags] = useState(guest.tags.join(", "));
  const [editDietary, setEditDietary] = useState(guest.dietaryRestrictions.join(", "));
  const [editSeating, setEditSeating] = useState(guest.seatingPreference ?? "");
  const [saving, setSaving] = useState(false);

  function openEdit() {
    setEditName(guest.name);
    setEditNotes(guest.notes ?? "");
    setEditTags(guest.tags.join(", "));
    setEditDietary(guest.dietaryRestrictions.join(", "));
    setEditSeating(guest.seatingPreference ?? "");
    setEditOpen(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateGuest(guest.id, {
        name: editName.trim(),
        notes: editNotes.trim() || null,
        tags: parseCommaList(editTags),
        dietaryRestrictions: parseCommaList(editDietary),
        seatingPreference: editSeating.trim() || null,
      });
      toast.success(t("saved"));
      setEditOpen(false);
      router.refresh();
    } catch {
      toast.error(t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/${locale}/admin/guests`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("back")}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <GuestBadge
                name={guest.name}
                totalVisits={guest.totalVisits}
                noShowCount={guest.noShowCount}
              />
            </CardTitle>
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="h-4 w-4 mr-1" />
              {t("editGuest")}
            </Button>
          </div>
          {hasNoShowWarning && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {t("noShowWarningDetail")}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">{t("guestPhone")}</dt>
              <dd>{guest.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("email")}</dt>
              <dd>{guest.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("visits")}</dt>
              <dd>{guest.totalVisits}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("noShows")}</dt>
              <dd>{guest.noShowCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("lastVisit")}</dt>
              <dd>
                {guest.lastVisitAt ? new Date(guest.lastVisitAt).toLocaleString() : "—"}
              </dd>
            </div>
            {guest.seatingPreference && (
              <div>
                <dt className="text-muted-foreground">{t("tablePreference")}</dt>
                <dd>{guest.seatingPreference}</dd>
              </div>
            )}
            {guest.dietaryRestrictions.length > 0 && (
              <div>
                <dt className="text-muted-foreground">{t("dietaryRestrictions")}</dt>
                <dd className="flex flex-wrap gap-1">
                  {guest.dietaryRestrictions.map((d) => (
                    <Badge key={d} variant="secondary">
                      {d}
                    </Badge>
                  ))}
                </dd>
              </div>
            )}
            {guest.tags.length > 0 && (
              <div>
                <dt className="text-muted-foreground">{t("tags")}</dt>
                <dd className="flex flex-wrap gap-1">
                  {guest.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </dd>
              </div>
            )}
            {guest.notes && (
              <div>
                <dt className="text-muted-foreground">{t("notes")}</dt>
                <dd className="whitespace-pre-wrap">{guest.notes}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("visitHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {guest.reservations.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noReservations")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("time")}</TableHead>
                  <TableHead>{t("partySize")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guest.reservations.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
                    <TableCell>{r.time}</TableCell>
                    <TableCell>{r.partySize}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{t(r.status === "NO_SHOW" ? "noShow" : r.status.toLowerCase())}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/${locale}/admin/reservations?highlight=${r.id}`}>
                          {t("view")}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("editGuest")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-guest-name">{t("guestName")}</Label>
              <Input
                id="edit-guest-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-guest-notes">{t("notes")}</Label>
              <Textarea
                id="edit-guest-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-guest-seating">{t("tablePreference")}</Label>
              <Input
                id="edit-guest-seating"
                value={editSeating}
                onChange={(e) => setEditSeating(e.target.value)}
                placeholder={t("tablePreferenceAny")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-guest-dietary">{t("dietaryRestrictions")}</Label>
              <Input
                id="edit-guest-dietary"
                value={editDietary}
                onChange={(e) => setEditDietary(e.target.value)}
                placeholder="e.g. vegetarian, gluten-free"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-guest-tags">{t("tags")}</Label>
              <Input
                id="edit-guest-tags"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="e.g. VIP, regular"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "..." : t("saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
