# PCKL+ backend test cases

This document specifies the 10 backend flow test cases implemented in `__tests__/court-booking-flow.test.ts` and `__tests__/account-creation-flow.test.ts`.

## Flow 1: Court booking test cases

### TC_BOOKING_001

| Field | Details |
| :--- | :--- |
| **Test Case ID** | `TC_BOOKING_001` |
| **Title** | Verify successful court reservation flow from availability check to confirmation |
| **Priority** | High |
| **Preconditions** | `Court 01` has status `Available` at `300`/hr, and the Member has an `Active Card` with a balance of `2000`. |
| **Test Steps** | 1. Request court inventory via `GET /api/inventory` and select an available court.<br>2. Submit the selected court, date, start time, duration, and `Card Number` to `POST /api/checkout`.<br>3. Query the returned `orderReference` via `GET /api/payments/[orderReference]`. |
| **Test Data** | Card Number: `PICKL-ABCD1234EFGH5678`<br>Court: `Court 01`<br>Date: `2027-05-15`<br>Start Time: `10:00`<br>Duration: `2` hours |
| **Expected Result** | `POST /api/checkout` returns HTTP `201` with `orderReference` matching `PAY-...` and `balanceAfter: 1400`. `GET /api/payments/[orderReference]` returns HTTP `200` with `status: "confirmed"`, `amount: 600`, and the `Court 01` reservation from `10:00` to `12:00`. |

---

### TC_BOOKING_002

| Field | Details |
| :--- | :--- |
| **Test Case ID** | `TC_BOOKING_002` |
| **Title** | Verify court reservation fails when the selected court is under maintenance |
| **Priority** | High |
| **Preconditions** | `Court 02` has `is_active: false`, mapped to status `Maintenance`, and the Member has a valid `Active Card`. |
| **Test Steps** | 1. Request `GET /api/inventory` and observe `Court 02` has status `Maintenance`.<br>2. Submit a checkout request for `Court 02` to `POST /api/checkout`. |
| **Test Data** | Card Number: `PICKL-ABCD1234EFGH5678`<br>Court: `Court 02`<br>Date: `2027-05-15`<br>Start Time: `14:00`<br>Duration: `1` hour |
| **Expected Result** | `POST /api/checkout` returns HTTP `409` with message `"Court 02 is not available to book."` and creates no court reservation. |

---

### TC_BOOKING_003

| Field | Details |
| :--- | :--- |
| **Test Case ID** | `TC_BOOKING_003` |
| **Title** | Verify court reservation fails when the selected time slot overlaps an existing reservation |
| **Priority** | High |
| **Preconditions** | `Court 01` already has an active `Court Reservation` on `2027-05-20` from `10:00` to `12:00`. |
| **Test Steps** | 1. Submit a first booking for `Court 01` on `2027-05-20` from `10:00` to `12:00` via `POST /api/checkout`.<br>2. Submit a second booking for `Court 01` on `2027-05-20` from `11:00` to `13:00` via `POST /api/checkout`. |
| **Test Data** | Card Number: `PICKL-ABCD1234EFGH5678`<br>Court: `Court 01`<br>Date: `2027-05-20`<br>Overlapping Start Time: `11:00`<br>Duration: `2` hours |
| **Expected Result** | The second `POST /api/checkout` request returns HTTP `409` with message `"One or more selected court times are no longer available. Please choose a different slot."` and does not deduct the card balance a second time. |

---

### TC_BOOKING_004

| Field | Details |
| :--- | :--- |
| **Test Case ID** | `TC_BOOKING_004` |
| **Title** | Verify court reservation fails when the active membership card has insufficient balance |
| **Priority** | High |
| **Preconditions** | `Court 01` costs `300`/hr, and the Member's `Active Card` has a balance of `100`. |
| **Test Steps** | 1. Submit a 1-hour checkout request for `Court 01` to `POST /api/checkout` using the low-balance card. |
| **Test Data** | Card Number: `PICKL-LOWBAL0000000001`<br>Card Balance: `100`<br>Court: `Court 01`<br>Date: `2027-05-21`<br>Start Time: `09:00`<br>Duration: `1` hour |
| **Expected Result** | `POST /api/checkout` returns HTTP `409` with message `"Your membership card does not have enough balance."` and creates no court reservation. |

---

### TC_BOOKING_005

