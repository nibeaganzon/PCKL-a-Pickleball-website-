import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "./supabase/client";

export type MembershipCardSummary = {
  id: string;
  card_number: string;
  balance: number;
  status: string;
};

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
