-- ---------------------------------------------------------------------
-- 1. Extensions + private schema
-- ---------------------------------------------------------------------
-- If the exclusion constraint in section 5 complains about a missing
-- gist operator class for uuid, your search_path lacks `extensions`.
create extension if not exists btree_gist with schema extensions;
 
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
 
 
-- ---------------------------------------------------------------------
-- 2. snake_case renames
-- ---------------------------------------------------------------------
alter table public."membershipCards" rename to membership_cards;
 
alter table public.topups       rename column "paymentMethod"   to payment_method;
alter table public.transactions rename column "transactionType" to transaction_type;
 
alter type public."membershipStatus"  rename to membership_status;
alter type public."paymentType"       rename to payment_type;
alter type public."reservationStatus" rename to reservation_status;
alter type public."transactionType"   rename to transaction_type;
 
-- Renaming a PK/unique constraint also renames its backing index.
alter table public.court_reservations rename constraint "courtReservations_pkey"       to court_reservations_pkey;
alter table public.courts             rename constraint "Court_pkey"                   to courts_pkey;
alter table public.equipment_rentals  rename constraint "equipmentRentals_pkey"        to equipment_rentals_pkey;
alter table public.equipments         rename constraint "Equipment_pkey"               to equipments_pkey;
alter table public.membership_cards   rename constraint "membershipCards_pkey"         to membership_cards_pkey;
alter table public.membership_cards   rename constraint "membershipCards_user_id_key"  to membership_cards_user_id_key;
alter table public.membership_cards   rename constraint "membershipCards_user_id_fkey" to membership_cards_user_id_fkey;
 
 
-- ---------------------------------------------------------------------
-- 3. Remove bogus defaults (random uuids for FK columns)
-- ---------------------------------------------------------------------
alter table public.membership_cards alter column user_id drop default;
alter table public.topups           alter column card_id drop default;
alter table public.topups           alter column processed_by_id drop default;
 
 
-- ---------------------------------------------------------------------
-- 4. Money: real -> numeric(12,2) + sanity checks
-- ---------------------------------------------------------------------
alter table public.courts
  alter column price type numeric(12,2) using round(price::numeric, 2);
 
alter table public.equipments
  alter column price type numeric(12,2) using round(price::numeric, 2);
alter table public.equipments alter column price set default 0;
 
alter table public.court_reservations
  alter column amount type numeric(12,2) using round(amount::numeric, 2);
alter table public.court_reservations alter column amount drop default;
 
alter table public.membership_cards
  alter column balance type numeric(12,2) using round(balance::numeric, 2);
alter table public.membership_cards alter column balance set default 0;
 
alter table public.topups
  alter column amount type numeric(12,2) using round(amount::numeric, 2);
alter table public.topups alter column amount drop default;
 
alter table public.transactions
  alter column total_amount type numeric(12,2) using round(total_amount::numeric, 2);
alter table public.transactions alter column total_amount set default 0;
 
alter table public.courts              add constraint courts_price_check              check (price >= 0);
alter table public.equipments          add constraint equipments_price_check          check (price >= 0);
alter table public.equipments          add constraint equipments_quantity_check       check (quantity >= 0);
alter table public.court_reservations  add constraint court_reservations_amount_check check (amount >= 0);
alter table public.membership_cards    add constraint membership_cards_balance_check  check (balance >= 0);
alter table public.topups              add constraint topups_amount_check             check (amount > 0);
alter table public.transactions        add constraint transactions_total_check        check (total_amount >= 0);
 
 
-- ---------------------------------------------------------------------
-- 5. Time checks + court double-booking constraint
-- ---------------------------------------------------------------------
alter table public.court_reservations
  add constraint court_reservations_dates_check check (end_date > start_date),
  add constraint court_reservations_no_overlap
    exclude using gist (court_id with =, tstzrange(start_date, end_date) with &&)
    where (status <> 'Cancelled');
 
alter table public.equipment_rentals
  add constraint equipment_rentals_dates_check check (end_date > start_date);
 
 
-- ---------------------------------------------------------------------
-- 6. equipment_rentals: quantity + price snapshot
-- ---------------------------------------------------------------------
alter table public.equipment_rentals
  add column quantity   integer       not null default 1,
  add column unit_price numeric(12,2) not null default 0;
 
-- Best available history: today's price (the original price is unknown).
update public.equipment_rentals er
set unit_price = e.price
from public.equipments e
where e.id = er.equipment_id;
 
alter table public.equipment_rentals
  alter column quantity   drop default,
  alter column unit_price drop default,
  add constraint equipment_rentals_quantity_check   check (quantity > 0),
  add constraint equipment_rentals_unit_price_check check (unit_price >= 0);
 