---
status: superseded by ADR-0004
---

# Automatic Top-Up with Simulated Proof Upload

> [!WARNING]
> Superseded by ADR-0004. Top-ups now require administrator review in the admin payment queue before funds are credited.

In this project, users need to top up their membership card balance without actual payment processor integration.
We decided to keep the receipt upload input on the frontend for visual feedback, but process the top-up immediately and automatically in the database without administrative intervention.
This preserves the realistic user experience of submitting proof while eliminating administrative overhead for a demo environment.
