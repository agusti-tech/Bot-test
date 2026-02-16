"use client";

import { cn } from "@/lib/utils";
import ReservationCard from "./ReservationCard";

interface ReservationInfo {
  id: string;
  date: string;
  time: string;
  partySize: number;
  guestName: string;
  status: string;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  reservation?: ReservationInfo;
  locale: string;
}

export default function ChatMessage({
  role,
  content,
  reservation,
  locale,
}: ChatMessageProps) {
  return (
    <div
      className={cn(
        "flex w-full mb-3",
        role === "user" ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          role === "user"
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md"
        )}
      >
        {content.split("\n").map((line, i) => (
          <p key={i} className={i > 0 ? "mt-1.5" : ""}>
            {formatLine(line)}
          </p>
        ))}
        {reservation && (
          <div className="mt-3">
            <ReservationCard reservation={reservation} locale={locale} />
          </div>
        )}
      </div>
    </div>
  );
}

function formatLine(text: string): React.ReactNode {
  // Simple bold formatting: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
