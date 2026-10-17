
import type { Metadata } from "next";
import "../equipment/globals.css";

export const metadata: Metadata = {
  title: "Your Cart | PCKL+",
  description:
    "Review court reservations and equipment rentals before checkout.",
};

export default function CartLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
