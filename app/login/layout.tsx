import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Log In | PCKL+",
  description:
    "Log in to PCKL+ to book pickleball courts, rent equipment, and manage your membership card in General Santos City.",
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}