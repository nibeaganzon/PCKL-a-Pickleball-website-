"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PaymentItem, PaymentRecord, PaymentStatus } from "@/lib/payments";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";

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
  const { user, isAdmin, loading: authLoading } = useAuth();
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

  // Inventory CRUD test state
  const [adminCourts, setAdminCourts] = useState<
    Array<{ id: string; name: string; type: string; price: number; is_active: boolean }>
  >([]);
  const [adminEquipments, setAdminEquipments] = useState<
    Array<{ id: string; name: string; quantity: number; price: number }>
  >([]);
  const [newCourtName, setNewCourtName] = useState("");
  const [newCourtType, setNewCourtType] = useState<"Indoor" | "Outdoor">("Indoor");
  const [newCourtPrice, setNewCourtPrice] = useState("300");
  const [newEquipName, setNewEquipName] = useState("");
  const [newEquipQty, setNewEquipQty] = useState("20");
  const [newEquipPrice, setNewEquipPrice] = useState("50");
  const [crudLoading, setCrudLoading] = useState(false);

  const loadInventory = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: courtsData } = await supabase
        .from("courts")
        .select("id, name, type, price, is_active")
        .order("name");
      const { data: equipData } = await supabase
        .from("equipments")
        .select("id, name, quantity, price")
        .order("name");

      if (courtsData) setAdminCourts(courtsData);
      if (equipData) setAdminEquipments(equipData);
    } catch (err) {
      console.error("Failed to load inventory:", err);
    }
  }, []);



  async function handleCreateCourt(event: React.FormEvent) {
    event.preventDefault();
    if (!newCourtName.trim()) return;
    setCrudLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("admin_create_court", {
        p_name: newCourtName.trim(),
        p_type: newCourtType,
        p_price: Number(newCourtPrice) || 300,
      });
      if (error) throw error;
      setNewCourtName("");
      setNotice(`Court ${newCourtName.trim()} created.`);
      await loadInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create court.");
    } finally {
      setCrudLoading(false);
    }
  }

  async function handleToggleCourt(courtId: string, currentActive: boolean) {
    setCrudLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("courts")
        .update({ is_active: !currentActive })
        .eq("id", courtId);
      if (error) throw error;
      setNotice(`Court status updated.`);
      await loadInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle court status.");
    } finally {
      setCrudLoading(false);
    }
  }

  async function handleDeleteCourt(courtId: string, name: string) {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    setCrudLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("admin_delete_court", { p_id: courtId });
      if (error) throw error;
      setNotice(`Court ${name} deleted.`);
      await loadInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete court.");
    } finally {
      setCrudLoading(false);
    }
  }

  async function handleCreateEquipment(event: React.FormEvent) {
    event.preventDefault();
    if (!newEquipName.trim()) return;
    setCrudLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("admin_create_equipment", {
        p_name: newEquipName.trim(),
        p_quantity: Number(newEquipQty) || 1,
        p_price: Number(newEquipPrice) || 10,
      });
      if (error) throw error;
      setNewEquipName("");
      setNotice(`Equipment ${newEquipName.trim()} created.`);
      await loadInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create equipment.");
    } finally {
      setCrudLoading(false);
    }
  }

  async function handleUpdateEquipmentQty(equipId: string, newQty: number) {
    if (newQty < 0) return;
    setCrudLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("equipments")
        .update({ quantity: newQty })
        .eq("id", equipId);
      if (error) throw error;
      setNotice("Equipment quantity updated.");
      await loadInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update equipment quantity.");
    } finally {
      setCrudLoading(false);
    }
  }

  async function handleDeleteEquipment(equipId: string, name: string) {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    setCrudLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("admin_delete_equipment", { p_id: equipId });
      if (error) throw error;
      setNotice(`Equipment ${name} deleted.`);
      await loadInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete equipment.");
    } finally {
      setCrudLoading(false);
    }
  }

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
    if (!authLoading && user && isAdmin) {
      void loadPayments();
      void loadInventory();
    } else if (!authLoading && (!user || !isAdmin)) {
      setLoading(false);
    }
  }, [authLoading, user, isAdmin, loadPayments, loadInventory]);

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

  if (authLoading || loading) {
    return (
      <main className="admin-page">
        <section className="admin-main admin-access-state">
          <p>Verifying admin permissions...</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="admin-page">
        <section className="admin-main admin-access-state">
          <span className="admin-topbar-eyebrow">PCKL+ ADMINISTRATION</span>
          <h1>Sign in required</h1>
          <p>Sign in with an authorized PCKL+ administrator account to access the dashboard.</p>
          <Link href="/login?returnUrl=/admin" className="admin-confirm-button">
            Go to sign in
          </Link>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="admin-page">
        <section className="admin-main admin-access-state">
          <span className="admin-topbar-eyebrow">PCKL+ ADMINISTRATION</span>
          <h1>Admin access required</h1>
          <p>This account ({user.email}) is not authorized to access the PCKL+ administration portal.</p>
          <Link href="/login" className="admin-confirm-button">
            Switch account
          </Link>
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
          <a className="admin-side-link" href="#inventory-crud">
            <span className="admin-side-icon">⚙</span>
            Inventory CRUD Test
          </a>
          <Link className="admin-side-link" href="/">
            <span className="admin-side-icon">↗</span>
            Storefront
          </Link>
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
          <section className="admin-queue-panel" id="inventory-crud" style={{ marginTop: "2rem" }}>
            <div className="admin-section-heading admin-queue-heading">
              <div>
                <h2>Inventory CRUD Test Panel</h2>
                <p>Manage and test Court and Equipment CRUD operations directly via Supabase backend RPCs.</p>
              </div>
              <button
                type="button"
                className="admin-proof-button"
                onClick={() => void loadInventory()}
                disabled={crudLoading}
              >
                {crudLoading ? "Refreshing..." : "Refresh Inventory"}
              </button>
            </div>

            {/* Courts CRUD */}
            <div style={{ marginTop: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0 }}>Courts ({adminCourts.length})</h3>
              </div>

              <form onSubmit={handleCreateCourt} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
                <input
                  type="text"
                  placeholder="Court Name (e.g. Court 21)"
                  value={newCourtName}
                  onChange={(e) => setNewCourtName(e.target.value)}
                  style={{ padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #374151", background: "#1f2937", color: "#f9fafb" }}
                  required
                />
                <select
                  value={newCourtType}
                  onChange={(e) => setNewCourtType(e.target.value as "Indoor" | "Outdoor")}
                  style={{ padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #374151", background: "#1f2937", color: "#f9fafb" }}
                >
                  <option value="Indoor">Indoor</option>
                  <option value="Outdoor">Outdoor</option>
                </select>
                <input
                  type="number"
                  placeholder="Price"
                  value={newCourtPrice}
                  onChange={(e) => setNewCourtPrice(e.target.value)}
                  style={{ width: "100px", padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #374151", background: "#1f2937", color: "#f9fafb" }}
                  required
                />
                <button
                  type="submit"
                  className="admin-confirm-button"
                  disabled={crudLoading}
                >
                  ＋ Add Court
                </button>
              </form>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
                {adminCourts.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: "0.875rem",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "0.5rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong>{c.name}</strong>
                      <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                        {c.type} · ₱{c.price} ·{" "}
                        <span style={{ color: c.is_active ? "#10b981" : "#ef4444" }}>
                          {c.is_active ? "Active" : "Maintenance"}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.375rem" }}>
                      <button
                        type="button"
                        onClick={() => void handleToggleCourt(c.id, c.is_active)}
                        className="admin-proof-button"
                        style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                        disabled={crudLoading}
                      >
                        {c.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteCourt(c.id, c.name)}
                        className="admin-reject-button"
                        style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                        disabled={crudLoading}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Equipment CRUD */}
            <div style={{ marginTop: "2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0 }}>Equipment ({adminEquipments.length})</h3>
              </div>

              <form onSubmit={handleCreateEquipment} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
                <input
                  type="text"
                  placeholder="Equipment Name"
                  value={newEquipName}
                  onChange={(e) => setNewEquipName(e.target.value)}
                  style={{ padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #374151", background: "#1f2937", color: "#f9fafb" }}
                  required
                />
                <input
                  type="number"
                  placeholder="Stock"
                  value={newEquipQty}
                  onChange={(e) => setNewEquipQty(e.target.value)}
                  style={{ width: "90px", padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #374151", background: "#1f2937", color: "#f9fafb" }}
                  required
                />
                <input
                  type="number"
                  placeholder="Price/hr"
                  value={newEquipPrice}
                  onChange={(e) => setNewEquipPrice(e.target.value)}
                  style={{ width: "90px", padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #374151", background: "#1f2937", color: "#f9fafb" }}
                  required
                />
                <button
                  type="submit"
                  className="admin-confirm-button"
                  disabled={crudLoading}
                >
                  ＋ Add Equipment
                </button>
              </form>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
                {adminEquipments.map((eq) => (
                  <div
                    key={eq.id}
                    style={{
                      padding: "0.875rem",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "0.5rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong>{eq.name}</strong>
                      <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                        Stock: {eq.quantity} · ₱{eq.price}/hr
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.375rem" }}>
                      <button
                        type="button"
                        onClick={() => void handleUpdateEquipmentQty(eq.id, eq.quantity + 5)}
                        className="admin-proof-button"
                        style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                        disabled={crudLoading}
                      >
                        +5 Stock
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteEquipment(eq.id, eq.name)}
                        className="admin-reject-button"
                        style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                        disabled={crudLoading}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
