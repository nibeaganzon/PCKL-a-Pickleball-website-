"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import type { PaymentItem, PaymentRecord, PaymentStatus } from "@/lib/payments";
import { useInventory } from "@/lib/use-inventory";
import type { CourtStatus, InventoryItem } from "@/lib/inventory";

type Activity = {
  id: string;
  description: string;
  amount: number;
  time: string;
  type: "confirmed" | "rejected";
};

type BookingRecord = {
  paymentId: string;
  orderReference: string;
  customerName: string;
  customerEmail: string;
  itemIndex: number;
  item: PaymentItem;
  status: string;
  historyAt: string;
};

type InventoryDraft = {
  id?: string;
  kind: "court" | "equipment";
  name: string;
  description: string;
  price: string;
  quantity: string;
  courtType: "Indoor" | "Outdoor";
  status: CourtStatus;
  image: string;
};

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

function formatBookingDate(value: string | undefined) {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return value;
  }
  return `${month}/${day}/${year}`;
}

function formatBookingTime(value: string | undefined) {
  if (!value) return "";
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return value;

  const hours = Number(match[1]);
  const minutes = match[2];
  const period = hours < 12 ? "AM" : "PM";
  return `${hours % 12 || 12}:${minutes} ${period}`;
}

function formatBookingDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function escapeCsvValue(value: string | number) {
  const text = String(value);
  const safeText =
    typeof value === "string" && /^[\t\r ]*[=+\-@]/.test(text)
      ? `'${text}`
      : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`admin-status admin-status-${status}`}>
      <span className="admin-status-dot" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function BookingStatusBadge({ status }: { status: string }) {
  const className = status.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return (
    <span className={`admin-status admin-status-${className}`}>
      <span className="admin-status-dot" />
      {status}
    </span>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { signOut } = useAuth();
  const {
    courts: inventoryCourts,
    equipment: inventoryEquipment,
    loading: loadingInventory,
    error: inventoryError,
    saveInventoryItem: persistInventoryItem,
    deleteInventoryItem: removeInventoryItem,
  } = useInventory();
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
  const [selectedPayment, setSelectedPayment] =
    useState<PaymentRecord | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingError, setBookingError] = useState("");
  const [selectedBooking, setSelectedBooking] =
    useState<BookingRecord | null>(null);
  const [inventoryDraft, setInventoryDraft] =
    useState<InventoryDraft | null>(null);
  const [savingInventory, setSavingInventory] = useState(false);
  const [inventoryImagePreview, setInventoryImagePreview] = useState("");
  const [pendingInventoryImage, setPendingInventoryImage] = useState<File | null>(
    null
  );
  const [inventoryImageError, setInventoryImageError] = useState("");

  useEffect(() => {
    if (!pendingInventoryImage || !inventoryImagePreview.startsWith("blob:")) {
      return;
    }
    return () => URL.revokeObjectURL(inventoryImagePreview);
  }, [inventoryImagePreview, pendingInventoryImage]);

  const loadPayments = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/top-ups", {
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
        throw new Error(
          result.message || "Pending top-ups could not be loaded."
        );
      }

      setPayments(result.payments);
      setAdminEmail(result.adminEmail ?? "");
      setError("");
      setAccessDenied(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Pending top-ups could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBookings = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/bookings", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result.message || "Booking history could not be loaded."
        );
      }

      setBookings((result.bookings ?? []) as BookingRecord[]);
      setBookingError("");
    } catch (loadError) {
      setBookingError(
        loadError instanceof Error
          ? loadError.message
          : "Booking history could not be loaded."
      );
    } finally {
      setLoadingBookings(false);
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void Promise.all([loadPayments(), loadBookings()]);
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadBookings, loadPayments]);

  const topUpPayments = useMemo(
    () => payments.filter((payment) => payment.payment_type === "top_up"),
    [payments]
  );

  const visibleTopUps = useMemo(() => {
    const query = search.trim().toLowerCase();
    return topUpPayments.filter((payment) => {
      const matchesSearch =
        !query ||
        [
          payment.order_reference,
          payment.customer_name,
          payment.customer_email,
          payment.payment_reference,
          payment.membership_card_id ?? "",
        ].some((value) => value.toLowerCase().includes(query));
      return matchesSearch;
    });
  }, [topUpPayments, search]);

  const pendingTopUpAmount = useMemo(
    () => topUpPayments.reduce((amount, payment) => amount + payment.amount, 0),
    [topUpPayments]
  );

  const historySummary = useMemo(
    () =>
      bookings.reduce(
        (summary, booking) => {
          summary[booking.item.type] += 1;
          return summary;
        },
        { court: 0, equipment: 0 }
      ),
    [bookings]
  );

  function exportBookingHistory() {
    const headers = [
      "Order Reference",
      "Customer Name",
      "Customer Email",
      "Booking Type",
      "Item",
      "Booking Date",
      "Start Time",
      "End Time",
      "Quantity",
      "Duration Hours",
      "Unit Price (PHP)",
      "Total (PHP)",
      "Status",
      "Recorded At",
    ];
    const rows = bookings.map((booking) => [
      booking.orderReference,
      booking.customerName,
      booking.customerEmail,
      booking.item.type,
      booking.item.name,
      formatBookingDate(booking.item.date),
      formatBookingTime(booking.item.startTime),
      formatBookingTime(booking.item.endTime),
      booking.item.quantity,
      booking.item.durationHours,
      booking.item.unitPrice,
      booking.item.unitPrice *
        booking.item.quantity *
        booking.item.durationHours,
      booking.status,
      formatBookingDateTime(booking.historyAt),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\r\n");
    const file = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `booking-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function reviewPayment(
    payment: PaymentRecord,
    status: Exclude<PaymentStatus, "pending">
  ) {
    setReviewingId(payment.id);
    setError("");

    try {
      if (payment.payment_type !== "top_up") {
        throw new Error("Only membership top-ups can be reviewed.");
      }
      const response = await fetch(`/api/admin/top-ups/${payment.id}`, {
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

  function openInventoryEditor(
    item?: InventoryItem,
    kind: "court" | "equipment" = "court"
  ) {
    setInventoryDraft({
      id: item?.id,
      kind: item?.kind ?? kind,
      name: item?.name ?? "",
      description: item?.description ?? "",
      price: item ? String(item.price) : "",
      quantity: item?.kind === "equipment" ? String(item.quantity) : "0",
      courtType: item?.kind === "court" ? item.courtType : "Indoor",
      status: item?.kind === "court" ? item.status : "Available",
      image: item?.image ?? "",
    });
    setInventoryImagePreview(item?.image ?? "");
    setPendingInventoryImage(null);
    setInventoryImageError("");
    setError("");
  }

  function handleInventoryImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setInventoryImageError("");

    if (!file.type.startsWith("image/")) {
      setInventoryImageError("Choose a valid picture file.");
      event.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setInventoryImageError("Choose an image smaller than 10 MB.");
      event.target.value = "";
      return;
    }

    setInventoryImagePreview(URL.createObjectURL(file));
    setPendingInventoryImage(file);
  }

  async function saveInventoryItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inventoryDraft) return;

    setSavingInventory(true);
    setError("");
    try {
      const message = await persistInventoryItem({
        ...inventoryDraft,
        pendingImage: pendingInventoryImage,
      });

      setNotice(message);
      setInventoryDraft(null);
      setInventoryImagePreview("");
      setPendingInventoryImage(null);
      setInventoryImageError("");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Inventory could not be saved."
      );
    } finally {
      setSavingInventory(false);
    }
  }

  async function deleteInventoryItem(item: InventoryItem) {
    if (!window.confirm(`Delete ${item.name} from inventory?`)) return;
    setError("");
    try {
      const message = await removeInventoryItem(item);
      setNotice(message);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Inventory item could not be deleted."
      );
    }
  }

  async function logOut() {
    try {
      await signOut();
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
          <p>Loading admin dashboard...</p>
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
            Top-up approvals
            {topUpPayments.length > 0 && (
              <span className="admin-side-count">{topUpPayments.length}</span>
            )}
          </a>
          <a className="admin-side-link" href="#bookings">
            <span className="admin-side-icon">▣</span>
            Booking history
            {bookings.length > 0 && (
              <span className="admin-side-count">{bookings.length}</span>
            )}
          </a>
          <a className="admin-side-link" href="#inventory">
            <span className="admin-side-icon">▤</span>
            Courts & rentals
            <span className="admin-side-count">
              {inventoryCourts.length + inventoryEquipment.length}
            </span>
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
              <h2>Top-up approvals & booking history.</h2>
              <p>
                Review membership top-ups and monitor court and equipment
                bookings.
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
                <span>Pending membership top-ups</span>
                <span className="admin-stat-icon">◷</span>
              </div>
              <strong>{topUpPayments.length}</strong>
              <p>Awaiting admin approval</p>
            </article>

            <article className="admin-stat-card">
              <div className="admin-stat-top">
                <span>Amount awaiting approval</span>
                <span className="admin-stat-icon">₱</span>
              </div>
              <strong>{formatPeso(pendingTopUpAmount)}</strong>
              <p>Membership top-ups only</p>
            </article>

            <article className="admin-stat-card">
              <div className="admin-stat-top">
                <span>Court reservations</span>
                <span className="admin-stat-icon">▣</span>
              </div>
              <strong>{historySummary.court}</strong>
              <p>In booking history</p>
            </article>

            <article className="admin-stat-card">
              <div className="admin-stat-top">
                <span>Equipment rentals</span>
                <span className="admin-stat-icon">▤</span>
              </div>
              <strong>{historySummary.equipment}</strong>
              <p>In booking history</p>
            </article>
          </section>

          <section className="admin-queue-panel" id="payments">
            <div className="admin-section-heading admin-queue-heading">
              <div>
                <h2>Membership Top-up Approvals</h2>
                <p>
                  Only membership top-ups require admin review. Open one to
                  verify its receipt.
                </p>
              </div>

              <div className="admin-queue-actions">
                <label className="admin-search">
                  <span>⌕</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search top-ups..."
                    aria-label="Search membership top-ups"
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

            <div className="admin-request-group">
              <h3>
                Pending top-ups
                <span>{visibleTopUps.length}</span>
              </h3>

              {visibleTopUps.length === 0 ? (
                <p className="admin-empty-row">
                  {topUpPayments.length === 0
                    ? "There are no membership top-ups awaiting approval."
                    : "No top-ups match your search."}
                </p>
              ) : (
                visibleTopUps.map((payment) => (
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
                            Membership card top-up ·{" "}
                            {payment.membership_card_id ?? "Card ID unavailable"}
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

          <section className="admin-queue-panel" id="bookings">
            <div className="admin-section-heading admin-queue-heading">
              <div>
                <h2>Booking History</h2>
                <p>
                  Monitor past and present court reservations and equipment
                  rentals. Bookings are confirmed immediately at checkout.
                </p>
              </div>
              <div className="admin-queue-actions">
                <button
                  type="button"
                  className="admin-proof-button"
                  onClick={exportBookingHistory}
                  disabled={loadingBookings || bookings.length === 0}
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  className="admin-proof-button"
                  onClick={() => void loadBookings()}
                >
                  Refresh
                </button>
              </div>
            </div>

            {bookingError && (
              <div className="admin-error" role="alert">{bookingError}</div>
            )}

            <div
              className="admin-request-group admin-booking-history-list"
              role="region"
              aria-label="Booking history records"
              tabIndex={0}
            >
              <h3>
                Court reservations and equipment rentals
                <span>{bookings.length}</span>
              </h3>

              {loadingBookings ? (
                <p className="admin-empty-row">Loading bookings...</p>
              ) : bookings.length === 0 ? (
                <p className="admin-empty-row">
                  No court reservations or equipment rentals have been recorded.
                </p>
              ) : (
                bookings.map((booking) => {
                  const inventoryItem =
                    booking.item.type === "court"
                      ? inventoryCourts.find(
                          (item) => item.id === booking.item.id
                        ) ??
                        inventoryCourts.find(
                          (item) =>
                            item.name.toLowerCase() ===
                            booking.item.name.toLowerCase()
                        )
                      : inventoryEquipment.find(
                          (item) => item.id === booking.item.id
                        ) ??
                        inventoryEquipment.find(
                          (item) =>
                            item.name.toLowerCase() ===
                            booking.item.name.toLowerCase()
                        );
                  const timeRange =
                    booking.item.startTime && booking.item.endTime
                      ? ` · ${formatBookingTime(booking.item.startTime)}–${formatBookingTime(booking.item.endTime)}`
                      : "";
                  const description =
                    booking.item.type === "court"
                      ? `${booking.item.name} · ${formatBookingDate(booking.item.date)}${timeRange}`
                      : `${booking.item.quantity} × ${booking.item.name} · ${formatBookingDate(booking.item.date)}${timeRange} · ${booking.item.durationHours} hour${booking.item.durationHours === 1 ? "" : "s"}`;

                  return (
                    <article
                      className="admin-request-card admin-booking-history-card"
                      key={`${booking.paymentId}-${booking.itemIndex}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`View details for ${description}`}
                      onClick={() => setSelectedBooking(booking)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedBooking(booking);
                        }
                      }}
                    >
                      <div className="admin-request-main">
                        <div className="admin-request-icon admin-court-icon">
                          {inventoryItem?.image ? (
                            <img
                              className="admin-booking-item-image"
                              src={inventoryItem.image}
                              alt={`${booking.item.name} image`}
                            />
                          ) : booking.item.type === "court" ? (
                            "▣"
                          ) : (
                            "▤"
                          )}
                        </div>
                        <div className="admin-request-info">
                          <div className="admin-request-title-row">
                            <h4>{description}</h4>
                            <BookingStatusBadge status={booking.status} />
                          </div>
                          <p>
                            {booking.orderReference} · {booking.customerName} ·{" "}
                            {booking.customerEmail}
                          </p>
                          <div className="admin-request-meta">
                            <span>
                              {booking.item.type === "court"
                                ? `${booking.item.durationHours} hour${booking.item.durationHours === 1 ? "" : "s"}`
                                : `${formatPeso(booking.item.unitPrice)} per item / hour`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="admin-request-side">
                        <strong>
                          {formatPeso(
                            booking.item.unitPrice *
                              booking.item.quantity *
                              booking.item.durationHours
                          )}
                        </strong>
                        <span>Item total</span>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="admin-inventory-panel" id="inventory">
            <div className="admin-section-heading">
              <div>
                <h2>Courts & Rental Inventory</h2>
                <p>
                  Add, update, or remove the courts and equipment shown to
                  customers on the booking and rental pages.
                </p>
              </div>
              <div className="admin-queue-actions">
                <button
                  type="button"
                  className="admin-proof-button"
                  onClick={() => openInventoryEditor(undefined, "court")}
                >
                  Add court
                </button>
                <button
                  type="button"
                  className="admin-confirm-button"
                  onClick={() => openInventoryEditor(undefined, "equipment")}
                >
                  Add rental item
                </button>
              </div>
            </div>

            {inventoryError && (
              <div className="admin-error" role="alert">{inventoryError}</div>
            )}
            {loadingInventory && (
              <p className="admin-empty-row">Loading inventory...</p>
            )}

            {inventoryDraft && (
              <form
                className="admin-inventory-form"
                onSubmit={saveInventoryItem}
              >
                <div className="admin-inventory-form-heading">
                  <h3>
                    {inventoryDraft.id ? "Edit inventory item" : "Add inventory item"}
                  </h3>
                  <button
                    type="button"
                    className="admin-proof-button"
                    onClick={() => setInventoryDraft(null)}
                    disabled={savingInventory}
                  >
                    Cancel
                  </button>
                </div>
                <label>
                  Item type
                  <select
                    value={inventoryDraft.kind}
                    disabled={Boolean(inventoryDraft.id)}
                    onChange={(event) =>
                      setInventoryDraft({
                        ...inventoryDraft,
                        kind: event.target.value as "court" | "equipment",
                      })
                    }
                  >
                    <option value="court">Court</option>
                    <option value="equipment">Rental equipment</option>
                  </select>
                </label>
                <div className="admin-inventory-form-grid">
                  <label>
                    Name
                    <input
                      required
                      maxLength={100}
                      value={inventoryDraft.name}
                      onChange={(event) =>
                        setInventoryDraft({
                          ...inventoryDraft,
                          name: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Price per hour
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={inventoryDraft.price}
                      onChange={(event) =>
                        setInventoryDraft({
                          ...inventoryDraft,
                          price: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                {inventoryDraft.kind === "court" ? (
                  <div className="admin-inventory-form-grid">
                    <label>
                      Court type
                      <select
                        value={inventoryDraft.courtType}
                        onChange={(event) =>
                          setInventoryDraft({
                            ...inventoryDraft,
                            courtType: event.target.value as "Indoor" | "Outdoor",
                          })
                        }
                      >
                        <option value="Indoor">Indoor</option>
                        <option value="Outdoor">Outdoor</option>
                      </select>
                    </label>
                    <label>
                      Status
                      <select
                        value={inventoryDraft.status}
                        onChange={(event) =>
                          setInventoryDraft({
                            ...inventoryDraft,
                            status: event.target.value as InventoryDraft["status"],
                          })
                        }
                      >
                        <option value="Available">Available</option>
                        <option value="Maintenance">Maintenance</option>
                      </select>
                    </label>
                  </div>
                ) : (
                  <label>
                    Stock quantity
                    <input
                      type="number"
                      min="0"
                      max="10000"
                      step="1"
                      required
                      value={inventoryDraft.quantity}
                      onChange={(event) =>
                        setInventoryDraft({
                          ...inventoryDraft,
                          quantity: event.target.value,
                        })
                      }
                    />
                  </label>
                )}
                <label>
                  Description
                  <textarea
                    maxLength={1000}
                    value={inventoryDraft.description}
                    onChange={(event) =>
                      setInventoryDraft({
                        ...inventoryDraft,
                        description: event.target.value,
                      })
                    }
                  />
                </label>
                <div className="admin-inventory-image-field">
                  <label htmlFor="inventory-image-file">Item image</label>
                  <input
                    id="inventory-image-file"
                    type="file"
                    accept="image/*"
                    onChange={handleInventoryImageChange}
                    disabled={savingInventory}
                  />
                  <p>
                    Picture files only (JPG, PNG, GIF, WebP, and other image
                    formats), up to 10 MB.
                  </p>
                  {inventoryImageError && (
                    <p className="admin-error" role="alert">
                      {inventoryImageError}
                    </p>
                  )}
                  <div className="admin-inventory-image-preview">
                    {inventoryImagePreview ? (
                      <img
                        src={inventoryImagePreview}
                        alt={`${inventoryDraft.name || "Inventory item"} preview`}
                      />
                    ) : (
                      <span>No picture selected</span>
                    )}
                  </div>
                </div>
                <div className="admin-inventory-form-actions">
                  <button
                    type="submit"
                    className="admin-confirm-button"
                    disabled={savingInventory}
                  >
                    {savingInventory ? "Saving..." : "Save inventory item"}
                  </button>
                </div>
              </form>
            )}

            <div className="admin-inventory-grid">
              {[...inventoryCourts, ...inventoryEquipment].map((item) => (
                <article className="admin-inventory-card" key={`${item.kind}-${item.id}`}>
                  <div className="admin-inventory-card-info">
                    {item.image ? (
                      <img
                        className="admin-inventory-card-image"
                        src={item.image}
                        alt={`${item.name} current picture`}
                      />
                    ) : (
                      <div className="admin-inventory-card-image admin-inventory-card-image-empty">
                        No picture
                      </div>
                    )}
                    <div>
                      <span className="admin-inventory-kind">
                        {item.kind === "court"
                          ? `${item.courtType} court · ${item.status}`
                          : `${item.quantity} in stock`}
                      </span>
                      <h3>{item.name}</h3>
                      <p>{item.description || "No description provided."}</p>
                      <strong>{formatPeso(item.price)} / hour</strong>
                    </div>
                  </div>
                  <div className="admin-booking-actions">
                    <button
                      type="button"
                      className="admin-proof-button"
                      onClick={() => openInventoryEditor(item)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="admin-delete-button"
                      onClick={() => void deleteInventoryItem(item)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
              {!loadingInventory &&
                !inventoryError &&
                inventoryCourts.length + inventoryEquipment.length === 0 && (
                  <p className="admin-empty-row">
                    No inventory found. Apply the inventory migration to initialize the existing 20 courts and rental items.
                  </p>
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
                No actions yet. Confirm or reject a membership top-up to see
                activity here.
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

      {selectedBooking && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedBooking(null);
            }
          }}
        >
          <section
            className="admin-proof-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-details-title"
          >
            <div className="admin-modal-header">
              <div>
                <span className="admin-modal-eyebrow">
                  {selectedBooking.item.type === "court"
                    ? "COURT RESERVATION"
                    : "EQUIPMENT RENTAL"}
                </span>
                <h2 id="booking-details-title">Booking details</h2>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setSelectedBooking(null)}
                aria-label="Close booking details"
              >
                ×
              </button>
            </div>

            <div className="admin-proof-details">
              <div className="admin-proof-summary">
                <span>Booking</span>
                <strong>
                  {selectedBooking.item.type === "equipment"
                    ? `${selectedBooking.item.quantity} × `
                    : ""}
                  {selectedBooking.item.name}
                </strong>
              </div>
              <div className="admin-proof-summary">
                <span>Date and time</span>
                <strong>
                  {formatBookingDate(selectedBooking.item.date) || "Not recorded"}
                  {selectedBooking.item.startTime
                    ? ` · ${formatBookingTime(selectedBooking.item.startTime)}`
                    : ""}
                  {selectedBooking.item.endTime
                    ? `–${formatBookingTime(selectedBooking.item.endTime)}`
                    : ""}
                </strong>
              </div>
              <div className="admin-proof-summary">
                <span>Duration</span>
                <strong>
                  {selectedBooking.item.durationHours} hour
                  {selectedBooking.item.durationHours === 1 ? "" : "s"}
                </strong>
              </div>
              {selectedBooking.item.type === "equipment" && (
                <div className="admin-proof-summary">
                  <span>Quantity</span>
                  <strong>{selectedBooking.item.quantity}</strong>
                </div>
              )}
              <div className="admin-proof-summary">
                <span>Unit price</span>
                <strong>
                  {formatPeso(selectedBooking.item.unitPrice)}
                  {selectedBooking.item.type === "equipment"
                    ? " per item / hour"
                    : " per hour"}
                </strong>
              </div>
              <div className="admin-proof-summary">
                <span>Item total</span>
                <strong>
                  {formatPeso(
                    selectedBooking.item.unitPrice *
                      selectedBooking.item.quantity *
                      selectedBooking.item.durationHours
                  )}
                </strong>
              </div>
              <div className="admin-proof-summary">
                <span>Status</span>
                <strong>
                  <BookingStatusBadge status={selectedBooking.status} />
                </strong>
              </div>
              <div className="admin-proof-summary">
                <span>Order reference</span>
                <strong>{selectedBooking.orderReference}</strong>
              </div>
              <div className="admin-proof-summary">
                <span>Customer</span>
                <strong>
                  {selectedBooking.customerName}
                  <br />
                  {selectedBooking.customerEmail}
                </strong>
              </div>
            </div>
          </section>
        </div>
      )}

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
                aria-label="Close top-up review"
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
