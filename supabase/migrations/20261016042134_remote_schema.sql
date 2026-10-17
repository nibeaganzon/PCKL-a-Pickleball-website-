ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "service_role";

CREATE TABLE "public"."court_reservations" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "transaction_id" uuid                     NOT NULL,
  "court_id"       uuid                     NOT NULL,
  "start_date"     timestamp with time zone NOT NULL,
  "end_date"       timestamp with time zone NOT NULL,
  "amount"         real                     NOT NULL DEFAULT '0'::real,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "courtReservations_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."court_reservations"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."courts" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "name"        text                     NOT NULL,
  "description" text,
  "price"       real                     NOT NULL,
  "images"      text[],
  CONSTRAINT "Court_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."courts"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."equipment_rentals" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "transaction_id" uuid                     NOT NULL,
  "equipment_id"   uuid                     NOT NULL,
  "start_date"     timestamp with time zone NOT NULL,
  "end_date"       timestamp with time zone NOT NULL,
  CONSTRAINT "equipmentRentals_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."equipment_rentals"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."equipments" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "name"        text                     NOT NULL,
  "quantity"    bigint                   NOT NULL DEFAULT '0'::bigint,
  "description" text,
  "images"      text[],
  "price"       real                     NOT NULL DEFAULT '0'::real,
  CONSTRAINT "Equipment_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."equipments"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."membershipCards" (
  "id"        uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "issued_at" timestamp with time zone NOT NULL DEFAULT now(),
  "user_id"   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "balance"   real                     NOT NULL DEFAULT '0'::real,
  CONSTRAINT "membershipCards_pkey" PRIMARY KEY (id),
  CONSTRAINT "membershipCards_user_id_key" UNIQUE (user_id)
);

ALTER TABLE "public"."membershipCards"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."topups" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "topup_date"      timestamp with time zone NOT NULL DEFAULT now(),
  "amount"          real                     NOT NULL DEFAULT '0'::real,
  "processed_by_id" uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "card_id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  CONSTRAINT "topups_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."topups"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."transactions" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "transaction_date" timestamp with time zone NOT NULL DEFAULT now(),
  "total_amount"     real                     NOT NULL DEFAULT '0'::real,
  "card_id"          uuid                     NOT NULL,
  CONSTRAINT "transactions_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."transactions"
  ENABLE ROW LEVEL SECURITY;

CREATE TYPE "public"."membershipStatus" AS ENUM (
  'Active',
  'Revoked',
  'Inactive'
);

ALTER TABLE "public"."membershipCards"
  ADD COLUMN "status" public."membershipStatus" NOT NULL DEFAULT 'Active'::public."membershipStatus";

CREATE TYPE "public"."paymentType" AS ENUM (
  'Cash',
  'Online'
);

ALTER TABLE "public"."topups"
  ADD COLUMN "paymentMethod" public."paymentType" NOT NULL DEFAULT 'Online'::public."paymentType";

CREATE TYPE "public"."reservationStatus" AS ENUM (
  'Active',
  'Cancelled',
  'Done'
);

ALTER TABLE "public"."court_reservations"
  ADD COLUMN "status" public."reservationStatus" NOT NULL DEFAULT 'Active'::public."reservationStatus";

ALTER TABLE "public"."equipment_rentals"
  ADD COLUMN "status" public."reservationStatus" NOT NULL DEFAULT 'Active'::public."reservationStatus";

CREATE TYPE "public"."transactionType" AS ENUM (
  'Checkout',
  'Refund'
);

ALTER TABLE "public"."transactions"
  ADD COLUMN "transactionType" public."transactionType" NOT NULL DEFAULT 'Checkout'::public."transactionType";

ALTER TABLE "public"."court_reservations"
  ADD CONSTRAINT "court_reservations_court_id_fkey" FOREIGN KEY (court_id) REFERENCES public.courts(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE "public"."equipment_rentals"
  ADD CONSTRAINT "equipment_rentals_equipment_id_fkey" FOREIGN KEY (equipment_id) REFERENCES public.equipments(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE "public"."membershipCards"
  ADD CONSTRAINT "membershipCards_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."topups"
  ADD CONSTRAINT "topups_card_id_fkey" FOREIGN KEY (card_id) REFERENCES public."membershipCards"(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE "public"."topups"
  ADD CONSTRAINT "topups_processed_by_id_fkey" FOREIGN KEY (processed_by_id) REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_card_id_fkey" FOREIGN KEY (card_id) REFERENCES public."membershipCards"(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE "public"."court_reservations"
  ADD CONSTRAINT "court_reservations_transaction_id_fkey" FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE "public"."equipment_rentals"
  ADD CONSTRAINT "equipment_rentals_transaction_id_fkey" FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

CREATE POLICY "Enable read access for all users" ON "public"."courts"
  FOR SELECT
  TO PUBLIC
  USING (true);

REVOKE ALL ON TABLE "public"."court_reservations" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."court_reservations" TO "anon";

REVOKE ALL ON TABLE "public"."court_reservations" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."court_reservations" TO "authenticated";

REVOKE ALL ON TABLE "public"."court_reservations" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."court_reservations" TO "postgres";

REVOKE ALL ON TABLE "public"."court_reservations" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."court_reservations" TO "service_role";

REVOKE ALL ON TABLE "public"."courts" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."courts" TO "anon";

REVOKE ALL ON TABLE "public"."courts" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."courts" TO "authenticated";

REVOKE ALL ON TABLE "public"."courts" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."courts" TO "postgres";

REVOKE ALL ON TABLE "public"."courts" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."courts" TO "service_role";

REVOKE ALL ON TABLE "public"."equipment_rentals" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."equipment_rentals" TO "anon";

REVOKE ALL ON TABLE "public"."equipment_rentals" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."equipment_rentals" TO "authenticated";

REVOKE ALL ON TABLE "public"."equipment_rentals" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."equipment_rentals" TO "postgres";

REVOKE ALL ON TABLE "public"."equipment_rentals" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."equipment_rentals" TO "service_role";

REVOKE ALL ON TABLE "public"."equipments" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."equipments" TO "anon";

REVOKE ALL ON TABLE "public"."equipments" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."equipments" TO "authenticated";

REVOKE ALL ON TABLE "public"."equipments" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."equipments" TO "postgres";

REVOKE ALL ON TABLE "public"."equipments" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."equipments" TO "service_role";

REVOKE ALL ON TABLE "public"."membershipCards" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."membershipCards" TO "anon";

REVOKE ALL ON TABLE "public"."membershipCards" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."membershipCards" TO "authenticated";

REVOKE ALL ON TABLE "public"."membershipCards" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."membershipCards" TO "postgres";

REVOKE ALL ON TABLE "public"."membershipCards" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."membershipCards" TO "service_role";

REVOKE ALL ON TABLE "public"."topups" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."topups" TO "anon";

REVOKE ALL ON TABLE "public"."topups" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."topups" TO "authenticated";

REVOKE ALL ON TABLE "public"."topups" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."topups" TO "postgres";

REVOKE ALL ON TABLE "public"."topups" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."topups" TO "service_role";

REVOKE ALL ON TABLE "public"."transactions" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."transactions" TO "anon";

REVOKE ALL ON TABLE "public"."transactions" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."transactions" TO "authenticated";

REVOKE ALL ON TABLE "public"."transactions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."transactions" TO "postgres";

REVOKE ALL ON TABLE "public"."transactions" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."transactions" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "service_role";

