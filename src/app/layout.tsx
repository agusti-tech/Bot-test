import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Restaurant App",
  description: "Discover restaurants and browse their menus",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
