export type CourtRow = {
  id: string;
  name: string;
  description: string;
  type: "Indoor" | "Outdoor";
  is_active: boolean;
  price: number;
  images: string[];
};

export type EquipmentRow = {
  id: string;
  name: string;
  description: string;
  quantity: number;
  price: number;
  images: string[];
};

export type MembershipCardRow = {
  id: string;
  user_id: string;
  card_number: string;
  balance: number;
  status: "Active" | "Inactive";
  issued_at: string;
};

export type CourtReservationRow = {
  id: string;
  transaction_id: string;
  court_id: string;
  amount: number;
  start_date: string;
  end_date: string;
  status: "Active" | "Cancelled" | "Done" | "Pending";
};

export type EquipmentRentalRow = {
  id: string;
  transaction_id: string;
  equipment_id: string;
  quantity: number;
  unit_price: number;
  start_date: string;
  end_date: string;
  status: "Active" | "Cancelled" | "Done" | "Pending";
};

export type TransactionRow = {
  id: string;
  card_id: string;
  total_amount: number;
  transaction_type: "Checkout" | "Refund";
  order_reference: string;
  transaction_date: string;
};

export type AuthUserRecord = {
  id: string;
  email: string;
  password: string;
  user_metadata: {
    full_name?: string;
  };
};