| Field | Details |
| :--- | :--- |
| **Test Case ID** | `TC_BOOKING_005` |
| **Title** | Verify court reservation fails for a past booking date or an invalid card number |
| **Priority** | Medium |
| **Preconditions** | `Court 01` is `Available`. |
| **Test Steps** | 1. Submit a checkout request to `POST /api/checkout` with a reservation date in the past.<br>2. Submit a checkout request to `POST /api/checkout` with a future date but a malformed `cardId`. |
| **Test Data** | Past Date: `2020-01-01`, Start Time: `09:00`, Card Number: `PICKL-ABCD1234EFGH5678`<br>Future Date: `2027-05-25`, Start Time: `09:00`, Invalid Card Number: `INVALID-CARD` |
| **Expected Result** | Both requests are rejected with HTTP `400`. The invalid card request returns message `"Enter a valid membership card ID."`. |

---

## Flow 2: Account creation test cases

### TC_ACCOUNT_001

| Field | Details |
| :--- | :--- |
| **Test Case ID** | `TC_ACCOUNT_001` |
| **Title** | Verify successful member registration, active card provisioning, and sign-in |
| **Priority** | High |
| **Preconditions** | Email `alex.rivera@pckl.test` is not registered in the system. |
| **Test Steps** | 1. Call `registerMember` with a valid cardholder name, email, and password.<br>2. Call `signInMember` with the registered email and password.<br>3. Request the user's card via `GET /api/membership-cards`. |
| **Test Data** | Name: `Alex Rivera`<br>Email: `alex.rivera@pckl.test`<br>Password: `securePassword123` |
| **Expected Result** | `registerMember` returns a newly generated `cardNumber` matching `PICKL-...`. `signInMember` authenticates `alex.rivera@pckl.test` with `isAdmin: false`, and `GET /api/membership-cards` returns HTTP `200` with `status: "Active"` and `balance: 0`. |

---

### TC_ACCOUNT_002

| Field | Details |
| :--- | :--- |
| **Test Case ID** | `TC_ACCOUNT_002` |
| **Title** | Verify account creation fails when registering with an already registered email |
| **Priority** | High |
| **Preconditions** | Email `existing.member@pckl.test` already belongs to an existing Member account. |
| **Test Steps** | 1. Call `registerMember` using the existing email address `existing.member@pckl.test`. |
| **Test Data** | Name: `Duplicate User`<br>Email: `existing.member@pckl.test`<br>Password: `password123` |
| **Expected Result** | Registration fails and throws `"User already registered"` without issuing a second membership card. |

---

### TC_ACCOUNT_003

| Field | Details |
| :--- | :--- |
| **Test Case ID** | `TC_ACCOUNT_003` |
| **Title** | Verify account creation fails when given a short password, invalid email, or blank name |
| **Priority** | Medium |
| **Preconditions** | None. |
| **Test Steps** | 1. Call `registerMember` with a password under 6 characters.<br>2. Call `registerMember` with a malformed email address.<br>3. Call `registerMember` with a blank cardholder name. |
| **Test Data** | Short Password: `123`<br>Invalid Email: `not-an-email`<br>Blank Name: `" "` |
| **Expected Result** | Each call throws its validation error before calling Supabase Auth: `"Password must be at least 6 characters."`, `"Enter a valid email address."`, and `"Cardholder name must be between 2 and 100 characters."`. |

---

### TC_ACCOUNT_004

| Field | Details |
| :--- | :--- |
| **Test Case ID** | `TC_ACCOUNT_004` |
| **Title** | Verify sign-in fails with an incorrect password or an unregistered email |
| **Priority** | High |
| **Preconditions** | Account `existing.member@pckl.test` exists with password `password123`. |
| **Test Steps** | 1. Call `signInMember` with `existing.member@pckl.test` and an incorrect password.<br>2. Call `signInMember` with an unregistered email address `unknown.user@pckl.test`. |
| **Test Data** | Email 1: `existing.member@pckl.test`, Password 1: `wrong-password`<br>Email 2: `unknown.user@pckl.test`, Password 2: `password123` |
| **Expected Result** | Both sign-in attempts fail and throw `"Invalid login credentials"`. |

---

### TC_ACCOUNT_005

| Field | Details |
| :--- | :--- |
| **Test Case ID** | `TC_ACCOUNT_005` |
| **Title** | Verify registration surfaces an error if the active membership card is not provisioned |
| **Priority** | Medium |
| **Preconditions** | Automatic card provisioning on signup is disabled or fails, so `GET /api/membership-cards` returns `404`. |
| **Test Steps** | 1. Call `registerMember` with valid credentials while card provisioning is disabled.<br>2. Allow the card lookup retries against `GET /api/membership-cards?userId=...` to complete. |
| **Test Data** | Name: `No Card Member`<br>Email: `nocard@pckl.test`<br>Password: `password123` |
| **Expected Result** | `registerMember` throws `"Your account was created, but your membership card number could not be loaded. Please log in to view your card."`. |
