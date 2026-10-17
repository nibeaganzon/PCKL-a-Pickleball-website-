import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Create Account | PCKL+",
  description:
    "Create your PCKL+ account to book pickleball courts, rent equipment, and manage your membership card in General Santos City.",
};

export default function RegisterLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}