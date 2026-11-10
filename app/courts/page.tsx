"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CurrentYear from "../current-year";
import CartIndicator from "@/components/cart-indicator";
import { readCart, writeCart, type CartItem } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { useInventory } from "@/lib/use-inventory";
import type { CourtInventoryItem } from "@/lib/inventory";

type Court = CourtInventoryItem;

type AvailabilityFilter = "All" | "Available" | "Maintenance";
type CourtTypeFilter = "All" | "Indoor" | "Outdoor";

export default function CourtsPage() {
  const { user, card, isAdmin, signOut } = useAuth();
  const { courts, loading, error } = useInventory();
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingStartTime, setBookingStartTime] = useState("");
  const [bookingDuration, setBookingDuration] = useState(1);
  const [minimumBookingDate, setMinimumBookingDate] = useState("");
  const [cartError, setCartError] = useState("");
  const [cartNotice, setCartNotice] = useState("");
  const [search, setSearch] = useState("");
  const [availability, setAvailability] =
    useState<AvailabilityFilter>("All");
  const [courtType, setCourtType] = useState<CourtTypeFilter>("All");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const today = new Date();
      const formatted = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      setMinimumBookingDate(formatted);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredCourts = useMemo(() => {
    return courts.filter((court) => {
      const searchLower = search.toLowerCase().trim();
      const courtNum = court.name.match(/\d+/)?.[0] ?? "";
      const matchesSearch =
        !searchLower ||
        court.name.toLowerCase().includes(searchLower) ||
        courtNum.includes(searchLower);

      const matchesAvailability =
        availability === "All" || court.status === availability;

      const matchesType =
        courtType === "All" || court.courtType === courtType;

      return matchesSearch && matchesAvailability && matchesType;
    });
  }, [courts, search, availability, courtType]);

  const availableCount = courts.filter(
    (court) => court.status === "Available"
  ).length;

  function addCourtToCart() {
    if (!selectedCourt || !bookingDate || !bookingStartTime) {
      setCartError("Choose a date and start time for your court reservation.");
      return;
    }

    try {
      const start = new Date(`${bookingDate}T${bookingStartTime}`);
      if (start.getTime() <= Date.now()) {
        setCartError("Choose a future date and start time.");
        return;
      }
      const end = new Date(start.getTime() + bookingDuration * 60 * 60 * 1000);
      const endTime = `${String(end.getHours()).padStart(2, "0")}:${String(
        end.getMinutes()
      ).padStart(2, "0")}`;
      const reservation: CartItem = {
        id: `court-${selectedCourt.id}-${Date.now()}`,
        inventoryId: selectedCourt.id,
        type: "court",
        name: selectedCourt.name,
        date: bookingDate,
        startTime: bookingStartTime,
        endTime,
        durationHours: bookingDuration,
        quantity: 1,
        unitPrice: selectedCourt.price,
        image: selectedCourt.image,
      };

      writeCart([...readCart(), reservation]);
      setCartNotice(`${selectedCourt.name} added to your cart.`);
      setCartError("");
      setSelectedCourt(null);
      setBookingDate("");
      setBookingStartTime("");
      setBookingDuration(1);
    } catch {
      setCartError("Your cart could not be saved. Please try again.");
    }
  }

  return (
    <main className="courts-page">
      <header className="courts-header">
        <Link href="/" className="courts-logo" aria-label="PCKL+ home">
          PCKL<span>+</span>
        </Link>

        <nav className="courts-nav" aria-label="Main navigation">
          <Link href="/">Home</Link>
          <Link href="/courts" className="active">
            Courts
          </Link>
          <Link href="/equipment">Equipment</Link>
          <Link href="/membership/top-up">Membership
          </Link>
        </nav>

        <div className="courts-header-actions">
          <CartIndicator className="courts-cart-link" />
          <Link href="/payment" className="courts-checkout-button">
            Checkout
          </Link>
          {isAdmin && (
            <Link href="/admin" className="courts-checkout-button" style={{ background: "#059669" }}>
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
                className="courts-login"
                style={{ cursor: "pointer", background: "none", border: "none" }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="courts-login">
                Log in
              </Link>
              <Link href="/register" className="courts-register">
                Join PCKL+ <span>↗</span>
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="courts-hero">
        <div className="courts-hero-copy">
          <span className="courts-eyebrow">
            <span className="courts-live-dot" />
            YOUR NEXT GAME STARTS HERE
          </span>

          <h1>
            Find your
            <br />
            <span>court.</span> Own the game.
          </h1>

          <p>
            Courts for every game. One location. Endless rallies.
            Find your spot and book your next pickleball session in General
            Santos City.
          </p>

          <a href="#court-list" className="courts-hero-button">
            Explore all courts <span>↓</span>
          </a>
        </div>

        <div className="courts-hero-image">
          <div className="hero-image-overlay" />
          <div className="hero-image-label">
            <span>YOUR HOME COURT</span>
            <strong>General Santos City</strong>
          </div>
          <div className="hero-image-number">
            <strong>{courts.length}</strong>
            <span>COURTS</span>
          </div>
        </div>
      </section>

      <section className="courts-overview" aria-label="Court summary">
        <div className="overview-item">
          <span className="overview-icon">▦</span>
          <div>
            <strong>{courts.length}</strong>
            <span>Total courts</span>
          </div>
        </div>

        <div className="overview-item">
          <span className="overview-icon lime-icon">✓</span>
          <div>
            <strong>{availableCount}</strong>
            <span>Available to book</span>
          </div>
        </div>

        <div className="overview-item">
          <span className="overview-icon">⌖</span>
          <div>
            <strong>1 location</strong>
            <span>General Santos City</span>
          </div>
        </div>

        <div className="overview-note">
          <span className="overview-note-dot" />
          <p>Choose a court to see booking options.</p>
        </div>
      </section>

      <section className="court-list-section" id="court-list">
        <div className="court-list-heading">
          <div>
            <span className="section-eyebrow">PICK YOUR PLAYING SPACE</span>
            <h2>Our courts<span>.</span></h2>
            <p>Find the right court for your next match.</p>
          </div>

          <span className="court-result-count">
            {filteredCourts.length} of {courts.length} courts
          </span>
        </div>

        <div className="court-filters">
          <div className="court-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="Search court number..."
              aria-label="Search courts"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="availability-filter">Availability</label>
            <select
              id="availability-filter"
              value={availability}
              onChange={(event) =>
                setAvailability(event.target.value as AvailabilityFilter)
              }
            >
              <option value="All">All courts</option>
              <option value="Available">Available</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="type-filter">Court type</label>
            <select
              id="type-filter"
              value={courtType}
              onChange={(event) =>
                setCourtType(event.target.value as CourtTypeFilter)
              }
            >
              <option value="All">All types</option>
              <option value="Indoor">Indoor</option>
              <option value="Outdoor">Outdoor</option>
            </select>
          </div>
        </div>

        {cartNotice && (
          <div className="court-cart-notice" role="status">
            {cartNotice}
            <Link href="/cart">View cart</Link>
            <button
              type="button"
              onClick={() => setCartNotice("")}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        )}

        {error && <p className="court-cart-notice" role="alert">{error}</p>}
        {loading && <p role="status">Loading courts...</p>}

        <div className="courts-grid">
          {filteredCourts.map((court) => (
            <article className="court-card" key={court.id}>
              <div className="court-card-image">
                <img src={court.image} alt={`${court.name} pickleball court`} />

                <span
                  className={`court-status ${
                    court.status === "Available"
                      ? "status-available"
                      : "status-maintenance"
                  }`}
                >
                  <span />
                  {court.status}
                </span>

                <span className="court-number">
                  {court.name.match(/\d+/)?.[0]?.padStart(2, "0") ?? court.name}
                </span>
              </div>

              <div className="court-card-content">
                <div className="court-card-topline">
                  <span className="court-type">{court.courtType}</span>
                  <span className="court-location">⌖ GenSan</span>
                </div>

                <h3>{court.name}</h3>
                <p>{court.description}</p>

                <div className="court-card-bottom">
                  <div className="court-price">
                    <strong>₱{court.price}</strong>
                    <span>/ hour</span>
                  </div>

                  {court.status === "Available" ? (
                    <button
                      type="button"
                      className="court-book-button"
                      onClick={() => {
                        setCartError("");
                        setBookingDate("");
                        setBookingStartTime("");
                        setBookingDuration(1);
                        const today = new Date();
                        setMinimumBookingDate(
                          new Date(
                            today.getTime() - today.getTimezoneOffset() * 60_000
                          )
                            .toISOString()
                            .slice(0, 10)
                        );
                        setSelectedCourt(court);
                      }}
                    >
                      Add to Cart <span>＋</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="court-book-button disabled-book-button"
                      disabled
                    >
                      Unavailable
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        {!loading && !error && filteredCourts.length === 0 && (
          <div className="courts-empty">
            <span>⌕</span>
            <h3>No courts found</h3>
            <p>Try changing your search or filters.</p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setAvailability("All");
                setCourtType("All");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>

      <section className="courts-cta">
        <div>
          <span className="section-eyebrow">READY TO PLAY?</span>
          <h2>Your next match is one booking away.</h2>
          <p>
            Create your PCKL+ account to book courts and manage your membership
            in one place.
          </p>
        </div>

        <Link href="/register" className="courts-cta-button">
          Join PCKL+ <span>↗</span>
        </Link>
      </section>

      <footer className="courts-footer">
        <Link href="/" className="courts-logo footer-logo">
          PCKL<span>+</span>
        </Link>

        <p>Made for the love of the game.</p>

        <CurrentYear />
      </footer>

      {selectedCourt && (
        <div
          className="court-booking-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedCourt(null);
              setCartError("");
            }
          }}
        >
          <section
            className="court-booking-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="court-booking-title"
          >
            <button
              type="button"
              className="court-booking-close"
              onClick={() => {
                setSelectedCourt(null);
                setCartError("");
              }}
              aria-label="Close reservation details"
            >
              ×
            </button>
            <span className="section-eyebrow">COURT RESERVATION</span>
            <h2 id="court-booking-title">{selectedCourt.name}</h2>
            <p>₱{selectedCourt.price} per hour · {selectedCourt.courtType}</p>

            <label htmlFor="booking-date">Reservation date</label>
            <input
              id="booking-date"
              type="date"
              min={minimumBookingDate}
              value={bookingDate}
              onChange={(event) => setBookingDate(event.target.value)}
              required
            />

            <label htmlFor="booking-start-time">Start time</label>
            <input
              id="booking-start-time"
              type="time"
              value={bookingStartTime}
              onChange={(event) => setBookingStartTime(event.target.value)}
              required
            />

            <label htmlFor="booking-duration">Duration</label>
            <select
              id="booking-duration"
              value={bookingDuration}
              onChange={(event) =>
                setBookingDuration(Number(event.target.value))
              }
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((hours) => (
                <option key={hours} value={hours}>
                  {hours} {hours === 1 ? "hour" : "hours"}
                </option>
              ))}
            </select>

            {cartError && (
              <p className="court-booking-error" role="alert">
                {cartError}
              </p>
            )}

            <button
              type="button"
              className="court-booking-submit"
              onClick={addCourtToCart}
            >
              Add reservation · ₱
              {(selectedCourt.price * bookingDuration).toLocaleString("en-PH")}
            </button>
          </section>
        </div>
      )}
    </main>
  );
}