export type PaymentStatus = "pending" | "confirmed" | "rejected";
export type PaymentType = "order" | "top_up";
export type PaymentMethod = "external" | "membership_card";

export type PaymentItem = {
  id: string;
  type: "court" | "equipment";
  name: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  durationHours: number;
  quantity: number;
  unitPrice: number;
};

export type PaymentRecord = {
  id: string;
  order_reference: string;
  customer_name: string;
  customer_email: string;
  payment_reference: string;
  cart: PaymentItem[];
  amount: number;
  proof_path?: string | null;
  proof_url?: string;
  status: PaymentStatus;
  payment_type: PaymentType;
  payment_method: PaymentMethod;
  membership_card_id: string | null;
  balance_after: number | null;
  created_at: string;
  reviewed_at: string | null;
};

export function validatePaymentCart(
  value: unknown,
  options: { allowPastBookings?: boolean } = {}
): PaymentItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    return null;
  }

  const items: PaymentItem[] = [];

  for (const rawItem of value) {
    if (!rawItem || typeof rawItem !== "object") return null;
    const item = rawItem as Record<string, unknown>;
    const quantity = item.quantity;
    const durationHours = item.durationHours;
    if (
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 20 ||
      typeof durationHours !== "number" ||
      !Number.isInteger(durationHours) ||
      durationHours < 1 ||
      durationHours > 24
    ) {
      return null;
    }

    if (item.type === "equipment") {
      if (item.id !== "paddle" && item.id !== "ball") return null;
      const equipment = item.id === "paddle"
        ? { name: "Pickleball Paddle", unitPrice: 50 }
        : { name: "Pickleball Ball", unitPrice: 10 };
      items.push({
        id: item.id,
        type: "equipment",
        ...equipment,
        durationHours,
        quantity,
      });
      continue;
    }

    if (item.type === "court" && typeof item.name === "string") {
      const match = /^Court (0[1-9]|1[0-9]|20)$/.exec(item.name);
      if (!match) return null;
      const date = item.date;
      const startTime = item.startTime;
      if (
        typeof date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        typeof startTime !== "string" ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)
      ) {
        return null;
      }
      const [year, month, day] = date.split("-").map(Number);
      const bookingDate = new Date(Date.UTC(year, month - 1, day));
      if (
        bookingDate.getUTCFullYear() !== year ||
        bookingDate.getUTCMonth() !== month - 1 ||
        bookingDate.getUTCDate() !== day
      ) {
        return null;
      }
      const bookingStart = new Date(`${date}T${startTime}:00+08:00`);
      if (!options.allowPastBookings && bookingStart.getTime() <= Date.now()) {
        return null;
      }

      const courtNumber = Number(match[1]);
      const indoorCourts = new Set([1, 2, 5, 7, 10, 12, 14, 16, 18, 20]);
      const bookingEnd = new Date(
        bookingStart.getTime() + durationHours * 60 * 60 * 1000
      );
      const endTime = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(bookingEnd);
      items.push({
        id: `court-${match[1]}`,
        type: "court",
        name: `Court ${match[1]}`,
        date,
        startTime,
        endTime,
        durationHours,
        quantity,
        unitPrice: indoorCourts.has(courtNumber) ? 300 : 250,
      });
      continue;
    }

    return null;
  }

  return items;
}

export function calculatePaymentTotal(items: PaymentItem[]) {
  return items.reduce(
    (total, item) =>
      total + item.unitPrice * item.quantity * item.durationHours,
    0
  );
}
