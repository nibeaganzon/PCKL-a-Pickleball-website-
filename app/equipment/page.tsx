
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CurrentYear from "../current-year";
import CartIndicator from "@/components/cart-indicator";
import { readCart, writeCart } from "@/lib/cart";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";

type Equipment = {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  image: string;
  stock: number;
};

const equipment: Equipment[] = [
  {
    id: "paddle",
    name: "Pickleball Paddle",
    description:
      "A paddle for practice sessions, casual rallies, and competitive games.",
    price: 50,
    unit: "per paddle / hour",
    image:
      "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=85",
    stock: 20,
  },
  {
    id: "ball",
    name: "Pickleball Ball",
    description:
      "Rent pickleball balls for your session and return them after playing.",
    price: 10,
    unit: "per ball / hour",
    image:
      "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=900&q=85",
    stock: 20,
  },
];

export default function EquipmentPage() {
  const { user, card, isAdmin, signOut } = useAuth();
  const [equipmentList, setEquipmentList] = useState<Equipment[]>(equipment);
  const [hours, setHours] = useState<Record<string, number>>({
    paddle: 1,
    ball: 1,
  });

  const [quantities, setQuantities] = useState<Record<string, number>>({
    paddle: 1,
    ball: 1,
  });

  const [remainingStock, setRemainingStock] = useState<Record<string, number>>(
    { paddle: 20, ball: 20 }
  );
  const [cartReady, setCartReady] = useState(false);
  const [message, setMessage] = useState("");
  const [addedItem, setAddedItem] = useState<Equipment | null>(null);

  useEffect(() => {
    async function loadEquipmentFromDatabase() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("equipments")
          .select("id, name, description, price, quantity, images")
          .order("name", { ascending: true });

        if (error) throw error;
        if (data && data.length > 0) {
          const mapped: Equipment[] = data.map((item) => {
            const isPaddle = item.name.toLowerCase().includes("paddle");
            return {
              id: item.id,
              name: item.name,
              description: item.description || "Equipment rental for your match.",
              price: Number(item.price),
              unit: isPaddle ? "per paddle / hour" : "per ball / hour",
              image:
                item.images && item.images.length > 0
                  ? item.images[0]
                  : isPaddle
                  ? "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=85"
                  : "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=900&q=85",
              stock: Number(item.quantity ?? 20),
            };
          });
          setEquipmentList(mapped);

          const cart = readCart();
          setRemainingStock(
            Object.fromEntries(
              mapped.map((item) => [
                item.id,
                Math.max(
                  0,
                  item.stock -
                    cart
                      .filter((cartItem) => cartItem.id === item.id || cartItem.name === item.name)
                      .reduce((total, cartItem) => total + cartItem.quantity, 0)
                ),
              ])
            )
          );
        }
      } catch (err) {
        console.error("Failed to load equipments from Supabase:", err);
      } finally {
        setCartReady(true);
      }
    }

    void loadEquipmentFromDatabase();
  }, []);

  function addToCart(item: Equipment, requestedQuantity: number) {
    if (!cartReady) {
      return;
    }

    const newItem = {
      id: item.id,
      type: "equipment" as const,
      name: item.name,
      unitPrice: item.price,
      durationHours: hours[item.id] ?? 1,
      quantity: requestedQuantity,
      image: item.image,
    };

    try {
      const cart = readCart();
      const currentQuantity = cart
        .filter(
          (cartItem) =>
            cartItem.type === "equipment" && cartItem.id === item.id
        )
        .reduce((total, cartItem) => total + cartItem.quantity, 0);
      const available = Math.max(0, item.stock - currentQuantity);

      if (newItem.quantity > available) {
        setRemainingStock((current) => ({
          ...current,
          [item.id]: available,
        }));
        setMessage(
          available === 0
            ? `${item.name} is out of stock.`
            : `Only ${available} ${item.name.toLowerCase()}${
                available === 1 ? "" : "s"
              } remaining.`
        );
        return;
      }

      const existingIndex = cart.findIndex(
        (cartItem) =>
          cartItem.type === "equipment" && cartItem.id === newItem.id
      );

      if (existingIndex >= 0) {
        cart[existingIndex] = {
          ...cart[existingIndex],
          durationHours: newItem.durationHours,
          quantity: cart[existingIndex].quantity + newItem.quantity,
        };
      } else {
        cart.push(newItem);
      }

      writeCart(cart);

      setRemainingStock((current) => ({
        ...current,
        [item.id]: available - newItem.quantity,
      }));
      setMessage("");
      setAddedItem(item);
    } catch {
      setMessage("Unable to save your cart. Please try again.");
    }
  }

  return (
    <main className="equipment-page">
      <header className="equipment-header">
        <Link href="/" className="equipment-logo">
          PCKL<span>+</span>
        </Link>

        <nav className="equipment-nav" aria-label="Main navigation">
          <Link href="/">Home</Link>
          <Link href="/courts">Courts</Link>
          <Link href="/equipment" className="active">
            Equipment
          </Link>
          <Link href="/membership/top-up">Membership</Link>
        </nav>

        <div className="equipment-header-actions">
          <CartIndicator className="equipment-cart-link" />
          <Link href="/payment" className="equipment-checkout-button">
            Checkout
          </Link>
          {isAdmin && (
            <Link href="/admin" className="equipment-checkout-button" style={{ background: "#059669" }}>
              Admin
            </Link>
          )}
          {user ? (
            <>
              <span style={{ fontSize: "0.85rem", opacity: 0.9 }}>
                {card?.card_number || user.email}
              </span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="equipment-login"
                style={{ cursor: "pointer", background: "none", border: "none" }}
              >
                Log out
              </button>
            </>
          ) : (
            <Link href="/login" className="equipment-login">
              Log in
            </Link>
          )}
        </div>
      </header>

      <section className="equipment-hero">
        <div className="equipment-hero-copy">
          <span className="equipment-eyebrow">
            GEAR UP FOR YOUR GAME
          </span>
          <h1>
            Your game.
            <br />
            Your <span>gear.</span>
          </h1>
          <p>
            No equipment? No problem. Rent paddles and balls by the hour
            and get ready to play at PCKL+ in General Santos City.
          </p>
          <a href="#equipment-list" className="equipment-primary-button">
            Explore equipment <span>↓</span>
          </a>
        </div>

        <div className="equipment-hero-image">
          <div className="equipment-hero-overlay" />
          <div className="equipment-hero-label">
            <span>AVAILABLE FOR RENT</span>
            <strong>Everything you need to play.</strong>
          </div>
        </div>
      </section>

      <section className="equipment-info-strip">
        <div>
          <strong>₱50</strong>
          <span>Paddle rental / hour</span>
        </div>
        <div>
          <strong>₱10</strong>
          <span>Ball rental / hour</span>
        </div>
        <div>
          <strong>GenSan</strong>
          <span>One convenient location</span>
        </div>
      </section>

      <section className="equipment-list-section" id="equipment-list">
        <div className="equipment-section-heading">
          <div>
            <span className="equipment-eyebrow">RENT YOUR GAME ESSENTIALS</span>
            <h2>Equipment rental<span>.</span></h2>
            <p>
              Choose your equipment, set your rental duration, and add it
              to your cart before payment.
            </p>
          </div>
        </div>

        {message && (
          <div className="equipment-message" role="status">
            <span>✓</span> {message}
            <Link href="/cart">View cart →</Link>
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setMessage("")}
            >
              ×
            </button>
          </div>
        )}

        <div className="equipment-grid">
          {equipmentList.map((item) => {
            const itemHours = hours[item.id] ?? 1;
            const available = remainingStock[item.id] ?? item.stock;
            const itemQuantity = Math.min(
              quantities[item.id] ?? 1,
              Math.max(available, 1)
            );
            const total = item.price * itemHours * itemQuantity;

            return (
              <article className="equipment-card" key={item.id}>
                <div className="equipment-card-image">
                  <img src={item.image} alt={item.name} />
                  <span className="equipment-rent-badge">
                    Available for rent
                  </span>
                </div>

                <div className="equipment-card-content">
                  <span className="equipment-card-category">
                    PICKLEBALL ESSENTIAL
                  </span>
                  <h3>{item.name}</h3>
                  <p className="equipment-description">
                    {item.description}
                  </p>

                  <div className="equipment-price">
                    <strong>₱{item.price}</strong>
                    <span>{item.unit}</span>
                  </div>
                  <p
                    className={`equipment-stock ${
                      available === 0 ? "equipment-stock-empty" : ""
                    }`}
                    aria-live="polite"
                  >
                    {available === 0
                      ? "Out of stock"
                      : `${available} of ${item.stock} available`}
                  </p>

                  <div className="equipment-options">
                    <div className="equipment-option">
                      <label htmlFor={`${item.id}-hours`}>
                        Rental duration
                      </label>
                      <select
                        id={`${item.id}-hours`}
                        value={itemHours}
                        onChange={(event) =>
                          setHours((current) => ({
                            ...current,
                            [item.id]: Number(event.target.value),
                          }))
                        }
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((hour) => (
                          <option key={hour} value={hour}>
                            {hour} {hour === 1 ? "hour" : "hours"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="equipment-option">
                      <label htmlFor={`${item.id}-quantity`}>
                        Quantity
                      </label>
                      <select
                        id={`${item.id}-quantity`}
                        value={itemQuantity}
                        disabled={available === 0}
                        onChange={(event) =>
                          setQuantities((current) => ({
                            ...current,
                            [item.id]: Number(event.target.value),
                          }))
                        }
                      >
                        {Array.from(
                          { length: Math.min(10, Math.max(available, 1)) },
                          (_, index) => index + 1
                        ).map((quantity) => (
                          <option key={quantity} value={quantity}>
                            {quantity}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="equipment-card-total">
                    <span>Estimated rental total</span>
                    <strong>₱{total.toLocaleString("en-PH")}</strong>
                  </div>

                  <button
                    type="button"
                    className="equipment-add-button"
                    onClick={() => addToCart(item, itemQuantity)}
                    disabled={!cartReady || available === 0}
                  >
                    {available === 0 ? "Out of Stock" : "Add to Cart"}{" "}
                    <span>＋</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="equipment-checkout-note">
          <span className="equipment-note-icon">i</span>
          <p>
            We have 20 paddles and 20 balls available to rent. Stock is
            limited to 20 of each type per cart. Once all 20 are added,
            additional units cannot be added.
          </p>
        </div>
      </section>

      <section className="equipment-bottom-cta">
        <div>
          <span>READY TO HIT THE COURT?</span>
          <h2>Get your gear. Get in the game.</h2>
        </div>
        <Link href="/cart" className="equipment-primary-button">
          Go to Your Cart <span>↗</span>
        </Link>
      </section>

      <footer className="equipment-footer">
        <Link href="/" className="equipment-logo">
          PCKL<span>+</span>
        </Link>
        <p>Made for the love of the game.</p>
        <CurrentYear />
      </footer>

      {addedItem && (
        <div className="equipment-modal-backdrop">
          <section
            className="equipment-added-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="equipment-added-title"
          >
            <button
              type="button"
              className="equipment-dialog-close"
              aria-label="Close confirmation"
              onClick={() => setAddedItem(null)}
              autoFocus
            >
              ×
            </button>
            <span className="equipment-dialog-check" aria-hidden="true">
              ✓
            </span>
            <h2 id="equipment-added-title">Added to your cart</h2>
            <p>{addedItem.name} has been added to your cart.</p>
            <div className="equipment-dialog-actions">
              <button
                type="button"
                className="equipment-dialog-continue"
                onClick={() => setAddedItem(null)}
              >
                Continue renting
              </button>
              <Link
                href="/cart"
                className="equipment-dialog-cart"
                onClick={() => setAddedItem(null)}
              >
                View cart
              </Link>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
