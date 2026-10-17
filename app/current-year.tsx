"use client";

import { useEffect, useState } from "react";

export default function CurrentYear({
  className,
}: {
  className?: string;
}) {
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setYear(new Date().getFullYear());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <span className={className}>
      © {year ? `${year} ` : ""}PCKL+
    </span>
  );
}
