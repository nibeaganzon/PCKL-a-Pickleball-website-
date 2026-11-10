# PCKL+

Facility booking, equipment rental, and membership management system for the PCKL pickleball facility in General Santos City.

## Local development

```bash
npm install
npm run dev
```

Create a `.env.local` file in the project root with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.
Never expose it to the browser or prefix it with `NEXT_PUBLIC_`.

## Database setup

Apply migrations using the Supabase CLI:

```bash
npx supabase db reset
```

Or apply the migration scripts sequentially from `supabase/migrations/`.
These migrations set up:

- Core tables (`courts`, `equipments`, `membership_cards`, `transactions`, `court_reservations`, `equipment_rentals`, `topups`, `admin_members`).
- Row Level Security (RLS) policies for user data access and public catalog browsing.
- Storage buckets (`payment-proofs` for receipts and `inventory` for equipment and court photos).
- Exclusion constraints on court reservations using `btree_gist` to prevent overlapping bookings.
- Seed data for 20 courts and initial rental equipment.
- An authentication trigger (`on_auth_user_created`) that provisions an active membership card when a user registers.

## Administrator setup

1. Create a user account through the registration page or in the Supabase Authentication dashboard.
2. Register the user ID in `public.admin_members` using SQL:

   ```sql
   insert into public.admin_members (user_id)
   values ('YOUR_USER_UUID')
   on conflict (user_id) do nothing;
   ```

3. Sign in at `/login`.
   Admin accounts can access the management dashboard at `/admin`.

## System workflows

### Membership cards

Every registered user receives a stored-value membership card identified by a human-readable 16-character code (`PICKL-...`).
The database trigger automatically provisions the card on sign-up with an initial zero balance.
A partial unique database index enforces that each user holds at most one active membership card while retaining historical card records.

### Top-up review queue

Members top up their membership card by scanning the facility payment QR code and submitting receipt proof at `/membership/top-up`.
Submissions enter a `Pending` state and do not credit card balances immediately.
Administrators review payment receipts in the admin portal (`/admin#payments`).
When an admin confirms the payment, the `review_topup` stored procedure credits the card balance and marks the top-up as confirmed.
If rejected, the top-up is marked as rejected without modifying the card balance.

### Court bookings and equipment rentals

Customers browse court availability and rental gear, then add items to their unified browser cart.
Payment is made exclusively through an active membership card at `/payment`.
During checkout, the `charge_membership_card` stored procedure executes an atomic database transaction that:

- Validates cart items against current inventory pricing and availability.
- Verifies that the card balance is sufficient and deducts the total amount.
- Records a confirmed checkout transaction.
- Creates active court reservations protected by PostgreSQL range exclusion constraints against double-booking.
- Creates active equipment rentals.

Because payment is deducted from pre-funded membership cards, bookings confirm immediately without requiring administrator review.
Customers are redirected directly to their order confirmation.

### Inventory management

Administrators manage courts and rental gear through the dashboard inventory panel (`/admin#inventory`).
Admins can create items, update pricing and descriptions, toggle active court status, and upload photos to the `inventory` storage bucket.
Customer-facing catalog pages fetch current inventory and availability directly from the database.
