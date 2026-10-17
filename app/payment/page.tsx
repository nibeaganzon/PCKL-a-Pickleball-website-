
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { validatePaymentCart } from "@/lib/payments";
import { readCart, writeCart, type CartItem } from "@/lib/cart";
import { useMembershipBalance } from "@/lib/use-membership-balance";

const formatPHP = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);

export default function PaymentPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cardId, setCardId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const { balance, error: balanceError, loading: balanceLoading } =
    useMembershipBalance(cardId);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      try {
        const savedCart = readCart();
        const validatedCart = validatePaymentCart(savedCart);
        if (savedCart.length > 0 && !validatedCart) {
          throw new Error("Invalid cart item");
        }
        setCart(validatedCart ?? []);
      } catch {
        setError("Your cart could not be loaded. Please review your items.");
      } finally {
        setLoaded(true);
      }

    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, []);

  const courtItems = cart.filter((item) => item.type === "court");
  const equipmentItems = cart.filter((item) => item.type === "equipment");

  const total = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum +
          item.unitPrice *
            item.quantity *
            item.durationHours,
        0
      ),
    [cart]
  );

  async function handleSubmit() {
    setError("");

    if (cart.length === 0) {
      setError("Your cart is empty. Add a court reservation or equipment first.");
      return;
    }

    if (
      cart.some(
        (item) =>
          item.type === "court" &&
          (!item.date || !item.startTime || !item.endTime)
      )
    ) {
      setError(
        "Add a date and start time to each court reservation in your cart."
      );
      return;
    }

    if (!/^PCKL-[0-9A-F]{32}$/i.test(cardId.trim())) {
      setError("Please enter a valid membership card ID.");
      return;
    }
    if (balance === null || balance < total) {
      setError("Your membership card balance is too low for this checkout.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart, cardId: cardId.trim() }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.message || "Checkout failed. Please try again."
        );
      }

      if (typeof result.orderReference !== "string") {
        throw new Error("Checkout was saved, but its reference could not be loaded.");
      }
      writeCart([]);
      setCart([]);
      router.push(
        `/payment/submitted?reference=${encodeURIComponent(result.orderReference)}`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!loaded) {
    return <main className="payment-page">Loading your checkout...</main>;
  }

  return (
    <main className="payment-page">
      <header className="payment-header">
        <Link href="/" className="payment-logo">
          PCKL<span>+</span>
        </Link>
        <span className="secure-label">CHECKOUT</span>
      </header>

      <div className="payment-container">
        <div className="payment-heading">
          <p className="eyebrow">ONE CHECKOUT, ONE PAYMENT</p>
          <h1>Complete your payment.</h1>
          <p>
          Pay instantly with your PCKL+ membership card. The balance is
          checked and deducted securely when you confirm.
          </p>
        </div>

        <div className="payment-grid">
          <section className="payment-panel order-panel">
            <div className="panel-heading">
              <h2>Order summary</h2>
              <span>{cart.length} item{cart.length !== 1 ? "s" : ""}</span>
            </div>

            {cart.length === 0 ? (
              <div className="empty-cart">
                <h3>Your cart is empty</h3>
                <p>Add a court reservation or equipment rental to continue.</p>
                <Link href="/courts" className="primary-button">
                  Browse courts
                </Link>
              </div>
            ) : (
              <>
                {courtItems.length > 0 && (
                  <div className="order-section">
                    <h3>COURT RESERVATIONS</h3>
                    {courtItems.map((item) => (
                      <div className="order-item" key={item.id}>
                        <div className="item-icon">🏓</div>
                        <div className="item-details">
                          <strong>{item.name}</strong>
                          <span>
                            {item.date || "Date not set"}
                            {item.startTime && ` · ${item.startTime}`}
                            {item.endTime && `–${item.endTime}`}
                          </span>
                          <small>
                            {item.durationHours} hour
                            {item.durationHours !== 1 ? "s" : ""}
                          </small>
                        </div>
                        <strong>
                          {formatPHP(
                            item.unitPrice * item.quantity * item.durationHours
                          )}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}

                {equipmentItems.length > 0 && (
                  <div className="order-section">
                    <h3>EQUIPMENT RENTALS</h3>
                    {equipmentItems.map((item) => (
                      <div className="order-item" key={item.id}>
                        <div className="item-icon">🎾</div>
                        <div className="item-details">
                          <strong>{item.name}</strong>
                          <span>
                            Qty: {item.quantity} · {item.durationHours} hour
                            {item.durationHours !== 1 ? "s" : ""}
                          </span>
                          <small>
                            {formatPHP(item.unitPrice)} per item/hour
                          </small>
                        </div>
                        <strong>
                          {formatPHP(
                            item.unitPrice * item.quantity * item.durationHours
                          )}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}

                <div className="order-total">
                  <span>Total amount due</span>
                  <strong>{formatPHP(total)}</strong>
                </div>
                <p className="price-note">
                  The total will be deducted immediately from your membership
                  card when you confirm.
                </p>
              </>
            )}
          </section>

          <section className="payment-panel payment-method-panel">
            <div className="panel-heading">
              <h2>Payment details</h2>
              <span className="pending-badge">Membership card</span>
            </div>

            <div className="form-field">
              <label htmlFor="membershipCardId">Membership card ID</label>
              <input
                id="membershipCardId"
                value={cardId}
                onChange={(event) => setCardId(event.target.value.toUpperCase())}
                autoComplete="off"
                maxLength={37}
                placeholder="PCKL-..."
                required
              />
              <p className="price-note">
                Your balance updates automatically. Keep your membership card
                ID private.
              </p>
            </div>

            <div className="order-total">
              <span>Available card balance</span>
              <strong>
                {balanceLoading && balance === null
                  ? "Checking..."
                  : balance === null
                    ? "—"
                    : formatPHP(balance)}
              </strong>
            </div>
            {balanceError && <p className="payment-error">{balanceError}</p>}
            {balance !== null && balance < total && (
              <p className="payment-error">
                Not enough balance.{" "}
                <Link href="/membership/top-up">Top up your card</Link>.
              </p>
            )}
            {error && <p className="payment-error">{error}</p>}

            <button
              className="primary-button submit-payment"
              onClick={handleSubmit}
              disabled={
                loading ||
                cart.length === 0 ||
                balance === null ||
                balance < total
              }
            >
              {loading ? "Charging card..." : "Pay with membership card"}
            </button>

            <p className="verification-note">
              <strong>Reminder:</strong> The card ID authorizes an immediate
              charge. Your booking and rental are confirmed after payment.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
