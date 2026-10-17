"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PaymentItem, PaymentRecord, PaymentStatus } from "@/lib/payments";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Activity = {
  id: string;
  description: string;
  amount: number;
  time: string;
  type: "confirmed" | "rejected";
};

type PaymentTab = "all" | "courts" | "equipment" | "top-ups";

function formatPeso(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`admin-status admin-status-${status}`}>
      <span className="admin-status-dot" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function describeItems(items: PaymentItem[]) {
  return items
    .map((item) =>
      item.type === "court"
        ? `${item.name}${item.date ? ` · ${item.date}` : ""}`
        : `${item.quantity} × ${item.name}`
    )
    .join(", ");
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [adminEmail, setAdminEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState("");
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState<"login" | "admin" | null>(
    null
  );
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<PaymentTab>("all");
  const [selectedPayment, setSelectedPayment] =
    useState<PaymentRecord | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);

  const loadPayments = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/payments", {
        cache: "no-store",
      });
      const result = await response.json();

      if (response.status === 401) {
        setAccessDenied("login");
        return;
      }
      if (response.status === 403) {
        setAccessDenied("admin");
        return;
      }
      if (!response.ok) {
        throw new Error(result.message || "Pending payments could not be loaded.");
      }

      setPayments(result.payments);
      setAdminEmail(result.adminEmail ?? "");
      setError("");
      setAccessDenied(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Pending payments could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadPayments();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadPayments]);

  const visiblePayments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return payments.filter((payment) => {
      const matchesTab =
        tab === "all" ||
        (tab === "top-ups"
          ? payment.payment_type === "top_up"
          : payment.cart.some((item) =>
              tab === "courts"
                ? item.type === "court"
                : item.type === "equipment"
            ));
      const matchesSearch =
        !query ||
        [
          payment.order_reference,
          payment.customer_name,
          payment.customer_email,
          payment.payment_reference,
          payment.membership_card_id ?? "",
          describeItems(payment.cart),
        ].some((value) => value.toLowerCase().includes(query));
      return matchesTab && matchesSearch;
    });
  }, [payments, search, tab]);

  const queueSummary = useMemo(
    () =>
      payments.reduce(
        (summary, payment) => {
          summary.amount += payment.amount;
          summary.courts += payment.cart.filter(
            (item) => item.type === "court"
          ).length;
          summary.equipment += payment.cart.filter(
            (item) => item.type === "equipment"
          ).length;
          return summary;
        },
        { amount: 0, courts: 0, equipment: 0 }
      ),
    [payments]
  );

  async function reviewPayment(
    payment: PaymentRecord,
    status: Exclude<PaymentStatus, "pending">
  ) {
    setReviewingId(payment.id);
    setError("");

    try {
      const response = await fetch(`/api/admin/payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "This payment could not be updated.");
      }

      setPayments((current) =>
        current.filter((item) => item.id !== payment.id)
      );
      setActivity((current) => [
        {
          id: payment.id,
          description: `${payment.order_reference} · Payment ${status}`,
          amount: payment.amount,
          time: new Date().toLocaleTimeString("en-PH", {
            hour: "numeric",
            minute: "2-digit",
          }),
          type: status,
        },
        ...current,
      ]);
      setNotice(`${payment.order_reference} marked as ${status}.`);
      setSelectedPayment(null);
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "This payment could not be updated."
      );
    } finally {
      setReviewingId("");
    }
  }

  async function logOut() {
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      router.push("/login");
    } catch (signOutError) {
      setError(
        signOutError instanceof Error
          ? signOutError.message
          : "Unable to sign out."
      );
    }
  }

  if (loading) {
    return (
      <main className="admin-page">
        <section className="admin-main admin-access-state">
          <p>Loading pending payments...</p>
        </section>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="admin-page">
        <section className="admin-main admin-access-state">
          <span className="admin-topbar-eyebrow">PCKL+ ADMINISTRATION</span>
          <h1>{accessDenied === "login" ? "Sign in required" : "Admin access required"}</h1>
          <p>
            {accessDenied === "login"
              ? "Sign in with an authorized PCKL+ administrator account to review payments."
              : "This account is not authorized to review payments."}
          </p>
          <Link href="/login" className="admin-confirm-button">
            {accessDenied === "login" ? "Go to sign in" : "Switch account"}
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <Link href="/" className="admin-brand">
          PCKL<span>+</span>
        </Link>

        <div className="admin-sidebar-label">WORKSPACE</div>

        <nav className="admin-side-nav" aria-label="Admin navigation">
          <a className="admin-side-link admin-side-link-active" href="#overview">
            <span className="admin-side-icon">▦</span>
            Dashboard
          </a>
          <a className="admin-side-link" href="#payments">
            <span className="admin-side-icon">₱</span>
            Payment review
            {payments.length > 0 && (
              <span className="admin-side-count">{payments.length}</span>
            )}
          </a>
          <a className="admin-side-link" href="#activity">
            <span className="admin-side-icon">◷</span>
            Recent activity
          </a>
        </nav>

        <div className="admin-sidebar-bottom">
          <div className="admin-location-icon">⌖</div>
          <div>
            <strong>PCKL+ General Santos</strong>
            <span>Single-location facility</span>
          </div>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="admin-topbar-eyebrow">ADMINISTRATION</span>
            <h1>Dashboard</h1>
          </div>

          <div className="admin-topbar-right">
            <div className="admin-date">
              <span>◷</span>
              {new Date().toLocaleDateString("en-PH", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            <div className="admin-profile">
              <div className="admin-avatar">
                {(adminEmail.charAt(0) || "A").toUpperCase()}
              </div>
              <div>
                <strong>{adminEmail || "Administrator"}</strong>
                <span>Authorized admin</span>
              </div>
            </div>
            <button type="button" className="admin-logout" onClick={logOut}>
              Log out
            </button>
          </div>
        </header>

        <div className="admin-content">
          <section className="admin-welcome" id="overview">
            <div>
              <span className="admin-welcome-label">PCKL+ MANAGEMENT</span>
              <h2>Payment review queue.</h2>
              <p>
                Verify submitted receipts and confirm or reject each customer
                payment.
              </p>
            </div>
            <div className="admin-welcome-mark">P<span>+</span></div>
          </section>

          {notice && (
            <div className="admin-notice" role="status">
              <span>✓</span>
              {notice}
              <button
                type="button"
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          )}

          {error && <div className="admin-error" role="alert">{error}</div>}

          <section className="admin-stat-grid" id="sales">
            <article className="admin-stat-card admin-stat-highlight">
              <div className="admin-stat-top">
                <span>Pending payments</span>
                <span className="admin-stat-icon">◷</span>
              </div>
              <strong>{payments.length}</strong>
              <p>Awaiting receipt verification</p>
            </article>

            <article className="admin-stat-card">
              <div className="admin-stat-top">
                <span>Amount to verify</span>
                <span className="admin-stat-icon">₱</span>
              </div>
              <strong>{formatPeso(queueSummary.amount)}</strong>
              <p>Pending customer submissions</p>
            </article>

            <article className="admin-stat-card">
              <div className="admin-stat-top">
                <span>Court reservations</span>
                <span className="admin-stat-icon">▣</span>
              </div>
              <strong>{queueSummary.courts}</strong>
              <p>Across pending payments</p>
            </article>

            <article className="admin-stat-card">
              <div className="admin-stat-top">
                <span>Equipment rentals</span>
                <span className="admin-stat-icon">▤</span>
              </div>
              <strong>{queueSummary.equipment}</strong>
              <p>Across pending payments</p>
            </article>
          </section>

          <section className="admin-queue-panel" id="payments">
            <div className="admin-section-heading admin-queue-heading">
              <div>
                <h2>Pending Payments</h2>
                <p>Open a payment to review its receipt and details.</p>
              </div>

              <div className="admin-queue-actions">
                <label className="admin-search">
                  <span>⌕</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search customer or order..."
                    aria-label="Search pending payments"
                  />
                </label>
                <button
                  type="button"
                  className="admin-proof-button"
                  onClick={() => void loadPayments()}
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="admin-tabs" role="tablist" aria-label="Payment type">
              {(
                [
                  ["all", "All payments"],
                  ["courts", "Court reservations"],
                  ["equipment", "Equipment rentals"],
                  ["top-ups", "Membership top-ups"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  className={tab === value ? "active" : ""}
                  onClick={() => setTab(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="admin-request-group">
              <h3>
                Submitted payments
                <span>{visiblePayments.length}</span>
              </h3>

              {visiblePayments.length === 0 ? (
                <p className="admin-empty-row">
                  {payments.length === 0
                    ? "There are no pending payments to review."
                    : "No payments match your search and filter."}
                </p>
              ) : (
                visiblePayments.map((payment) => (
                  <article className="admin-request-card" key={payment.id}>
                    <div className="admin-request-main">
                      <div className="admin-request-icon admin-court-icon">₱</div>
                      <div className="admin-request-info">
                        <div className="admin-request-title-row">
                          <h4>{payment.order_reference}</h4>
                          <StatusBadge status={payment.status} />
                        </div>
                        <p>
                          {payment.customer_name} · {payment.customer_email}
                        </p>
                        <div className="admin-request-meta">
                          <span>
                            {payment.payment_type === "top_up"
                              ? `Membership card top-up · ${payment.membership_card_id ?? "Card ID unavailable"}`
                              : describeItems(payment.cart)}
                          </span>
                        </div>
                        <span className="admin-submitted">
                          Submitted {formatDate(payment.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="admin-request-side">
                      <strong>{formatPeso(payment.amount)}</strong>
                      <button
                        type="button"
                        className="admin-proof-button"
                        onClick={() => setSelectedPayment(payment)}
                      >
                        Review payment
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="admin-activity-panel" id="activity">
            <div className="admin-section-heading">
              <div>
                <h2>Recent Activity</h2>
                <p>Payment decisions made during this dashboard session.</p>
              </div>
            </div>

            {activity.length === 0 ? (
              <p className="admin-activity-empty">
                No actions yet. Confirm or reject a payment to see activity
                here.
              </p>
            ) : (
              <div className="admin-activity-list">
                {activity.map((item) => (
                  <div className="admin-activity-row" key={item.id}>
                    <span
                      className={`admin-activity-icon ${
                        item.type === "confirmed"
                          ? "activity-confirmed"
                          : "activity-rejected"
                      }`}
                    >
                      {item.type === "confirmed" ? "✓" : "×"}
                    </span>
                    <div className="admin-activity-description">
                      <strong>{item.description}</strong>
                      <span>{item.time}</span>
                    </div>
                    <strong>{formatPeso(item.amount)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="admin-footer">
          <span>PCKL+ Admin Portal</span>
          <span>General Santos City · 20 Courts</span>
        </footer>
      </section>

      {selectedPayment && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !reviewingId) {
              setSelectedPayment(null);
            }
          }}
        >
          <section
            className="admin-proof-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="proof-modal-title"
          >
            <div className="admin-modal-header">
              <div>
                <span className="admin-modal-eyebrow">
                  {selectedPayment.payment_type === "top_up"
                    ? "MEMBERSHIP TOP-UP"
                    : "PAYMENT VERIFICATION"}
                </span>
                <h2 id="proof-modal-title">Review Payment</h2>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setSelectedPayment(null)}
                aria-label="Close payment review"
                disabled={Boolean(reviewingId)}
              >
                ×
              </button>
            </div>

            <div className="admin-proof-details">
              <div className="admin-proof-summary">
                <span>Order reference</span>
                <strong>{selectedPayment.order_reference}</strong>
              </div>
              <div className="admin-proof-summary">
                <span>Customer</span>
                <strong>
                  {selectedPayment.customer_name}
                  <br />
                  {selectedPayment.customer_email}
                </strong>
              </div>
              <div className="admin-proof-summary">
                <span>Payment reference</span>
                <strong>{selectedPayment.payment_reference}</strong>
              </div>
              {selectedPayment.payment_type === "top_up" && (
                <div className="admin-proof-summary">
                  <span>Membership card ID</span>
                  <strong>{selectedPayment.membership_card_id}</strong>
                </div>
              )}
              <div className="admin-proof-summary">
                <span>
                  {selectedPayment.payment_type === "top_up"
                    ? "Top-up amount"
                    : "Order details"}
                </span>
                <strong>
                  {selectedPayment.cart.map((item, index) => (
                    <span className="admin-payment-item" key={`${item.id}-${index}`}>
                      {item.quantity} × {item.name}
                      {item.date ? ` · ${item.date}` : ""}
                      {item.startTime
                        ? ` · ${item.startTime}${item.endTime ? `–${item.endTime}` : ""}`
                        : ""}
                      {` · ${item.durationHours} hour${item.durationHours === 1 ? "" : "s"}`}
                    </span>
                  ))}
                </strong>
              </div>
              <div className="admin-proof-summary">
                <span>Amount to verify</span>
                <strong>{formatPeso(selectedPayment.amount)}</strong>
              </div>

              <div className="admin-proof-image">
                <a
                  href={selectedPayment.proof_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    src={selectedPayment.proof_url}
                    alt={`Payment receipt for ${selectedPayment.order_reference}`}
                  />
                </a>
              </div>

              <p className="admin-verification-warning">
                Confirm only after verifying the receipt, amount, and payment
                reference. Confirming a top-up adds funds to the membership
                card immediately. This action cannot be undone from the queue.
              </p>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-reject-button"
                  onClick={() => void reviewPayment(selectedPayment, "rejected")}
                  disabled={Boolean(reviewingId)}
                >
                  {reviewingId === selectedPayment.id ? "Saving..." : "Reject"}
                </button>
                <button
                  type="button"
                  className="admin-confirm-button"
                  onClick={() => void reviewPayment(selectedPayment, "confirmed")}
                  disabled={Boolean(reviewingId)}
                >
                  {reviewingId === selectedPayment.id
                    ? "Saving..."
                    : "Confirm payment"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
