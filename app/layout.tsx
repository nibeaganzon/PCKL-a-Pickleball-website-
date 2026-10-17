import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PCKL+ | Pickleball Booking in General Santos City",
  description:
    "Book pickleball courts, rent equipment, and manage your PCKL+ membership card at one convenient location in General Santos City.",
  applicationName: "PCKL+",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}