export function createInMemorySupabaseStore() {
  const courts: CourtRow[] = [
    {
      id: "11111111-1111-4111-8111-111111111101",
      name: "Court 01",
      description: "Tournament-grade indoor court",
      type: "Indoor",
      is_active: true,
      price: 300,
      images: ["/courts/court-01.jpg"],
    },
    {
      id: "11111111-1111-4111-8111-111111111102",
      name: "Court 02",
      description: "Outdoor court currently resurfacing",
      type: "Outdoor",
      is_active: false,
      price: 250,
      images: ["/courts/court-02.jpg"],
    },
  ];

  const equipments: EquipmentRow[] = [
    {
      id: "22222222-2222-4222-8222-222222222201",
      name: "Pickleball Paddle",
      description: "Carbon fiber paddle",
      quantity: 20,
      price: 50,
      images: ["/equipment/paddle.jpg"],
    },
  ];

  const users: AuthUserRecord[] = [
    {
      id: "33333333-3333-4333-8333-333333333301",
      email: "existing.member@pckl.test",
      password: "password123",
      user_metadata: { full_name: "Existing Member" },
    },
  ];

  const adminUserIds = new Set<string>();

  const membershipCards: MembershipCardRow[] = [
    {
      id: "44444444-4444-4444-8444-444444444401",
      user_id: "33333333-3333-4333-8333-333333333301",
      card_number: "PICKL-ABCD1234EFGH5678",
      balance: 2000,
      status: "Active",
      issued_at: "2026-11-01T00:00:00.000Z",
    },
    {
      id: "44444444-4444-4444-8444-444444444402",
      user_id: "33333333-3333-4333-8333-333333333302",
      card_number: "PICKL-LOWBAL0000000001",
      balance: 100,
      status: "Active",
      issued_at: "2026-11-01T00:00:00.000Z",
    },
  ];

  const transactions: TransactionRow[] = [];
  const courtReservations: CourtReservationRow[] = [];
  const equipmentRentals: EquipmentRentalRow[] = [];

  let currentSessionUser: AuthUserRecord | null = null;
  let autoProvisionCardOnSignup = true;
  let counter = 1;

  function nextHex(length: number) {
    const raw = (counter++).toString(16).toUpperCase();
    return raw.padStart(length, "0").slice(-length);
  }

  function createServiceClient() {
    return {
      from(table: string) {
        const filters: Array<{ column: string; value: unknown }> = [];

        const builder = {
          select(_columns?: string) {
            return builder;
          },
          eq(column: string, value: unknown) {
            filters.push({ column, value });
            return builder;
          },
          order(_column: string, _options?: { ascending?: boolean }) {
            return builder;
          },
          limit(_count: number) {
            return builder;
          },
          async maybeSingle() {
            const rows = await executeQuery();
            return { data: rows[0] ?? null, error: null };
          },
          then(
            onFulfilled?: (value: { data: unknown[]; error: null }) => unknown,
            onRejected?: (reason: unknown) => unknown
          ) {
            return executeQuery()
              .then((data) => ({ data, error: null }))
              .then(onFulfilled, onRejected);
          },
        };

        async function executeQuery(): Promise<unknown[]> {
          if (table === "courts") {
            return courts
              .filter((row) =>
                filters.every(
                  (f) => (row as Record<string, unknown>)[f.column] === f.value
                )
              )
              .sort((a, b) => a.name.localeCompare(b.name));
          }

          if (table === "equipments") {
            return equipments
              .filter((row) =>
                filters.every(
                  (f) => (row as Record<string, unknown>)[f.column] === f.value
                )
              )
              .sort((a, b) => a.name.localeCompare(b.name));
          }

          if (table === "membership_cards") {
            return membershipCards
              .filter((row) =>
                filters.every(
                  (f) => (row as Record<string, unknown>)[f.column] === f.value
                )
              )
              .sort((a, b) => b.issued_at.localeCompare(a.issued_at));
          }

          if (table === "admin_members") {
            const userIdFilter = filters.find((f) => f.column === "user_id");
            if (
              userIdFilter &&
              typeof userIdFilter.value === "string" &&
              adminUserIds.has(userIdFilter.value)
            ) {
              return [{ user_id: userIdFilter.value }];
            }
            return [];
          }

          if (table === "transactions") {
            return transactions
              .filter((row) =>
                filters.every(
                  (f) => (row as Record<string, unknown>)[f.column] === f.value
                )
              )
              .map((tx) => {
                const card = membershipCards.find((c) => c.id === tx.card_id);
                const reservations = courtReservations
                  .filter((r) => r.transaction_id === tx.id)
                  .map((r) => ({
                    ...r,
                    courts: {
                      name:
                        courts.find((c) => c.id === r.court_id)?.name ?? "Court",
                    },
                  }));
                const rentals = equipmentRentals
                  .filter((er) => er.transaction_id === tx.id)
                  .map((er) => ({
                    ...er,
                    equipments: {
                      name:
                        equipments.find((e) => e.id === er.equipment_id)?.name ??
                        "Equipment",
                    },
                  }));

                return {
                  ...tx,
                  membership_cards: {
                    card_number: card?.card_number ?? tx.card_id,
                  },
                  court_reservations: reservations,
                  equipment_rentals: rentals,
                };
              });
          }

          if (table === "topups") {
            return [];
          }

          return [];
        }

        return builder;
      },

      async rpc(
        fnName: string,
        args: {
          p_card_id: string;
          p_cart: Array<{
            id: string;
            type: "court" | "equipment";
            name: string;
            date?: string;
            startTime?: string;
            endTime?: string;
            durationHours: number;
            quantity: number;
            unitPrice: number;
          }>;
          p_amount: number;
        }
      ) {
        if (fnName !== "charge_membership_card") {
          return {
            data: null,
            error: { message: `Unknown RPC ${fnName}`, code: "42883" },
          };
        }

        const normalizedCardId = args.p_card_id.trim().toUpperCase();
        const card = membershipCards.find(
          (c) =>
            c.status === "Active" &&
            (c.id.toUpperCase() === normalizedCardId ||
              c.card_number.toUpperCase() === normalizedCardId)
        );

        if (!card) {
          return {
            data: null,
            error: { message: "CARD_NOT_FOUND", code: "P0001" },
          };
        }

        if (!Array.isArray(args.p_cart) || args.p_cart.length === 0) {
          return {
            data: null,
            error: { message: "INVALID_CART", code: "P0001" },
          };
        }

        if (!Number.isFinite(args.p_amount) || args.p_amount <= 0) {
          return {
            data: null,
            error: { message: "INVALID_AMOUNT", code: "P0001" },
          };
        }

        if (card.balance < args.p_amount) {
          return {
            data: null,
            error: { message: "INSUFFICIENT_BALANCE", code: "P0001" },
          };
        }

        const pendingReservations: CourtReservationRow[] = [];
        const pendingRentals: EquipmentRentalRow[] = [];
        const transactionId = `55555555-5555-4555-8555-${nextHex(12)}`;

        for (const item of args.p_cart) {
          if (item.type === "court") {
            const court = courts.find((c) => c.id === item.id);
            if (!court) {
              return {
                data: null,
                error: { message: "COURT_NOT_FOUND", code: "P0001" },
              };
            }
            const startIso = new Date(
              `${item.date}T${item.startTime}:00+08:00`
            ).toISOString();
            const endIso = new Date(
              new Date(startIso).getTime() +
                item.durationHours * 60 * 60 * 1000
            ).toISOString();

            const allActiveReservations = [
              ...courtReservations.filter((r) => r.status !== "Cancelled"),
              ...pendingReservations,
            ];

            const hasOverlap = allActiveReservations.some(
              (existing) =>
                existing.court_id === court.id &&
                Date.parse(startIso) < Date.parse(existing.end_date) &&
                Date.parse(endIso) > Date.parse(existing.start_date)
            );

            if (hasOverlap) {
              return {
                data: null,
                error: {
                  code: "23P01",
                  message:
                    'conflicting key value violates exclusion constraint "court_reservations_no_overlap"',
                },
              };
            }

            pendingReservations.push({
              id: `66666666-6666-4666-8666-${nextHex(12)}`,
              transaction_id: transactionId,
              court_id: court.id,
              amount: item.unitPrice * item.durationHours,
              start_date: startIso,
              end_date: endIso,
              status: "Active",
            });
          } else {
            const equipment = equipments.find((e) => e.id === item.id);
            if (!equipment) {
              return {
                data: null,
                error: { message: "EQUIPMENT_NOT_FOUND", code: "P0001" },
              };
            }
            const startIso = new Date().toISOString();
            const endIso = new Date(
              Date.now() + item.durationHours * 60 * 60 * 1000
            ).toISOString();

            pendingRentals.push({
              id: `77777777-7777-4777-8777-${nextHex(12)}`,
              transaction_id: transactionId,
              equipment_id: equipment.id,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              start_date: startIso,
              end_date: endIso,
              status: "Active",
            });
          }
        }

        card.balance -= args.p_amount;
        const orderReference = `PAY-${nextHex(20)}`;
        transactions.push({
          id: transactionId,
          card_id: card.id,
          total_amount: args.p_amount,
          transaction_type: "Checkout",
          order_reference: orderReference,
          transaction_date: new Date().toISOString(),
        });
        courtReservations.push(...pendingReservations);
        equipmentRentals.push(...pendingRentals);

        return {
          data: [
            {
              order_reference: orderReference,
              balance_after: card.balance,
            },
          ],
          error: null,
        };
      },
    };
  }

  function createAuthClient() {
    const serviceClient = createServiceClient();
    return {
      ...serviceClient,
      auth: {
        async getUser() {
          if (!currentSessionUser) {
            return {
              data: { user: null },
              error: new Error("Auth session missing!"),
            };
          }
          return {
            data: { user: currentSessionUser },
            error: null,
          };
        },
        async signUp(params: {
          email: string;
          password: string;
          options?: { data?: { full_name?: string } };
        }) {
          const email = params.email.trim().toLowerCase();
          const duplicate = users.find((u) => u.email.toLowerCase() === email);
          if (duplicate) {
            return {
              data: { user: null, session: null },
              error: new Error("User already registered"),
            };
          }

          const newUser: AuthUserRecord = {
            id: `33333333-3333-4333-8333-${nextHex(12).toLowerCase()}`,
            email,
            password: params.password,
            user_metadata: {
              full_name: params.options?.data?.full_name,
            },
          };
          users.push(newUser);
          currentSessionUser = newUser;

          if (autoProvisionCardOnSignup) {
            membershipCards.push({
              id: `44444444-4444-4444-8444-${nextHex(12).toLowerCase()}`,
              user_id: newUser.id,
              card_number: `PICKL-${nextHex(16)}`,
              balance: 0,
              status: "Active",
              issued_at: new Date().toISOString(),
            });
          }

          return {
            data: {
              user: newUser,
              session: { access_token: "mock-token", user: newUser },
            },
            error: null,
          };
        },
        async signInWithPassword(params: { email: string; password: string }) {
          const email = params.email.trim().toLowerCase();
          const matchedUser = users.find(
            (u) =>
              u.email.toLowerCase() === email && u.password === params.password
          );
          if (!matchedUser) {
            return {
              data: { user: null, session: null },
              error: new Error("Invalid login credentials"),
            };
          }
          currentSessionUser = matchedUser;
          return {
            data: {
              user: matchedUser,
              session: { access_token: "mock-token", user: matchedUser },
            },
            error: null,
          };
        },
      },
    };
  }

  return {
    courts,
    equipments,
    users,
    membershipCards,
    transactions,
    courtReservations,
    equipmentRentals,
    setAutoProvisionCardOnSignup(enabled: boolean) {
      autoProvisionCardOnSignup = enabled;
    },
    setCurrentSessionUser(user: AuthUserRecord | null) {
      currentSessionUser = user;
    },
    createServiceClient,
    createAuthClient,
  };
}
