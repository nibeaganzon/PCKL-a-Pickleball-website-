# PCKL Facility and Booking Management

Pickleball court booking, equipment rental, and membership management system for the PCKL facility in General Santos City.

## Language

**Membership Card**:
A digital stored-value card automatically issued to every registered user with a 16-character identifier, used exclusively by its owner to pay for court bookings and equipment rentals.
_Avoid_: Wallet, payment profile, credit account

**Card Number**:
A human-readable identifier prefixed with PCKL followed by 16 alphanumeric characters.
_Avoid_: Card ID, account number

**Active Card**:
The latest active membership card assigned to a user, enforced by a partial unique database index.
_Avoid_: Primary card, current wallet

**Pending Top-Up**:
A submitted request to credit funds to an active membership card accompanied by payment proof, awaiting administrator review and approval.
_Avoid_: Unverified top-up, pending deposit, top-up draft

**Top-Up**:
A credit of funds applied to an active membership card once an administrator reviews and approves the submitted payment proof.
_Avoid_: Deposit, reload, payment submission, peer transfer

**Checkout Transaction**:
An immediate purchase settled with an active membership card that records court reservations and equipment rentals.
_Avoid_: Pending booking, unconfirmed order, checkout draft

**Court Reservation**:
A scheduled exclusive time slot for a specific court that becomes active immediately upon checkout, or refunded upon cancellation.
_Avoid_: Court booking, slot hold, pending reservation

**Equipment Rental**:
A reserved quantity of pickleball paddles or balls for a designated duration that becomes active immediately upon checkout.
_Avoid_: Gear lease, equipment checkout

**Admin Member**:
An authenticated user explicitly recorded in the admin registry authorized to review top-up requests, monitor booking history, and manage facility inventory.
_Avoid_: Staff, superuser, manager
