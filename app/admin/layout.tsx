
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Admin Dashboard | PCKL+",
  description:
    "Manage PCKL+ court reservations, equipment rentals, payment proofs, and daily sales.",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
