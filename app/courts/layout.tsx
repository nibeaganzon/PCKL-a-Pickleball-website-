import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Book a Court | PCKL+",
  description:
    "Explore 20 pickleball courts at PCKL+ in General Santos City and find a court for your next match.",
};

export default function CourtsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}