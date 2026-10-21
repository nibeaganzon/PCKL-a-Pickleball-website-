"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CurrentYear from "../current-year";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      if (!data.user) {
        throw new Error("Login failed. Please try again.");
      }

      // Check if user is an admin
      const { data: admin } = await supabase
        .from("admin_members")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (admin) {
        router.push("/admin");
      } else {
        const searchParams = new URLSearchParams(window.location.search);
        const returnUrl = searchParams.get("returnUrl") || "/";
        router.push(returnUrl);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to sign in. Please try again."
      );
    }
  }

  return (
    <main className="login-page">
      <section className="login-visual">
        <Link href="/" className="login-brand" aria-label="PCKL+ home">
          PCKL<span>+</span>
        </Link>

        <div className="visual-content">
          <span className="visual-eyebrow">
            <span className="visual-dot" />
            YOUR GAME STARTS HERE
          </span>

          <h1>
            Get back
            <br />
            <span>in the game.</span>
          </h1>

          <p>
            Your courts, your membership, your next match.
            Everything you need to play more, all in one place.
          </p>

          <div className="visual-stats">
            <div>
              <strong>20</strong>
              <span>Pickleball courts</span>
            </div>
            <div className="visual-stat-divider" />
            <div>
              <strong>1</strong>
              <span>Convenient location</span>
            </div>
          </div>
        </div>

        <div className="visual-footer">
          <span>GENERAL SANTOS CITY, PH</span>
          <span>PLAY MORE. PLAN LESS.</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-panel-top">
          <Link href="/" className="mobile-brand" aria-label="PCKL+ home">
            PCKL<span>+</span>
          </Link>

          <p>
            New to PCKL+?{" "}
            <Link href="/register" className="register-link">
              Create account
            </Link>
          </p>
        </div>

        <div className="login-form-container">
          <div className="login-heading">
            <div className="login-icon" aria-hidden="true">
              ↗
            </div>

            <span className="form-eyebrow">WELCOME BACK</span>
            <h2>Let&apos;s play.</h2>
            <p>
              Log in to manage your bookings and get ready for your next game.
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="email">Email address</label>

              <div className="login-input-wrap">
                <span className="input-icon" aria-hidden="true">
                  ✉
                </span>

                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="pcklganzon@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <div className="password-label-row">
                <label htmlFor="password">Password</label>

                <Link href="/forgot-password" className="forgot-link">
                  Forgot password?
                </Link>
              </div>

              <div className="login-input-wrap">
                <span className="input-icon" aria-hidden="true">
                  ◈
                </span>

                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <label className="remember-option">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span className="custom-checkbox" />
              <span>Remember me</span>
            </label>

            <button type="submit" className="login-submit">
              Log in to PCKL+ <span aria-hidden="true">→</span>
            </button>

            {message && (
              <p className="login-message" role="status">
                {message}
              </p>
            )}
          </form>

          <div className="login-divider">
            <span />
            <p>YOUR GAME, YOUR WAY</p>
            <span />
          </div>

          <div className="login-bottom">
            <p>
              Don&apos;t have an account?{" "}
              <Link href="/register" className="register-link">
                Join PCKL+
              </Link>
            </p>
          </div>
        </div>

        <footer className="login-legal">
          <CurrentYear />
          <span>Made for the love of the game.</span>
        </footer>
      </section>
    </main>
  );
}