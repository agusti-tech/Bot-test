"use client";

import { Check, Calendar, Clock, Users, User } from "lucide-react";

interface ReservationInfo {
  id: string;
  date: string;
  time: string;
  partySize: number;
  guestName: string;
  status: string;
}

interface ReservationCardProps {
  reservation: ReservationInfo;
  locale: string;
}

export default function ReservationCard({
  reservation,
  locale,
}: ReservationCardProps) {
  const formattedDate = new Date(reservation.date + "T12:00:00").toLocaleDateString(
    locale === "de" ? "de-DE" : "en-US",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium text-sm">
        <Check className="h-4 w-4" />
        {locale === "de" ? "Reservierung bestätigt" : "Reservation Confirmed"}
      </div>
      <div className="space-y-1.5 text-xs text-green-800 dark:text-green-300">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5" />
          <span>{formattedDate}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          <span>{reservation.time}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5" />
          <span>
            {reservation.partySize}{" "}
            {locale === "de"
              ? reservation.partySize === 1
                ? "Person"
                : "Personen"
              : reservation.partySize === 1
                ? "guest"
                : "guests"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5" />
          <span>{reservation.guestName}</span>
        </div>
      </div>
    </div>
  );
}
