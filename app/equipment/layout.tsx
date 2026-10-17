
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rent Equipment | PCKL+",
  description:
    "Rent pickleball paddles and balls by the hour at PCKL+ in General Santos City.",
};

export default function EquipmentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
