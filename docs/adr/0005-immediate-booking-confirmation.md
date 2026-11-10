---
status: accepted (supersedes ADR-0002)
---

# Immediate Confirmation for Court Reservations and Equipment Rentals

Previously, court reservations and equipment rentals entered a pending state at checkout and required administrator approval.
We decided that because checkout is paid using pre-verified membership card funds, court reservations and equipment rentals are immediately active upon checkout and transactions do not track review state.
This eliminates unnecessary administrative review overhead while preserving atomic balance deduction and PostgreSQL exclusion constraints against double-booking.
