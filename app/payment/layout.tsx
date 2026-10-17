import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Payment | PCKL+",
  description: "Submit and check the status of your PCKL+ payment.",
};

export default function PaymentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}