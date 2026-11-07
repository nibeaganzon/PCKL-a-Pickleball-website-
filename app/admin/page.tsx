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
import type { PaymentItem, PaymentRecord, PaymentStatus } from "@/lib/payments";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useInventory } from "@/lib/use-inventory";
import type { InventoryItem } from "@/lib/inventory";
import { saveLocalInventoryImage } from "@/lib/local-inventory-images";

type Activity = {
  id: string;
  description: string;
  amount: number;
  time: string;
  type: "confirmed" | "rejected";
};

type PaymentTab = "all" | "courts" | "equipment" | "top-ups";

type BookingRecord = {
  paymentId: string;
  orderReference: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  itemIndex: number;
  item: PaymentItem;
};

type BookingDraft = {
  paymentId: string;
  type: "court" | "equipment";
  courtId: string;
  equipmentId: string;
  date: string;
  startTime: string;
  durationHours: number;
  quantity: number;
  minimumDate: string;
};

type InventoryDraft = {
  id?: string;
  kind: "court" | "equipment";
  name: string;
  description: string;
  price: string;
  quantity: string;
  courtType: "Indoor" | "Outdoor";
  status: "Available" | "Booked" | "Maintenance";
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
  const {
    courts: inventoryCourts,
    equipment: inventoryEquipment,
    loading: loadingInventory,
    error: inventoryError,
    refresh: refreshInventory,
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
  const [tab, setTab] = useState<PaymentTab>("all");
  const [selectedPayment, setSelectedPayment] =
    useState<PaymentRecord | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingDraft, setBookingDraft] = useState<BookingDraft | null>(null);
  const [editingBooking, setEditingBooking] =
    useState<BookingRecord | null>(null);
  const [savingBooking, setSavingBooking] = useState(false);
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

  const loadBookings = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/bookings", { cache: "no-store" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Pending bookings could not be loaded.");
      }

      setBookings(result.bookings);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Pending bookings could not be loaded."
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
      void loadBookings();
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

  function openBookingEditor(booking?: BookingRecord) {
    const firstPendingOrder = payments.find(
      (payment) =>
        payment.status === "pending" && payment.payment_type === "order"
    );
    if (!booking && !firstPendingOrder) {
      setError("A pending customer order is required before adding a booking.");
      return;
    }

    setEditingBooking(booking ?? null);
    const nextStartParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(Date.now() + 60 * 60 * 1000));
    const nextStart = Object.fromEntries(
      nextStartParts.map((part) => [part.type, part.value])
    );
    const minimumDate = `${nextStart.year}-${nextStart.month}-${nextStart.day}`;
    const defaultStartTime = `${nextStart.hour}:${nextStart.minute}`;
    const defaultCourt =
      inventoryCourts.find((court) => court.status === "Available") ??
      inventoryCourts[0];
    const defaultEquipment = inventoryEquipment[0];
    const selectedCourt =
      booking?.item.type === "court"
        ? inventoryCourts.find(
            (court) =>
              court.id === booking.item.id || court.name === booking.item.name
          )
        : undefined;
    const selectedEquipment =
      booking?.item.type === "equipment"
        ? inventoryEquipment.find(
            (item) =>
              item.id === booking.item.id || item.name === booking.item.name
          )
        : undefined;
    setBookingDraft({
      paymentId: booking?.paymentId ?? firstPendingOrder?.id ?? "",
      type: booking?.item.type ?? "court",
      courtId: selectedCourt?.id ?? defaultCourt?.id ?? "",
      equipmentId: selectedEquipment?.id ?? defaultEquipment?.id ?? "",
      date: booking?.item.date ?? minimumDate,
      startTime: booking?.item.startTime ?? defaultStartTime,
      durationHours: booking?.item.durationHours ?? 1,
      quantity: booking?.item.quantity ?? 1,
      minimumDate: booking?.item.date ?? minimumDate,
    });
    setError("");
  }

  function closeBookingEditor() {
    if (savingBooking) return;
    setBookingDraft(null);
    setEditingBooking(null);
  }

  async function saveBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bookingDraft) return;

    const selectedCourt = inventoryCourts.find(
      (court) => court.id === bookingDraft.courtId
    );
    const selectedEquipment = inventoryEquipment.find(
      (item) => item.id === bookingDraft.equipmentId
    );
    if (
      bookingDraft.type === "court" &&
      selectedCourt?.status !== "Available" &&
      selectedCourt?.name !== editingBooking?.item.name
    ) {
      setError("Choose a court that is currently available.");
      return;
    }
    if (
      bookingDraft.type === "equipment" &&
      bookingDraft.quantity > (selectedEquipment?.quantity ?? 0)
    ) {
      setError("The requested rental quantity exceeds available inventory.");
      return;
    }

    let item: PaymentItem;
    if (bookingDraft.type === "court") {
      if (!selectedCourt) {
        setError("Choose an item that is still in inventory.");
        return;
      }
      item = {
        id: selectedCourt.id,
        type: "court",
        name: selectedCourt.name,
        date: bookingDraft.date,
        startTime: bookingDraft.startTime,
        durationHours: bookingDraft.durationHours,
        quantity: 1,
        unitPrice: selectedCourt.price,
      };
    } else {
      if (!selectedEquipment) {
        setError("Choose an item that is still in inventory.");
        return;
      }
      item = {
        id: selectedEquipment.id,
        type: "equipment",
        name: selectedEquipment.name,
        durationHours: bookingDraft.durationHours,
        quantity: bookingDraft.quantity,
        unitPrice: selectedEquipment.price,
      };
    }

    setSavingBooking(true);
    setError("");
    try {
      const response = await fetch(
        editingBooking
          ? `/api/admin/bookings/${editingBooking.paymentId}`
          : "/api/admin/bookings",
        {
          method: editingBooking ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editingBooking
              ? { itemIndex: editingBooking.itemIndex, item }
              : { paymentId: bookingDraft.paymentId, item }
          ),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "The booking could not be saved.");
      }

      setNotice(result.message);
      setBookingDraft(null);
      setEditingBooking(null);
      await Promise.all([loadBookings(), loadPayments()]);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The booking could not be saved."
      );
    } finally {
      setSavingBooking(false);
    }
  }

  async function deleteBooking(booking: BookingRecord) {
    if (
      !window.confirm(
        `Remove this ${booking.item.type === "court" ? "court reservation" : "equipment rental"} from ${booking.orderReference}?`
      )
    ) {
      return;
    }

    setError("");
    try {
      const response = await fetch(
        `/api/admin/bookings/${booking.paymentId}?itemIndex=${booking.itemIndex}`,
        { method: "DELETE" }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "The booking could not be deleted.");
      }

      setNotice(result.message);
      await Promise.all([loadBookings(), loadPayments()]);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "The booking could not be deleted."
      );
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
      image: item?.sourceImage ?? item?.image ?? "",
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

    const payload = {
      ...inventoryDraft,
      price: Number(inventoryDraft.price),
      ...(inventoryDraft.kind === "equipment"
        ? { quantity: Number(inventoryDraft.quantity) }
        : {}),
    };
    setSavingInventory(true);
    setError("");
    try {
      const response = await fetch(
        inventoryDraft.id
          ? `/api/admin/inventory/${inventoryDraft.id}`
          : "/api/admin/inventory",
        {
          method: inventoryDraft.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Inventory could not be saved.");
      }

      if (pendingInventoryImage) {
        const savedItemId = inventoryDraft.id ?? result.id;
        if (typeof savedItemId !== "string") {
          throw new Error(
            "Inventory was saved, but its image could not be associated with the item."
          );
        }
        try {
          await saveLocalInventoryImage(
            inventoryDraft.kind,
            savedItemId,
            pendingInventoryImage
          );
        } catch (imageSaveError) {
          setNotice(result.message);
          setError(
            `Inventory was saved, but the image could not be saved in this browser. ${
              imageSaveError instanceof Error
                ? imageSaveError.message
                : "Please try a smaller image."
            }`
          );
          setInventoryDraft(null);
          setInventoryImagePreview("");
          setPendingInventoryImage(null);
          await refreshInventory();
          return;
        }
      }

      setNotice(result.message);
      setInventoryDraft(null);
      setInventoryImagePreview("");
      setPendingInventoryImage(null);
      setInventoryImageError("");
      await refreshInventory();
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
      const response = await fetch(`/api/admin/inventory/${item.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: item.kind }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Inventory item could not be deleted.");
      }
      setNotice(result.message);
      await refreshInventory();
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
          <a className="admin-side-link" href="#bookings">
            <span className="admin-side-icon">▣</span>
            Bookings & rentals
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

          <section className="admin-queue-panel" id="bookings">
            <div className="admin-section-heading admin-queue-heading">
              <div>
                <h2>Court Reservations & Equipment Rentals</h2>
                <p>
                  Manage booking items attached to pending customer orders.
                  Payment confirmation remains a separate step.
                </p>
              </div>
              <div className="admin-queue-actions">
                <button
                  type="button"
                  className="admin-proof-button"
                  onClick={() => void loadBookings()}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  className="admin-confirm-button"
                  onClick={() => openBookingEditor()}
                  disabled={
                    !payments.some(
                      (payment) =>
                        payment.status === "pending" &&
                        payment.payment_type === "order"
                    )
                  }
                >
                  Add booking
                </button>
              </div>
            </div>

            <div className="admin-request-group">
              <h3>
                Pending booking items
                <span>{bookings.length}</span>
              </h3>

              {loadingBookings ? (
                <p className="admin-empty-row">Loading bookings...</p>
              ) : bookings.length === 0 ? (
                <p className="admin-empty-row">
                  {payments.some(
                    (payment) =>
                      payment.status === "pending" &&
                      payment.payment_type === "order"
                  )
                    ? "There are no court or equipment items in pending orders."
                    : "A customer order must be submitted before you can add a booking."}
                </p>
              ) : (
                bookings.map((booking) => {
                  const paymentBookingCount = bookings.filter(
                    (item) => item.paymentId === booking.paymentId
                  ).length;
                  const description =
                    booking.item.type === "court"
                      ? `${booking.item.name} · ${booking.item.date} · ${booking.item.startTime}–${booking.item.endTime}`
                      : `${booking.item.quantity} × ${booking.item.name} · ${booking.item.durationHours} hour${booking.item.durationHours === 1 ? "" : "s"}`;

                  return (
                    <article
                      className="admin-request-card"
                      key={`${booking.paymentId}-${booking.itemIndex}`}
                    >
                      <div className="admin-request-main">
                        <div className="admin-request-icon admin-court-icon">
                          {booking.item.type === "court" ? "▣" : "▤"}
                        </div>
                        <div className="admin-request-info">
                          <div className="admin-request-title-row">
                            <h4>{description}</h4>
                            <StatusBadge status="pending" />
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
                            <span>
                              Item total:{" "}
                              {formatPeso(
                                booking.item.unitPrice *
                                  booking.item.quantity *
                                  booking.item.durationHours
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="admin-booking-actions">
                        <strong>{formatPeso(booking.amount)} order total</strong>
                        <button
                          type="button"
                          className="admin-proof-button"
                          onClick={() => openBookingEditor(booking)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="admin-delete-button"
                          onClick={() => void deleteBooking(booking)}
                          disabled={paymentBookingCount === 1}
                          title={
                            paymentBookingCount === 1
                              ? "Keep one item so the pending payment can still be reviewed."
                              : undefined
                          }
                        >
                          Delete
                        </button>
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
                        <option value="Booked">Booked</option>
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
                    formats), up to 10 MB. Saved images display in this browser
                    only.
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

      {bookingDraft && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeBookingEditor();
          }}
        >
          <section
            className="admin-proof-modal admin-booking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-modal-title"
          >
            <div className="admin-modal-header">
              <div>
                <span className="admin-modal-eyebrow">
                  {editingBooking ? "EDIT PENDING BOOKING" : "NEW PENDING BOOKING"}
                </span>
                <h2 id="booking-modal-title">
                  {editingBooking ? "Edit booking" : "Add booking"}
                </h2>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                onClick={closeBookingEditor}
                aria-label="Close booking editor"
                disabled={savingBooking}
              >
                ×
              </button>
            </div>

            <form className="admin-booking-form" onSubmit={saveBooking}>
              {!editingBooking && (
                <label>
                  Pending customer order
                  <select
                    required
                    value={bookingDraft.paymentId}
                    onChange={(event) =>
                      setBookingDraft({
                        ...bookingDraft,
                        paymentId: event.target.value,
                      })
                    }
                  >
                    {payments
                      .filter(
                        (payment) =>
                          payment.status === "pending" &&
                          payment.payment_type === "order"
                      )
                      .map((payment) => (
                        <option key={payment.id} value={payment.id}>
                          {payment.order_reference} · {payment.customer_name} ·{" "}
                          {formatPeso(payment.amount)}
                        </option>
                      ))}
                  </select>
                </label>
              )}

              <label>
                Booking type
                <select
                  value={bookingDraft.type}
                  onChange={(event) =>
                    setBookingDraft({
                      ...bookingDraft,
                      type: event.target.value as "court" | "equipment",
                    })
                  }
                >
                  <option value="court">Court reservation</option>
                  <option value="equipment">Equipment rental</option>
                </select>
              </label>

              {bookingDraft.type === "court" ? (
                <>
                  <label>
                    Court
                    <select
                      value={bookingDraft.courtId}
                      onChange={(event) =>
                        setBookingDraft({
                          ...bookingDraft,
                          courtId: event.target.value,
                        })
                      }
                    >
                      {inventoryCourts
                        .filter(
                          (court) =>
                            court.status === "Available" ||
                            court.id === bookingDraft.courtId
                        )
                        .map((court) => (
                          <option key={court.id} value={court.id}>
                            {court.name} · {court.courtType} · {formatPeso(court.price)}/hr
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="admin-booking-field-grid">
                    <label>
                      Date
                      <input
                        type="date"
                        required
                        min={bookingDraft.minimumDate}
                        value={bookingDraft.date}
                        onChange={(event) =>
                          setBookingDraft({
                            ...bookingDraft,
                            date: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Start time
                      <input
                        type="time"
                        required
                        value={bookingDraft.startTime}
                        onChange={(event) =>
                          setBookingDraft({
                            ...bookingDraft,
                            startTime: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                </>
              ) : (
                <label>
                  Equipment
                  <select
                    value={bookingDraft.equipmentId}
                    onChange={(event) =>
                      setBookingDraft({
                        ...bookingDraft,
                        equipmentId: event.target.value,
                      })
                    }
                  >
                    {inventoryEquipment
                      .filter(
                        (item) =>
                          item.quantity > 0 ||
                          item.id === bookingDraft.equipmentId
                      )
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · {item.quantity} in stock
                        </option>
                      ))}
                  </select>
                </label>
              )}

              <div className="admin-booking-field-grid">
                <label>
                  Duration (hours)
                  <input
                    type="number"
                    min="1"
                    max="24"
                    step="1"
                    required
                    value={bookingDraft.durationHours}
                    onChange={(event) =>
                      setBookingDraft({
                        ...bookingDraft,
                        durationHours: Number(event.target.value),
                      })
                    }
                  />
                </label>
                {bookingDraft.type === "equipment" && (
                  <label>
                    Quantity
                    <input
                      type="number"
                      min="1"
                      max={
                        inventoryEquipment.find(
                          (item) => item.id === bookingDraft.equipmentId
                        )?.quantity ?? 1
                      }
                      step="1"
                      required
                      value={bookingDraft.quantity}
                      onChange={(event) =>
                        setBookingDraft({
                          ...bookingDraft,
                          quantity: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                )}
              </div>

              <p className="admin-verification-warning">
                Saving updates the order cart and recalculates its amount. The
                receipt is unchanged. Check that it matches the updated amount
                before confirming or rejecting the payment in Payment review.
              </p>

              {error && <div className="admin-error" role="alert">{error}</div>}

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-reject-button"
                  onClick={closeBookingEditor}
                  disabled={savingBooking}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-confirm-button"
                  disabled={savingBooking}
                >
                  {savingBooking ? "Saving..." : "Save booking"}
                </button>
              </div>
            </form>
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
