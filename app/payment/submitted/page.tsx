"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PaymentStatus } from "@/lib/payments";

type PaymentStatusResult = {
  order_reference: string;
  status: PaymentStatus;
  payment_type: "order" | "top_up";
  created_at: string;
};

const statusCopy: Record<PaymentStatus, { title: string; description: string }> = {
  pending: {
    title: "Your payment is in review.",
    description:
      "We saved your receipt and order. An administrator will verify the payment before confirming your reservation or rental.",
  },
  confirmed: {
    title: "Your payment is confirmed.",
    description:
      "Your payment is confirmed and your order is complete.",
  },
  rejected: {
    title: "Your payment was not confirmed.",
    description:
      "An administrator could not verify this payment. Please contact PCKL+ and provide your order reference.",
  },
};

export default function SubmittedPaymentPage() {
  const [reference, setReference] = useState("");
  const [payment, setPayment] = useState<PaymentStatusResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    let intervalId: number | undefined;
    const timerId = window.setTimeout(() => {
      const orderReference = new URLSearchParams(window.location.search).get(
        "reference"
      );
      if (!orderReference || !/^PAY-[0-9A-F]{20}$/.test(orderReference)) {
        setError("The order reference is missing or invalid.");
        setLoading(false);
        return;
      }

      const validReference = orderReference;
      setReference(validReference);

      async function loadStatus() {
        try {
          const response = await fetch(
            `/api/payments/${encodeURIComponent(validReference)}`,
            { cache: "no-store" }
          );
          const result = await response.json();
          if (!response.ok) {
            throw new Error(
              result.message || "Payment status could not be loaded."
            );
          }
          if (active) {
            setPayment(result.payment);
            setError("");
          }
        } catch (statusError) {
          if (active) {
            setError(
              statusError instanceof Error
                ? statusError.message
                : "Payment status could not be loaded."
            );
          }
        } finally {
          if (active) setLoading(false);
        }
      }

      void loadStatus();
      intervalId = window.setInterval(() => void loadStatus(), 15000);
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timerId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [refreshKey]);

  const status = payment?.status;
  const copy = status
    ? payment?.payment_type === "top_up" && status === "pending"
      ? {
          title: "Your top-up is in review.",
          description:
            "An authorized administrator will verify your receipt. Your card will be credited after approval.",
        }
      : payment?.payment_type === "top_up" && status === "confirmed"
        ? {
            title: "Your card has been topped up.",
            description:
              "Your payment was approved and the funds have been added to your membership card.",
          }
        : statusCopy[status]
    : null;

  return (
    <main className="payment-page">
      <header className="payment-header">
        <Link href="/" className="payment-logo">
          PCKL<span>+</span>
        </Link>
        <span className="secure-label">PAYMENT STATUS</span>
      </header>

      <section className="payment-container payment-success">
        <span className="payment-success-icon" aria-hidden="true">
          {status === "confirmed"
            ? "✓"
            : status === "pending"
              ? "◷"
              : "!"}
        </span>
        <p className="eyebrow">
          {loading
            ? "LOADING STATUS"
            : status
              ? status.toUpperCase()
              : "STATUS UNAVAILABLE"}
        </p>
        <h1>
          {loading
            ? "Checking your payment..."
            : copy?.title ?? "Payment status unavailable."}
        </h1>
        {!loading && copy && <p>{copy.description}</p>}
        {error && (
          <p className="payment-status-error" role="alert">
            {error}
          </p>
        )}
        {reference && <strong>{reference}</strong>}
        {!loading && status === "confirmed" && reference && (
          <Link
            href={`/payment/confirmation?reference=${encodeURIComponent(reference)}`}
            className="primary-button payment-confirmation-link"
          >
            {payment?.payment_type === "top_up"
              ? "View top-up confirmation"
              : "View booking & rental confirmation"}
          </Link>
        )}
        <p className="payment-status-refresh">
          This page checks for updates automatically.
        </p>
        <div className="payment-status-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setLoading(true);
              setRefreshKey((current) => current + 1);
            }}
          >
            Refresh status
          </button>
          <Link href="/" className="payment-status-home">
            Return home
          </Link>
        </div>
      </section>
    </main>
  );
}
