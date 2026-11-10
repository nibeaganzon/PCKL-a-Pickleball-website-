import { requireAdmin } from "@/lib/admin-auth";
import type { PaymentItem } from "@/lib/payments";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type AdminBookingRecord = {
  paymentId: string;
  orderReference: string;
  customerName: string;
  customerEmail: string;
  itemIndex: number;
  item: PaymentItem;
  status: string;
  historyAt: string;
};

type TransactionRow = {
  id: string;
  order_reference: string | null;
  total_amount: number | string | null;
  transaction_date: string;
  membership_cards: {
    card_number: string | null;
    user_id: string | null;
  } | null;
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

export async function GET() {
  try {
    const authorization = await requireAdmin();
    if (!authorization.user) return authorization.response;

    const supabase = createSupabaseServiceClient();
    const historyRows: TransactionRow[] = [];
    const pageSize = 500;

    for (let from = 0; ; from += pageSize) {
      const { data, error: historyError } = await supabase
        .from("transactions")
        .select(`
          id,
          order_reference,
          total_amount,
          transaction_date,
          membership_cards (
            card_number,
            user_id
          ),
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

      const pageRows = (data ?? []) as unknown as TransactionRow[];
      historyRows.push(...pageRows);
      if (pageRows.length < pageSize) break;
    }

    const userIds = Array.from(
      new Set(
        historyRows
          .map((row) => row.membership_cards?.user_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    const emailMap = new Map<string, string>();
    const nameMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      for (const u of usersData?.users || []) {
        if (u.email) emailMap.set(u.id, u.email);
        const fullName =
          typeof u.user_metadata?.full_name === "string"
            ? u.user_metadata.full_name.trim()
            : "";
        if (fullName) nameMap.set(u.id, fullName);
      }
    }

    const bookings: AdminBookingRecord[] = historyRows.flatMap((transaction) => {
      const userId = transaction.membership_cards?.user_id ?? "";
      const cardNumber = transaction.membership_cards?.card_number;
      const customerEmail =
        (userId && emailMap.get(userId)) ||
        (cardNumber ? `Card ${cardNumber}` : "Card ID unavailable");
      const customerName =
        (userId && nameMap.get(userId)) || "PCKL Member";

      const baseRecord = {
        paymentId: transaction.id,
        orderReference: transaction.order_reference ?? transaction.id,
        customerName,
        customerEmail,
      };
      let itemIndex = 0;

      const courtRecords = (transaction.court_reservations ?? []).map(
        (reservation): AdminBookingRecord => {
          const durationHours = getBookingDuration(
            reservation.start_date,
            reservation.end_date
          );
          return {
            ...baseRecord,
            itemIndex: itemIndex++,
            status: reservation.status ?? "Active",
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
        }
      );

      const equipmentRecords = (transaction.equipment_rentals ?? []).map(
        (rental): AdminBookingRecord => {
          const durationHours = getBookingDuration(
            rental.start_date,
            rental.end_date
          );
          return {
            ...baseRecord,
            itemIndex: itemIndex++,
            status: rental.status ?? "Active",
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

    bookings.sort(
      (left, right) => Date.parse(right.historyAt) - Date.parse(left.historyAt)
    );

    return Response.json(
      { bookings },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Booking history could not be loaded:", error);
    return Response.json(
      { message: "Booking history could not be loaded." },
      { status: 500 }
    );
  }
}
