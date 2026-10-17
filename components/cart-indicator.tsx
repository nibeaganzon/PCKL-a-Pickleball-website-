"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  CART_UPDATED_EVENT,
  getCartItemCount,
} from "@/lib/cart";

function subscribe(callback: () => void) {
  window.addEventListener(CART_UPDATED_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CART_UPDATED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export default function CartIndicator({
  className,
}: {
  className: string;
}) {
  const count = useSyncExternalStore(subscribe, getCartItemCount, () => 0);

  return (
    <Link
      href="/cart"
      className={className}
      aria-label={`Shopping cart, ${count} ${count === 1 ? "item" : "items"}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H6" />
        <circle cx="10" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </svg>
      <span className="cart-indicator-label">Cart</span>
      <span className="cart-indicator-count" aria-live="polite">{count}</span>
    </Link>
  );
}
