import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "./supabase/client";

export type MembershipCardSummary = {
  id: string;
  card_number: string;
  balance: number;
  status: string;
};

export async function signInMember(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Enter a valid email address.");
  }
  if (!password) {
    throw new Error("Enter your password.");
  }

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error) throw error;
  if (!data.user) {
    throw new Error("Login failed. Please try again.");
  }

  const { data: admin } = await supabase
    .from("admin_members")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  return {
    user: data.user,
    isAdmin: Boolean(admin),
  };
}

export async function registerMember(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ cardNumber: string }> {
  const trimmedName = input.name.trim();
  const normalizedEmail = input.email.trim().toLowerCase();

  if (trimmedName.length < 2 || trimmedName.length > 100) {
    throw new Error("Cardholder name must be between 2 and 100 characters.");
  }
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Enter a valid email address.");
  }
  if (!input.password || input.password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const supabase = createSupabaseBrowserClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: input.password,
    options: {
      data: {
        full_name: trimmedName,
      },
    },
  });

  if (signUpError) throw signUpError;
  if (!signUpData.user) {
    throw new Error("Unable to create account. Please try again.");
  }

  const userId = signUpData.user.id;
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(
      `/api/membership-cards?userId=${encodeURIComponent(userId)}`,
      { cache: "no-store" }
    );
    if (response.ok) {
      const result = await response.json();
      if (result.card?.card_number) {
        return { cardNumber: result.card.card_number };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error(
    "Your account was created, but your membership card number could not be loaded. Please log in to view your card."
  );
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [card, setCard] = useState<MembershipCardSummary | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function loadSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          // Check admin status
          const { data: adminMember, error: adminError } = await supabase
            .from("admin_members")
            .select("user_id")
            .eq("user_id", currentUser.id)
            .maybeSingle();

          if (adminError) {
            console.error("Failed to check admin status:", adminError);
          }
          setIsAdmin(Boolean(adminMember));

          // Load latest active card
          const { data: activeCard, error: cardError } = await supabase
            .from("membership_cards")
            .select("id, card_number, balance, status")
            .eq("user_id", currentUser.id)
            .eq("status", "Active")
            .order("issued_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (cardError) {
            console.error("Failed to load active card:", cardError);
          }

          if (activeCard) {
            setCard({
              id: activeCard.id,
              card_number: activeCard.card_number || activeCard.id,
              balance: Number(activeCard.balance ?? 0),
              status: activeCard.status,
            });
          } else {
            setCard(null);
          }
        } else {
          setIsAdmin(false);
          setCard(null);
        }
      } catch (err) {
        console.error("Failed to load auth session:", err);
      } finally {
        setLoading(false);
      }
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadSession();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
    setCard(null);
    setIsAdmin(false);
  }

  return {
    user,
    card,
    isAdmin,
    loading,
    signOut,
  };
}
