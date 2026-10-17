"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PaymentItem, PaymentStatus } from "@/lib/payments";

type ConfirmationRecord = {
  order_reference: string;
  status: PaymentStatus;
  created_at: string;
  reviewed_at: string | null;
  cart: PaymentItem[];
  amount: number;
  payment_type: "order" | "top_up";
  payment_method: "external" | "membership_card";
  membership_card_id: string | null;
  balance_after: number | null;
};

function formatPeso(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function PaymentConfirmationPage() {
  const [reference, setReference] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationRecord | null>(
    null
  );
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

      async function loadConfirmation() {
        try {
          const response = await fetch(
            `/api/payments/${encodeURIComponent(validReference)}`,
            { cache: "no-store" }
          );
          const result = await response.json();
          if (!response.ok) {
            throw new Error(
              result.message || "Confirmation details could not be loaded."
            );
          }
          if (active) {
            setConfirmation(result.payment);
            setError("");
          }
        } catch (loadError) {
          if (active) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Confirmation details could not be loaded."
            );
          }
        } finally {
          if (active) setLoading(false);
        }
      }

      void loadConfirmation();
      intervalId = window.setInterval(
        () => void loadConfirmation(),
        15000
      );
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timerId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [refreshKey]);

  const isConfirmed = confirmation?.status === "confirmed";
  const courtItems =
    confirmation?.cart.filter((item) => item.type === "court") ?? [];
  const equipmentItems =
    confirmation?.cart.filter((item) => item.type === "equipment") ?? [];
  const isTopUp = confirmation?.payment_type === "top_up";

  return (
    <main className="payment-page">
      <header className="payment-header">
        <Link href="/" className="payment-logo">
          PCKL<span>+</span>
        </Link>
        <span className="secure-label">ORDER CONFIRMATION</span>
      </header>

      <div className="payment-container payment-confirmation">
        <section className="payment-confirmation-heading">
          <span
            className={`payment-success-icon ${
              confirmation?.status === "rejected"
                ? "payment-status-icon-rejected"
                : ""
            }`}
            aria-hidden="true"
          >
            {loading
              ? "◷"
              : confirmation?.status === "confirmed"
                ? "✓"
                : confirmation?.status === "rejected"
                  ? "!"
                  : "◷"}
          </span>
          <p className="eyebrow">
            {loading
              ? "LOADING CONFIRMATION"
              : confirmation?.status === "confirmed"
                ? "PAYMENT CONFIRMED"
                : confirmation?.status === "rejected"
                  ? "PAYMENT REJECTED"
                  : confirmation?.status === "pending"
                    ? "PAYMENT PENDING"
                    : "CONFIRMATION UNAVAILABLE"}
          </p>
          <h1>
            {loading
              ? "Loading your order..."
              : confirmation?.status === "confirmed"
                ? isTopUp
                  ? "Your membership card is topped up."
                  : "Your order is confirmed."
                : confirmation?.status === "rejected"
                  ? "Your order needs attention."
                  : confirmation?.status === "pending"
                    ? "Your payment is being reviewed."
                    : "We couldn’t load your order."}
          </h1>
          <p>
            {isConfirmed
              ? isTopUp
                ? "The verified top-up has been added to your PCKL+ membership card."
                : confirmation?.payment_method === "membership_card"
                  ? "Your membership card was charged immediately and your booking or rental is confirmed."
                  : "Your payment and the booking or rental items below have been confirmed by PCKL+."
              : confirmation?.status === "rejected"
                ? "Your payment could not be verified. Please contact PCKL+ and include your order reference."
                : confirmation?.status === "pending"
                  ? isTopUp
                    ? "An administrator will verify your receipt. Your card balance will be credited after approval."
                    : "Your reservation and rental are not confirmed until an administrator verifies your payment."
                  : "We’ll show your booking, rental, and payment details here when the order is available."}
          </p>
          {reference && (
            <div className="payment-confirmation-reference">
              <span>ORDER REFERENCE</span>
              <strong>{reference}</strong>
            </div>
          )}
          {error && (
            <p className="payment-status-error" role="alert">
              {error}
            </p>
          )}
          {!loading && confirmation && (
            <div className="payment-confirmation-actions">
              {!isConfirmed && (
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
              )}
              <Link
                href={`/payment/submitted?reference=${encodeURIComponent(
                  confirmation.order_reference
                )}`}
                className="payment-status-home"
              >
                View payment status
              </Link>
            </div>
          )}
        </section>

        {confirmation && (
          <section className="payment-confirmation-details">
            {isTopUp && (
              <div className="payment-confirmation-group">
                <div className="payment-confirmation-group-heading">
                  <span aria-hidden="true">₱</span>
                  <div>
                    <h2>Membership card top-up</h2>
                    <p>
                      Card ID: {confirmation.membership_card_id ?? "Unavailable"}
                    </p>
                  </div>
                </div>
                <article className="payment-confirmation-item">
                  <div>
                    <strong>Top-up amount</strong>
                    <span>
                      {isConfirmed
                        ? "Added to your card balance"
                        : "Awaiting admin approval"}
                    </span>
                  </div>
                  <strong>{formatPeso(confirmation.amount)}</strong>
                </article>
              </div>
            )}

            {courtItems.length > 0 && (
              <div className="payment-confirmation-group">
                <div className="payment-confirmation-group-heading">
                  <span aria-hidden="true">▣</span>
                  <div>
                    <h2>Court reservation{courtItems.length === 1 ? "" : "s"}</h2>
                    <p>
                      {isConfirmed
                        ? "Your confirmed court booking details"
                        : "Requested court booking details"}
                    </p>
                  </div>
                </div>
                {courtItems.map((item, index) => (
                  <article
                    className="payment-confirmation-item"
                    key={`${item.id}-${index}`}
                  >
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        {item.date ? formatDate(item.date) : "Date unavailable"}
                      </span>
                      <span>
                        {item.startTime ?? "Time unavailable"}
                        {item.endTime ? `–${item.endTime}` : ""}
                        {" · "}
                        {item.durationHours}{" "}
                        {item.durationHours === 1 ? "hour" : "hours"}
                      </span>
                    </div>
                    <strong>
                      {formatPeso(
                        item.unitPrice * item.durationHours * item.quantity
                      )}
                    </strong>
                  </article>
                ))}
              </div>
            )}

            {equipmentItems.length > 0 && (
              <div className="payment-confirmation-group">
                <div className="payment-confirmation-group-heading">
                  <span aria-hidden="true">▤</span>
                  <div>
                    <h2>Equipment rental{equipmentItems.length === 1 ? "" : "s"}</h2>
                    <p>
                      {isConfirmed
                        ? "Your confirmed rental details"
                        : "Requested equipment rental details"}
                    </p>
                  </div>
                </div>
                {equipmentItems.map((item, index) => (
                  <article
                    className="payment-confirmation-item"
                    key={`${item.id}-${index}`}
                  >
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        Quantity: {item.quantity} · {item.durationHours}{" "}
                        {item.durationHours === 1 ? "hour" : "hours"}
                      </span>
                    </div>
                    <strong>
                      {formatPeso(
                        item.unitPrice * item.durationHours * item.quantity
                      )}
                    </strong>
                  </article>
                ))}
              </div>
            )}

            <div className="payment-confirmation-total">
              <div>
                <span>Payment status</span>
                <strong className={`confirmation-status-${confirmation.status}`}>
                  {confirmation.status.charAt(0).toUpperCase() +
                    confirmation.status.slice(1)}
                </strong>
              </div>
              <div>
                <span>{isTopUp ? "Top-up amount" : "Order total"}</span>
                <strong>{formatPeso(confirmation.amount)}</strong>
              </div>
              {confirmation.payment_method === "membership_card" && (
                <div>
                  <span>Paid with</span>
                  <strong>Membership card</strong>
                </div>
              )}
              {confirmation.balance_after !== null && (
                <div>
                  <span>Card balance after transaction</span>
                  <strong>{formatPeso(confirmation.balance_after)}</strong>
                </div>
              )}
              <div>
                <span>Submitted</span>
                <strong>
                  {new Date(confirmation.created_at).toLocaleString("en-PH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </strong>
              </div>
              {confirmation.reviewed_at && (
                <div>
                  <span>Payment reviewed</span>
                  <strong>
                    {new Date(confirmation.reviewed_at).toLocaleString(
                      "en-PH",
                      { dateStyle: "medium", timeStyle: "short" }
                    )}
                  </strong>
                </div>
              )}
            </div>
          </section>
        )}

        <div className="payment-confirmation-footer">
          <Link href="/" className="primary-button">
            Return home
          </Link>
          <Link href="/courts" className="payment-status-home">
            Browse courts
          </Link>
        </div>
      </div>
    </main>
  );
}
