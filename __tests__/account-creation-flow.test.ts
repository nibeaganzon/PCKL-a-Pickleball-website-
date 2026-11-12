import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerMember, signInMember } from "@/lib/auth";
import { GET as getMembershipCard } from "@/app/api/membership-cards/route";
import { createInMemorySupabaseStore } from "./helpers/in-memory-supabase";

let store = createInMemorySupabaseStore();

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => store.createAuthClient(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => store.createAuthClient(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: () => store.createServiceClient(),
}));

describe("Flow 2: Member creating an account", () => {
  beforeEach(() => {
    store = createInMemorySupabaseStore();

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const rawUrl = typeof input === "string" ? input : input.toString();
      const absoluteUrl = rawUrl.startsWith("http")
        ? rawUrl
        : `http://localhost${rawUrl}`;
      return getMembershipCard(new Request(absoluteUrl));
    });
  });

  it("completes the full account creation flow: registers a new Member, provisions an Active Card, and authenticates the Member", async () => {
    // Step 2a: Register with valid cardholder name, email, and password
    const registration = await registerMember({
      name: "Alex Rivera",
      email: "alex.rivera@pckl.test",
      password: "securePassword123",
    });

    expect(registration.cardNumber).toMatch(/^PICKL-[A-F0-9]{16}$/);

    // Step 2b: Verify the Member can authenticate and retrieve their Active Card from the API
    const signInResult = await signInMember(
      "alex.rivera@pckl.test",
      "securePassword123"
    );
    expect(signInResult.user.email).toBe("alex.rivera@pckl.test");
    expect(signInResult.isAdmin).toBe(false);

    const cardResponse = await getMembershipCard(
      new Request("http://localhost/api/membership-cards")
    );
    expect(cardResponse.status).toBe(200);
    const cardBody = await cardResponse.json();
    expect(cardBody.card).toMatchObject({
      card_number: registration.cardNumber,
      balance: 0,
      status: "Active",
    });
  });

  it("fails when trying to register with an email address that is already registered", async () => {
    await expect(
      registerMember({
        name: "Duplicate User",
        email: "existing.member@pckl.test",
        password: "password123",
      })
    ).rejects.toThrow("User already registered");
  });

  it("fails when registering with invalid inputs: short password, invalid email format, or blank name", async () => {
    await expect(
      registerMember({
        name: "Alex Rivera",
        email: "alex@pckl.test",
        password: "123",
      })
    ).rejects.toThrow("Password must be at least 6 characters.");

    await expect(
      registerMember({
        name: "Alex Rivera",
        email: "not-an-email",
        password: "password123",
      })
    ).rejects.toThrow("Enter a valid email address.");

    await expect(
      registerMember({
        name: " ",
        email: "alex@pckl.test",
        password: "password123",
      })
    ).rejects.toThrow("Cardholder name must be between 2 and 100 characters.");
  });

  it("fails when signing in with a wrong password or an unregistered email", async () => {
    await expect(
      signInMember("existing.member@pckl.test", "wrong-password")
    ).rejects.toThrow("Invalid login credentials");

    await expect(
      signInMember("unknown.user@pckl.test", "password123")
    ).rejects.toThrow("Invalid login credentials");
  });

  it("fails when the account is created in Auth but no Active Card was provisioned", async () => {
    vi.useFakeTimers();
    store.setAutoProvisionCardOnSignup(false);

    const promise = registerMember({
      name: "No Card Member",
      email: "nocard@pckl.test",
      password: "password123",
    });
    const assertion = expect(promise).rejects.toThrow(
      "Your account was created, but your membership card number could not be loaded. Please log in to view your card."
    );

    await vi.runAllTimersAsync();
    await assertion;
    vi.useRealTimers();
  });
});
