import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getInventory } from "@/app/api/inventory/route";
import { POST as postCheckout } from "@/app/api/checkout/route";
import { GET as getPaymentByReference } from "@/app/api/payments/[orderReference]/route";
import { createInMemorySupabaseStore } from "./helpers/in-memory-supabase";

let store = createInMemorySupabaseStore();

vi.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: () => store.createServiceClient(),
}));

describe("Flow 1: Member booking a court", () => {
  beforeEach(() => {
    store = createInMemorySupabaseStore();
  });

  it("completes the full court booking flow: checks court availability, checks out a court, and confirms the Court Reservation exists", async () => {
    // Step 1a: Check court availability
    const inventoryResponse = await getInventory();
    expect(inventoryResponse.status).toBe(200);
    const inventoryBody = await inventoryResponse.json();

    const availableCourt = inventoryBody.courts.find(
      (court: { name: string; status: string }) =>
        court.name === "Court 01" && court.status === "Available"
    );
    expect(availableCourt).toBeDefined();
    expect(availableCourt.price).toBe(300);

    // Step 1b: Add to cart and check out the court using an Active Card
    const checkoutRequest = new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardId: "PICKL-ABCD1234EFGH5678",
        cart: [
          {
            id: availableCourt.id,
            type: "court",
            name: availableCourt.name,
            date: "2027-05-15",
            startTime: "10:00",
            durationHours: 2,
            quantity: 1,
            unitPrice: availableCourt.price,
          },
        ],
      }),
    });

    const checkoutResponse = await postCheckout(checkoutRequest);
    expect(checkoutResponse.status).toBe(201);
    const checkoutBody = await checkoutResponse.json();
    expect(checkoutBody.orderReference).toMatch(/^PAY-[A-F0-9]{20}$/);
    expect(checkoutBody.balanceAfter).toBe(1400);

    // Step 1c: Verify the Court Reservation exists via the order reference
    const verifyResponse = await getPaymentByReference(
      new Request(
        `http://localhost/api/payments/${checkoutBody.orderReference}`
      ),
      {
        params: Promise.resolve({
          orderReference: checkoutBody.orderReference,
        }),
      }
    );
    expect(verifyResponse.status).toBe(200);
    const verifyBody = await verifyResponse.json();

    expect(verifyBody.payment).toMatchObject({
      order_reference: checkoutBody.orderReference,
      status: "confirmed",
      amount: 600,
      payment_type: "order",
      payment_method: "membership_card",
      membership_card_id: "PICKL-ABCD1234EFGH5678",
    });
    expect(verifyBody.payment.cart).toHaveLength(1);
    expect(verifyBody.payment.cart[0]).toMatchObject({
      type: "court",
      name: "Court 01",
      date: "2027-05-15",
      startTime: "10:00",
      endTime: "12:00",
      durationHours: 2,
      quantity: 1,
      unitPrice: 300,
    });
  });

  it("fails with 409 when a Member attempts to check out a court whose status is Maintenance", async () => {
    // Step 1a: Inspect inventory and observe Court 02 is under Maintenance
    const inventoryResponse = await getInventory();
    const inventoryBody = await inventoryResponse.json();
    const maintenanceCourt = inventoryBody.courts.find(
      (court: { name: string }) => court.name === "Court 02"
    );
    expect(maintenanceCourt.status).toBe("Maintenance");

    // Step 1b: Attempt to check out the Maintenance court
    const checkoutResponse = await postCheckout(
      new Request("http://localhost/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: "PICKL-ABCD1234EFGH5678",
          cart: [
            {
              id: maintenanceCourt.id,
              type: "court",
              name: maintenanceCourt.name,
              date: "2027-05-15",
              startTime: "14:00",
              durationHours: 1,
              quantity: 1,
              unitPrice: maintenanceCourt.price,
            },
          ],
        }),
      })
    );

    expect(checkoutResponse.status).toBe(409);
    const errorBody = await checkoutResponse.json();
    expect(errorBody.message).toBe("Court 02 is not available to book.");
    expect(store.courtReservations).toHaveLength(0);
  });

  it("fails with 409 when a second checkout overlaps an existing Court Reservation time slot on the same court", async () => {
    const courtId = store.courts[0].id;

    // First reservation: 10:00 to 12:00 on 2027-05-20 succeeds
    const firstCheckout = await postCheckout(
      new Request("http://localhost/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: "PICKL-ABCD1234EFGH5678",
          cart: [
            {
              id: courtId,
              type: "court",
              name: "Court 01",
              date: "2027-05-20",
              startTime: "10:00",
              durationHours: 2,
              quantity: 1,
              unitPrice: 300,
            },
          ],
        }),
      })
    );
    expect(firstCheckout.status).toBe(201);

    // Second reservation: overlapping slot 11:00 to 13:00 on the same court and date fails
    const overlappingCheckout = await postCheckout(
      new Request("http://localhost/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: "PICKL-ABCD1234EFGH5678",
          cart: [
            {
              id: courtId,
              type: "court",
              name: "Court 01",
              date: "2027-05-20",
              startTime: "11:00",
              durationHours: 2,
              quantity: 1,
              unitPrice: 300,
            },
          ],
        }),
      })
    );

    expect(overlappingCheckout.status).toBe(409);
    const errorBody = await overlappingCheckout.json();
    expect(errorBody.message).toBe(
      "One or more selected court times are no longer available. Please choose a different slot."
    );
    expect(store.courtReservations).toHaveLength(1);
  });

  it("fails with 409 when the Active Card does not have enough balance to cover the Court Reservation", async () => {
    const courtId = store.courts[0].id;

    const checkoutResponse = await postCheckout(
      new Request("http://localhost/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: "PICKL-LOWBAL0000000001",
          cart: [
            {
              id: courtId,
              type: "court",
              name: "Court 01",
              date: "2027-05-21",
              startTime: "09:00",
              durationHours: 1,
              quantity: 1,
              unitPrice: 300,
            },
          ],
        }),
      })
    );

    expect(checkoutResponse.status).toBe(409);
    const errorBody = await checkoutResponse.json();
    expect(errorBody.message).toBe(
      "Your membership card does not have enough balance."
    );
    expect(store.courtReservations).toHaveLength(0);
  });

  it("fails with 400 when booking a date in the past or using an invalid Card Number", async () => {
    const courtId = store.courts[0].id;

    const pastBookingResponse = await postCheckout(
      new Request("http://localhost/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: "PICKL-ABCD1234EFGH5678",
          cart: [
            {
              id: courtId,
              type: "court",
              name: "Court 01",
              date: "2020-01-01",
              startTime: "09:00",
              durationHours: 1,
              quantity: 1,
              unitPrice: 300,
            },
          ],
        }),
      })
    );
    expect(pastBookingResponse.status).toBe(400);

    const invalidCardResponse = await postCheckout(
      new Request("http://localhost/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: "INVALID-CARD",
          cart: [
            {
              id: courtId,
              type: "court",
              name: "Court 01",
              date: "2027-05-25",
              startTime: "09:00",
              durationHours: 1,
              quantity: 1,
              unitPrice: 300,
            },
          ],
        }),
      })
    );
    expect(invalidCardResponse.status).toBe(400);
    const invalidCardBody = await invalidCardResponse.json();
    expect(invalidCardBody.message).toBe("Enter a valid membership card ID.");
  });
});
