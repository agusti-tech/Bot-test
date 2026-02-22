"use client";

import dynamic from "next/dynamic";

const ChatWidget = dynamic(() => import("@/components/chat/ChatWidget"), {
  ssr: false,
});

export default function ChatWidgetWrapper({
  restaurantId,
  restaurantName,
}: {
  restaurantId: string;
  restaurantName: string;
}) {
  return (
    <ChatWidget restaurantId={restaurantId} restaurantName={restaurantName} />
  );
}
