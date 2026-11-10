---
status: superseded by ADR-0005
---

# Pending Booking Hold with Atomic Approval and Automated Refund

> [!WARNING]
> Superseded by ADR-0005. Court reservations and equipment rentals are now confirmed immediately upon membership card checkout without administrator review.

Court reservations and equipment rentals are submitted at checkout as pending bookings requiring administrator approval.
We decided that pending bookings immediately place a reservation hold on court slots using PostgreSQL exclusion constraints, and deduct the membership card balance up front.
When an administrator approves a booking, both court and equipment records transition to active status; if rejected, the hold is released and the deducted amount is automatically refunded to the card.
