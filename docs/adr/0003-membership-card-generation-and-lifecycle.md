# Membership Card Generation and Single Active Card Constraint

Every registered customer requires a dedicated membership card to book courts and rent equipment.
We decided to automatically provision a card with a human-readable 16-character code upon account registration via an auth.users database trigger with retry logic on unique violation.
We also decided to drop the table-wide unique constraint on user_id in favor of a partial unique index where status is Active, ensuring each customer possesses at most one active card while maintaining historical card records.
