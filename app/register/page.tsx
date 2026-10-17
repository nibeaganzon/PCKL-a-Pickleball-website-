"use client";

import { useState } from "react";
import Link from "next/link";
import CurrentYear from "../current-year";

export default function RegisterPage() {
  const [cardholderName, setCardholderName] = useState("");
  const [email, setEmail] = useState("");
  const [membershipCardId, setMembershipCardId] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [registrationError, setRegistrationError] = useState("");
  const [registering, setRegistering] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRegistrationError("");

    setRegistering(true);
    try {
      const response = await fetch("/api/membership-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cardholderName.trim(), email: email.trim() }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Your membership card could not be created.");
      }
      setMembershipCardId(result.cardId);
    } catch (error) {
      setRegistrationError(
        error instanceof Error
          ? error.message
          : "Your membership card could not be created. Please try again."
      );
    } finally {
      setRegistering(false);
    }
  }

  async function copyMembershipCardId() {
    try {
      await navigator.clipboard.writeText(membershipCardId);
      setCopyMessage("Membership card ID copied!");
    } catch {
      setCopyMessage(
        "Copy unavailable. Please select and copy the ID manually."
      );
    }
  }

  if (membershipCardId) {
    return (
      <main className="register-page">
        <section className="register-visual">
          <Link href="/" className="register-brand">
            PCKL<span>+</span>
          </Link>

          <div className="register-visual-content">
            <span className="register-eyebrow">
              <span className="register-dot" />
              WELCOME TO THE COURT
            </span>

            <h1>
              Your game.
              <br />
              <span>Your community.</span>
            </h1>

            <p>
              Book your next match, rent your equipment, and make every visit
              count with PCKL+.
            </p>

            <div className="register-visual-stat">
              <strong>20</strong>
              <span>Pickleball courts in General Santos City</span>
            </div>
          </div>

          <p className="register-visual-footer">
            PLAY MORE. PLAN LESS.
          </p>
        </section>

        <section className="register-panel">
          <div className="register-panel-top">
            <Link href="/" className="register-mobile-brand">
              PCKL<span>+</span>
            </Link>
            <span className="success-badge">MEMBERSHIP CARD ISSUED</span>
          </div>

          <div className="register-success">
            <div className="success-icon" aria-hidden="true">
              ✓
            </div>

            <p className="register-form-eyebrow">YOU&apos;RE IN!</p>
            <h2>Welcome to PCKL+.</h2>
            <p className="success-description">
              Your membership card is ready. Save its ID to check the balance,
              top it up, and pay for court bookings or equipment rentals.
            </p>

            <div className="digital-card">
              <div className="digital-card-top">
                <span className="digital-card-logo">
                  PCKL<span>+</span>
                </span>
                <span className="digital-card-chip" aria-hidden="true">
                  ▦
                </span>
              </div>

              <div className="digital-card-middle">
                <span>MEMBERSHIP CARD ID</span>
                <strong>{membershipCardId}</strong>
              </div>

              <div className="digital-card-bottom">
                <span>YOUR GAME. YOUR RULES.</span>
                <span>GENERAL SANTOS</span>
              </div>
            </div>

            <button
              type="button"
              className="copy-card-button"
              onClick={copyMembershipCardId}
            >
              {copyMessage === "Membership card ID copied!"
                ? "✓ Copied"
                : "Copy membership card ID"}
            </button>

            {copyMessage && (
              <p className="copy-message" role="status">
                {copyMessage}
              </p>
            )}

            <div className="important-notice">
              <span className="notice-icon" aria-hidden="true">
                !
              </span>
              <div>
                <h3>Save your membership card ID</h3>
                <p>
                  Keep this ID somewhere safe. You will need it to identify
                  your membership card when topping up your balance online,
                  especially when you are not at the facility.
                </p>
              </div>
            </div>

            <div className="rfid-notice">
              <div className="rfid-icon" aria-hidden="true">
                ▦
              </div>
              <div>
                <h3>Claim your physical RFID card</h3>
                <p>
                  Your digital membership card ID is shown above. To get your
                  physical RFID membership card, visit the PCKL+ front desk
                  in person. Staff can assist you with claiming your card.
                </p>
              </div>
            </div>

            <Link href="/" className="register-submit success-home-button">
              Go to homepage <span aria-hidden="true">→</span>
            </Link>
            <Link href="/membership/top-up" className="register-login-link">
              Top up your membership card
            </Link>
          </div>

          <footer className="register-legal">
            <CurrentYear />
            <span>Made for the love of the game.</span>
          </footer>
        </section>
      </main>
    );
  }

  return (
    <main className="register-page">
      <section className="register-visual">
        <Link href="/" className="register-brand">
          PCKL<span>+</span>
        </Link>

        <div className="register-visual-content">
          <span className="register-eyebrow">
            <span className="register-dot" />
            YOUR GAME STARTS HERE
          </span>

          <h1>
            One card.
            <br />
            <span>More play.</span>
          </h1>

          <p>
            Join PCKL+ and make court reservations, equipment rentals, and
            membership card top-ups easier.
          </p>

          <div className="register-visual-stat">
            <strong>20</strong>
            <span>Courts waiting for your next match</span>
          </div>
        </div>

        <p className="register-visual-footer">
          GENERAL SANTOS CITY, PH
        </p>
      </section>

      <section className="register-panel">
        <div className="register-panel-top">
          <Link href="/" className="register-mobile-brand">
            PCKL<span>+</span>
          </Link>

          <p>Get a PCKL+ membership card</p>
        </div>

        <div className="register-form-container">
          <div className="register-heading">
            <div className="register-heading-icon" aria-hidden="true">
              +
            </div>

            <p className="register-form-eyebrow">BECOME A MEMBER</p>
            <h2>Get your membership card.</h2>
            <p>
              Create a card profile to top up your balance and pay for bookings
              and equipment rentals.
            </p>
          </div>

          <form className="register-form" onSubmit={handleSubmit}>
            <div className="register-field">
              <label htmlFor="cardholderName">Cardholder name</label>
              <input
                id="cardholderName"
                name="cardholderName"
                type="text"
                autoComplete="name"
                placeholder="Enter your name"
                minLength={2}
                maxLength={100}
                value={cardholderName}
                onChange={(event) => setCardholderName(event.target.value)}
                required
              />
            </div>

            <div className="register-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            {registrationError && (
              <p className="password-feedback password-feedback-error" role="alert">
                {registrationError}
              </p>
            )}

            <button
              type="submit"
              className="register-submit"
              disabled={registering}
            >
              {registering ? "Creating card..." : "Create membership card"}{" "}
              <span aria-hidden="true">→</span>
            </button>

            <p className="register-terms">
              By creating a card, you agree to follow PCKL+ facility and
              membership policies.
            </p>
          </form>
        </div>

        <footer className="register-legal">
          <CurrentYear />
          <span>Made for the love of the game.</span>
        </footer>
      </section>
    </main>
  );
}