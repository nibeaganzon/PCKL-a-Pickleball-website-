"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMembershipBalance } from "@/lib/use-membership-balance";

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function MembershipTopUpPage() {
  const router = useRouter();
  const [cardId, setCardId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { balance, error: balanceError, loading: balanceLoading } =
    useMembershipBalance(cardId);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  function handleProofChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please upload a JPG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("The payment proof must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setProof(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (balance === null) {
      setError("Enter a valid membership card ID before submitting.");
      return;
    }
    if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
      setError("Enter a top-up amount greater than zero, with up to two decimal places.");
      return;
    }
    if (reference.trim().length < 3) {
      setError("Enter the payment reference number from your receipt.");
      return;
    }
    if (!proof) {
      setError("Upload your payment receipt before submitting.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("cardId", cardId.trim());
      formData.append("amount", amount);
      formData.append("paymentReference", reference.trim());
      formData.append("paymentProof", proof);

      const response = await fetch("/api/top-ups", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Your top-up could not be submitted.");
      }
      if (typeof result.orderReference !== "string") {
        throw new Error("Your top-up was submitted, but its reference could not be loaded.");
      }
      router.push(
        `/payment/submitted?reference=${encodeURIComponent(result.orderReference)}`
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Your top-up could not be submitted. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="payment-page">
      <header className="payment-header">
        <Link href="/" className="payment-logo">
          PCKL<span>+</span>
        </Link>
        <span className="secure-label">MEMBERSHIP TOP-UP</span>
      </header>

      <div className="payment-container">
        <div className="payment-heading">
          <p className="eyebrow">KEEP YOUR GAME GOING</p>
          <h1>Top up your membership card.</h1>
          <p>
            Choose an amount, pay using the same QR payment method, and submit
            your receipt for admin verification. Funds are added after approval.
          </p>
        </div>

        <div className="payment-grid">
          <section className="payment-panel">
            <div className="panel-heading">
              <h2>Card balance</h2>
              <span>Updates automatically</span>
            </div>
            <div className="form-field">
              <label htmlFor="topUpCardId">Membership card ID</label>
              <input
                id="topUpCardId"
                value={cardId}
                onChange={(event) => setCardId(event.target.value.toUpperCase())}
                autoComplete="off"
                maxLength={37}
                placeholder="PCKL-..."
                required
              />
              <p className="price-note">
                Keep your card ID private. It is used to identify your card.
              </p>
            </div>
            <div className="order-total">
              <span>Current balance</span>
              <strong>
                {balanceLoading && balance === null
                  ? "Checking..."
                  : balance === null
                    ? "—"
                    : formatPHP(balance)}
              </strong>
            </div>
            {balanceError && <p className="payment-error">{balanceError}</p>}
            <p className="verification-note">
              After your top-up is approved, this balance will refresh
              automatically while this page is open.
            </p>
          </section>

          <section className="payment-panel payment-method-panel">
            <div className="panel-heading">
              <h2>Top-up payment</h2>
              <span className="pending-badge">Admin review</span>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-field">
                <label htmlFor="topUpAmount">Amount to top up</label>
                <input
                  id="topUpAmount"
                  type="number"
                  min="0.01"
                  max="9999999999.99"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Enter amount in PHP"
                  required
                />
              </div>
              <div className="order-total">
                <span>Amount to pay</span>
                <strong>
                  {Number(amount) > 0 ? formatPHP(Number(amount)) : "—"}
                </strong>
              </div>
              <div className="qr-payment">
                <div className="qr-placeholder">
                  <img
                    src="/images/pckl-payment-qr.png"
                    alt="PCKL+ payment QR code"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                      const fallback =
                        event.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = "flex";
                    }}
                  />
                  <div className="qr-fallback">
                    <span>QR</span>
                    <small>Add your payment QR image</small>
                  </div>
                </div>
                <h3>Scan to pay</h3>
                <p>
                  Pay the exact amount shown above using the official PCKL+ QR
                  code.
                </p>
              </div>
              <div className="form-field">
                <label htmlFor="topUpReference">Payment reference number</label>
                <input
                  id="topUpReference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  maxLength={100}
                  placeholder="Enter the reference from your receipt"
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="topUpProof">Upload payment receipt</label>
                <label className="upload-area" htmlFor="topUpProof">
                  {preview ? (
                    <img
                      src={preview}
                      alt="Preview of uploaded top-up receipt"
                      className="receipt-preview"
                    />
                  ) : (
                    <>
                      <span className="upload-icon">↑</span>
                      <strong>Choose receipt image</strong>
                      <span>JPG or PNG · Maximum 5 MB</span>
                    </>
                  )}
                </label>
                <input
                  id="topUpProof"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleProofChange}
                  className="file-input"
                />
                {proof && <p className="selected-file">{proof.name}</p>}
              </div>
              {error && <p className="payment-error" role="alert">{error}</p>}
              <button
                className="primary-button submit-payment"
                type="submit"
                disabled={loading || balance === null}
              >
                {loading ? "Submitting..." : "Submit top-up for verification"}
              </button>
            </form>
            <p className="verification-note">
              Your card is credited only after an authorized admin confirms
              this payment.
            </p>
          </section>
        </div>

        <div className="payment-confirmation-footer">
          <Link href="/payment" className="payment-status-home">
            Pay for a booking or rental
          </Link>
          <Link href="/" className="payment-status-home">
            Return home
          </Link>
        </div>
      </div>
    </main>
  );
}
