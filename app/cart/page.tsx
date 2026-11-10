"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CartIndicator from "@/components/cart-indicator";
import { readCart, writeCart, type CartItem } from "@/lib/cart";
import CurrentYear from "../current-year";

const MAX_RENTAL_QUANTITY = 20;

function formatPeso(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

function lineTotal(item: CartItem) {
  return item.unitPrice * item.durationHours * item.quantity;
}

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      try {
        setItems(readCart());
      } catch {
        setError("Unable to load your cart. Please review it and try again.");
      } finally {
        setLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, []);

  function saveCart(updatedItems: CartItem[]) {
    try {
      writeCart(updatedItems);
      setItems(updatedItems);
      setError("");
    } catch {
      setError("Your cart could not be saved. Please try again.");
    }
  }

  function updateItem(
    id: string,
    field: "durationHours" | "quantity" | "date" | "startTime",
    value: number | string
  ) {
    if (
      field === "quantity" &&
      (typeof value !== "number" || value > MAX_RENTAL_QUANTITY)
    ) {
      return;
    }

    saveCart(
      items.map((item) => {
        if (item.id !== id) return item;
        const updated: CartItem = { ...item };
        if (field === "durationHours" && typeof value === "number") {
          updated.durationHours = value;
        } else if (field === "quantity" && typeof value === "number") {
          updated.quantity = value;
        } else if (field === "date" && typeof value === "string") {
          updated.date = value;
        } else if (field === "startTime" && typeof value === "string") {
          updated.startTime = value;
        }
        if (
          updated.type === "court" &&
          updated.startTime &&
          updated.date &&
          (field === "startTime" || field === "date" || field === "durationHours")
        ) {
          const end = new Date(
            `${updated.date}T${updated.startTime}:00`
          );
          end.setHours(end.getHours() + updated.durationHours);
          updated.endTime = `${String(end.getHours()).padStart(2, "0")}:${String(
            end.getMinutes()
          ).padStart(2, "0")}`;
        }
        return updated;
      })
    );
  }

  function removeItem(id: string) {
    saveCart(items.filter((item) => item.id !== id));
  }

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const equipmentQuantity = items
    .filter((item) => item.type === "equipment")
    .reduce((sum, item) => sum + item.quantity, 0);
  const equipmentTypes = new Set(
    items
      .filter((item) => item.type === "equipment")
      .map((item) => item.id)
  ).size;
  const total = useMemo(
    () => items.reduce((sum, item) => sum + lineTotal(item), 0),
    [items]
  );

  function proceedToCheckout() {
    router.push("/payment");
  }

  return (
    <main className="cart-page">
      <header className="cart-header">
        <Link href="/" className="cart-logo">
          PCKL<span>+</span>
        </Link>

        <nav className="cart-nav" aria-label="Main navigation">
          <Link href="/">Home</Link>
          <Link href="/courts">Courts</Link>
          <Link href="/equipment">Equipment</Link>
          <Link href="/membership">Membership</Link>
        </nav>

        <div className="cart-header-actions">
          <CartIndicator className="equipment-cart-link" />
          <button
            type="button"
            className="cart-header-checkout"
            onClick={proceedToCheckout}
            disabled={items.length === 0}
          >
            Checkout
          </button>
        </div>
      </header>

      <section className="cart-main">
        <div className="cart-breadcrumb">
          <Link href="/equipment">Equipment</Link> / Your Cart
        </div>

        <h1 className="cart-title">Your Cart<span>.</span></h1>
        <p className="cart-subtitle">
          Review court reservations and equipment rentals before checkout.
        </p>

        {error && <p className="cart-error" role="alert">{error}</p>}

        {!loaded ? (
          <div className="cart-empty">
            <p>Loading your cart...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="cart-empty">
            <div className="cart-empty-icon" aria-hidden="true">🛒</div>
            <h2>Your cart is waiting for your next game.</h2>
            <p>Add a court reservation or equipment rental to get started.</p>
            <div className="cart-empty-actions">
              <Link href="/courts" className="cart-empty-button">
                Browse Courts
              </Link>
              <Link href="/equipment" className="cart-continue-button">
                Browse Equipment
              </Link>
            </div>
          </div>
        ) : (
          <div className="cart-layout">
            <section className="cart-items-panel">
              <div className="cart-panel-heading">
                Cart Items ({totalQuantity})
              </div>

              {items.map((item) => (
                <article className="cart-item" key={item.id}>
                  {item.image ? (
                    <img src={item.image} alt={item.name} />
                  ) : (
                    <div className="cart-item-placeholder" aria-hidden="true">
                      {item.type === "court" ? "▣" : "🎾"}
                    </div>
                  )}

                  <div className="cart-item-details">
                    <span className="cart-item-type">
                      {item.type === "court" ? "COURT RESERVATION" : "EQUIPMENT RENTAL"}
                    </span>
                    <h3>{item.name}</h3>
                    <p>
                      {formatPeso(item.unitPrice)} × {item.durationHours}{" "}
                      {item.durationHours === 1 ? "hour" : "hours"}
                      {item.type === "equipment" &&
                        ` × ${item.quantity} ${item.quantity === 1 ? "item" : "items"}`}
                    </p>

                    {item.type === "court" ? (
                      <div className="cart-item-controls">
                        <label>
                          Date
                          <input
                            type="date"
                            value={item.date ?? ""}
                            onChange={(event) =>
                              updateItem(item.id, "date", event.target.value)
                            }
                          />
                        </label>
                        <label>
                          Start time
                          <input
                            type="time"
                            value={item.startTime ?? ""}
                            onChange={(event) =>
                              updateItem(item.id, "startTime", event.target.value)
                            }
                          />
                        </label>
                        <label>
                          Hours
                          <select
                            value={item.durationHours}
                            onChange={(event) =>
                              updateItem(
                                item.id,
                                "durationHours",
                                Number(event.target.value)
                              )
                            }
                          >
                            {Array.from({ length: 8 }, (_, index) => index + 1).map(
                              (hour) => (
                                <option key={hour} value={hour}>
                                  {hour}
                                </option>
                              )
                            )}
                          </select>
                        </label>
                      </div>
                    ) : (
                      <div className="cart-item-controls">
                        <label>
                          Hours
                          <select
                            value={item.durationHours}
                            onChange={(event) =>
                              updateItem(
                                item.id,
                                "durationHours",
                                Number(event.target.value)
                              )
                            }
                          >
                            {Array.from({ length: 8 }, (_, index) => index + 1).map(
                              (hour) => (
                                <option key={hour} value={hour}>
                                  {hour}
                                </option>
                              )
                            )}
                          </select>
                        </label>
                        <label>
                          Quantity
                          <select
                            value={item.quantity}
                            onChange={(event) =>
                              updateItem(
                                item.id,
                                "quantity",
                                Number(event.target.value)
                              )
                            }
                          >
                            {Array.from(
                              { length: MAX_RENTAL_QUANTITY },
                              (_, index) => index + 1
                            ).map((quantity) => (
                              <option key={quantity} value={quantity}>
                                {quantity}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}

                    <button
                      type="button"
                      className="cart-remove-button"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Remove ${item.name} from cart`}
                    >
                      Remove
                    </button>
                    <div className="cart-item-total">
                      {formatPeso(lineTotal(item))}
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <aside className="cart-summary">
              <h2>Order Summary</h2>

              <div className="cart-summary-row">
                <span>Court reservations</span>
                <strong>{items.filter((item) => item.type === "court").length}</strong>
              </div>
              <div className="cart-summary-row">
                <span>Equipment types</span>
                <strong>{equipmentTypes}</strong>
              </div>
              <div className="cart-summary-row">
                <span>Equipment quantity</span>
                <strong>{equipmentQuantity}</strong>
              </div>
              <div className="cart-summary-row">
                <span>Items</span>
                <strong>{totalQuantity}</strong>
              </div>

              <div className="cart-summary-total">
                <div className="cart-summary-row">
                  <span>Estimated Total</span>
                  <strong>{formatPeso(total)}</strong>
                </div>
              </div>

              <button
                type="button"
                className="cart-checkout-button"
                onClick={proceedToCheckout}
              >
                Checkout <span>↗</span>
              </button>

              <Link href="/courts" className="cart-continue-button">
                Continue Shopping
              </Link>

              <p className="cart-summary-note">
                Court reservations and equipment rentals are confirmed
                immediately when you pay with your PCKL+ membership card.
              </p>
            </aside>
          </div>
        )}
      </section>

      <footer className="cart-footer">
        <Link href="/" className="cart-logo">
          PCKL<span>+</span>
        </Link>
        <p>Made for the love of the game.</p>
        <CurrentYear />
      </footer>
    </main>
  );
}
