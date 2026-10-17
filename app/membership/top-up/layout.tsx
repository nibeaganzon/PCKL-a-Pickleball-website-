import type { Metadata } from "next";
import "../../payment/globals.css";

export const metadata: Metadata = {
  title: "Top Up Membership Card | PCKL+",
  description: "Add funds to your PCKL+ membership card.",
};

export default function MembershipTopUpLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
