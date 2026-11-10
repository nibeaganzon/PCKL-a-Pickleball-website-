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

type TransactionHistoryRow = {
  id: string;
  order_reference: string | null;
  status: string | null;
  total_amount: number | string | null;
  transaction_date: string;
  membership_cards: { card_number: string | null } | null;
  court_reservations: Array<{
    id: string;
    amount: number | string;
    start_date: string;
    end_date: string;
    status: string | null;
    courts: { id: string; name: string } | null;
  }> | null;
  equipment_rentals: Array<{
    id: string;
    quantity: number;
    unit_price: number | string;
    start_date: string;
    end_date: string;
    status: string | null;
    equipments: { id: string; name: string } | null;
  }> | null;
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

function formatBookingDate(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatBookingTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function getBookingDuration(start: string, end: string) {
  const duration = (Date.parse(end) - Date.parse(start)) / (60 * 60 * 1000);
  return Number.isFinite(duration) && duration > 0
    ? Math.max(1, Math.round(duration))
    : 1;
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
  const [selectedPayment, setSelectedPayment] =
    useState<PaymentRecord | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingError, setBookingError] = useState("");
  const [selectedBooking, setSelectedBooking] =
    useState<BookingRecord | null>(null);
  const [bookingDraft, setBookingDraft] = useState<BookingDraft | null>(null);
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
      const supabase = createSupabaseBrowserClient();
      const historyRows: TransactionHistoryRow[] = [];
      const pageSize = 500;

      for (let from = 0; ; from += pageSize) {
        const { data, error: historyError } = await supabase
          .from("transactions")
          .select(`
            id,
            order_reference,
            status,
            total_amount,
            transaction_date,
            membership_cards (card_number),
            court_reservations (
              id,
              amount,
              start_date,
              end_date,
              status,
              courts (id, name)
            ),
            equipment_rentals (
              id,
              quantity,
              unit_price,
              start_date,
              end_date,
              status,
              equipments (id, name)
            )
          `)
          .order("transaction_date", { ascending: false })
          .range(from, from + pageSize - 1);

        if (historyError) throw historyError;

        const pageRows = (data ?? []) as unknown as TransactionHistoryRow[];
        historyRows.push(...pageRows);
        if (pageRows.length < pageSize) break;
      }

      let pendingRecords: BookingRecord[] = [];
      let pendingLoadError = "";
      try {
        const response = await fetch("/api/admin/bookings", {
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(
            result.message || "Pending bookings could not be loaded."
          );
        }

        const pendingBookings = result.bookings as Omit<
          BookingRecord,
          "status" | "historyAt"
        >[];
        pendingRecords = pendingBookings.map((booking) => ({
          ...booking,
          status: "Pending",
          historyAt:
            booking.item.date && booking.item.startTime
              ? `${booking.item.date}T${booking.item.startTime}:00+08:00`
              : new Date().toISOString(),
        }));
      } catch (pendingError) {
        pendingLoadError =
          pendingError instanceof Error
            ? pendingError.message
            : "Pending bookings could not be loaded.";
      }

      const transactionRecords = historyRows.flatMap((transaction) => {
        const customerEmail = transaction.membership_cards?.card_number
          ? `Card ${transaction.membership_cards.card_number}`
          : "Card ID unavailable";
        const baseRecord = {
          paymentId: transaction.id,
          orderReference: transaction.order_reference ?? transaction.id,
          customerName: "PCKL Member",
          customerEmail,
        };
        let itemIndex = 0;

        const courtRecords = (transaction.court_reservations ?? []).map(
          (reservation): BookingRecord => {
            const durationHours = getBookingDuration(
              reservation.start_date,
              reservation.end_date
            );
            const record: BookingRecord = {
              ...baseRecord,
              itemIndex: itemIndex++,
              status: reservation.status ?? transaction.status ?? "Pending",
              historyAt: reservation.start_date,
              item: {
                id: reservation.courts?.id ?? reservation.id,
                type: "court",
                name: reservation.courts?.name ?? "Court",
                date: formatBookingDate(reservation.start_date),
                startTime: formatBookingTime(reservation.start_date),
                endTime: formatBookingTime(reservation.end_date),
                durationHours,
                quantity: 1,
                unitPrice: Number(reservation.amount) / durationHours,
              },
            };
            return record;
          }
        );

        const equipmentRecords = (transaction.equipment_rentals ?? []).map(
          (rental): BookingRecord => {
            const durationHours = getBookingDuration(
              rental.start_date,
              rental.end_date
            );
            return {
              ...baseRecord,
              itemIndex: itemIndex++,
              status: rental.status ?? transaction.status ?? "Pending",
              historyAt: rental.start_date,
              item: {
                id: rental.equipments?.id ?? rental.id,
                type: "equipment",
                name: rental.equipments?.name ?? "Equipment",
                date: formatBookingDate(rental.start_date),
                startTime: formatBookingTime(rental.start_date),
                endTime: formatBookingTime(rental.end_date),
                durationHours,
                quantity: rental.quantity,
                unitPrice: Number(rental.unit_price),
              },
            };
          }
        );

        return [...courtRecords, ...equipmentRecords];
      });

      const recordsByItem = new Map<string, BookingRecord>();
      for (const booking of [...pendingRecords, ...transactionRecords]) {
        recordsByItem.set(
          `${booking.paymentId}-${booking.itemIndex}`,
          booking
        );
      }
      setBookings(
        Array.from(recordsByItem.values()).sort(
          (left, right) =>
            Date.parse(right.historyAt) - Date.parse(left.historyAt)
        )
      );
      setBookingError(pendingLoadError);
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
          describeItems(payment.cart),
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

  function openBookingEditor() {
    const firstPendingOrder = payments.find(
      (payment) =>
        payment.status === "pending" && payment.payment_type === "order"
    );
    if (!firstPendingOrder) {
      setError("A pending customer order is required before adding a booking.");
      return;
    }

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
    setBookingDraft({
      paymentId: firstPendingOrder?.id ?? "",
      type: "court",
      courtId: defaultCourt?.id ?? "",
      equipmentId: defaultEquipment?.id ?? "",
      date: minimumDate,
      startTime: defaultStartTime,
      durationHours: 1,
      quantity: 1,
      minimumDate,
    });
    setError("");
  }

  function closeBookingEditor() {
    if (savingBooking) return;
    setBookingDraft(null);
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
      selectedCourt?.status !== "Available"
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
        "/api/admin/bookings",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId: bookingDraft.paymentId, item }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "The booking could not be saved.");
      }

      setNotice(result.message);
      setBookingDraft(null);
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
      let imageUrl = inventoryDraft.image;

      if (pendingInventoryImage) {
        const formData = new FormData();
        formData.append("file", pendingInventoryImage);
        formData.append("kind", inventoryDraft.kind);
        if (inventoryDraft.id) {
          formData.append("itemId", inventoryDraft.id);
        }

        const uploadResponse = await fetch("/api/admin/inventory/upload", {
          method: "POST",
          body: formData,
        });
        const uploadResult = await uploadResponse.json();
        if (!uploadResponse.ok) {
          throw new Error(
            uploadResult.message || "The image could not be saved to storage."
          );
        }
        imageUrl = uploadResult.url;
      }

      const payload = {
        ...inventoryDraft,
        image: imageUrl,
        price: Number(inventoryDraft.price),
        ...(inventoryDraft.kind === "equipment"
          ? { quantity: Number(inventoryDraft.quantity) }
          : {}),
      };

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
                  rentals. History is read-only; new bookings can be added to a
                  pending customer order.
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
                >
                  Add booking
                </button>
              </div>
            </div>

            {bookingError && (
              <div className="admin-error" role="alert">{bookingError}</div>
            )}

            <div className="admin-request-group">
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
                  const timeRange =
                    booking.item.startTime && booking.item.endTime
                      ? ` · ${booking.item.startTime}–${booking.item.endTime}`
                      : "";
                  const description =
                    booking.item.type === "court"
                      ? `${booking.item.name} · ${booking.item.date}${timeRange}`
                      : `${booking.item.quantity} × ${booking.item.name} · ${booking.item.date}${timeRange} · ${booking.item.durationHours} hour${booking.item.durationHours === 1 ? "" : "s"}`;

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
                          {booking.item.type === "court" ? "▣" : "▤"}
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
                  NEW BOOKING
                </span>
                <h2 id="booking-modal-title">Add booking</h2>
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
                Saving adds this item to the selected pending customer order and
                recalculates its total. Standalone walk-in bookings are not
                supported without a backend change.
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
                  {selectedBooking.item.date || "Not recorded"}
                  {selectedBooking.item.startTime
                    ? ` · ${selectedBooking.item.startTime}`
                    : ""}
                  {selectedBooking.item.endTime
                    ? `–${selectedBooking.item.endTime}`
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
