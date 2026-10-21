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

**Top-Up**:
An immediate credit of funds to a user's own active membership card, requiring a receipt upload on the client for user feedback while processing automatically in the database.
_Avoid_: Deposit, reload, payment submission, peer transfer

**Pending Booking**:
A court reservation or equipment rental order submitted by a customer at checkout that immediately holds the court slot and awaits administrator approval.
_Avoid_: Unconfirmed order, checkout draft

**Court Reservation**:
A scheduled exclusive time slot for a specific court, transitioning from pending to active upon approval, or refunded upon cancellation.
_Avoid_: Court booking, slot hold

**Equipment Rental**:
A reserved quantity of pickleball paddles or balls for a designated duration.
_Avoid_: Gear lease, equipment checkout

**Admin Member**:
An authenticated user explicitly recorded in the admin registry authorized to approve bookings, monitor payments, and manage facility inventory.
_Avoid_: Staff, superuser, manager
