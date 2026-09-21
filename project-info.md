# Digi Mess — Delivery Partner App + Admin Dashboard + Test Order Tool

You are a senior full-stack engineer working on **Digi Mess**, a food-delivery platform connecting customers with local messes and home kitchens.

## Product scope — read carefully

Build only these parts:

1. **Delivery Partner mobile app** — React Native + Expo + TypeScript.
2. **Admin web dashboard** — for partner verification, delivery monitoring, and operations.
3. **Admin-only test order tool** — to create test deliveries with selectable pickup and drop-off locations.
4. **FastAPI backend and integration-ready APIs** — so a separate team can connect their customer ordering app later.

**Do not build a customer ordering app.**

Do not build customer-facing restaurant discovery, menus, cart, checkout, or customer signup screens. The separate customer-app team will own those.

The admin test-order tool exists only to test delivery operations. It is not a customer ordering interface.

## Required stack

* Delivery Partner app: React Native, Expo, TypeScript
* Admin dashboard: use the existing web stack; if none exists, React + TypeScript
* Backend: FastAPI, Python
* Local development database: SQLite
* ORM: SQLAlchemy
* Migrations: Alembic
* Mobile local cache, if needed: expo-sqlite
* Live tracking: authenticated WebSockets with REST snapshot/reconnect fallback
* Maps: configurable provider; keep API keys in environment/configuration

The backend database is the shared source of truth. Do not use the mobile SQLite database as the shared database.

## First step: inspect the existing repository

Before changing code:

1. Inspect the repository and identify the existing backend, mobile app, admin UI, database, authentication, order, delivery, and tracking implementations.
2. Reuse existing models, routes, components, and working flows.
3. Identify what is missing for the requested scope.
4. Make a short implementation plan.
5. Implement the actual working features and test them.

Do not replace working functionality just to create a new structure. Do not create duplicate APIs or database models without checking what already exists.

---

# A. DELIVERY PARTNER MOBILE APP

Build the complete delivery-partner lifecycle.

## Partner onboarding and access

Include:

* Login/signup using the existing authentication approach
* Partner profile
* Required document submission
* Vehicle details, if supported by the existing product
* Verification status: draft, submitted, under review, approved, rejected, needs correction
* Training/terms acknowledgement, if required
* Clear reason and next steps when documents need correction

Only approved partners may go online or accept deliveries. Enforce this in the backend, not only in the UI.

## Partner home

Show:

* Partner name and profile
* Online/offline status
* Go online/offline control
* Current active delivery, if any
* Today’s earnings and completed deliveries, using backend data
* Recent delivery history
* Clear empty state when there are no available deliveries

The online/offline control must reflect the backend-confirmed status.

## Delivery offer

When a delivery is offered, show the available information:

* Order reference
* Pickup location
* Drop-off location or area, subject to privacy rules
* Distance and estimated time, if available
* Estimated earnings, if provided by the backend
* Offer expiry/countdown, if supported
* Accept and reject actions

Handle expired offers, duplicate offers, network failures, and cases where another partner already accepted the delivery.

## Pickup and delivery flow

Implement:

1. Accept delivery
2. Navigate to pickup
3. Mark arrival at pickup
4. Show order reference and pickup instructions
5. Confirm pickup
6. Navigate to drop-off
7. Show delivery instructions
8. Contact customer only through supported backend functionality
9. Report delivery issues, such as pickup delay or customer unavailable
10. Verify delivery OTP/PIN or the existing proof-of-delivery method
11. Mark delivered only after backend confirmation
12. Show completion summary and earnings

Do not allow a mobile button to bypass backend delivery-state validation.

## Live tracking

During an active delivery:

* Request location permission with a clear explanation.
* Send location updates at a configurable interval.
* Include latitude, longitude, accuracy, timestamp, and available heading/speed.
* Handle permission denial, unavailable GPS, weak network, and reconnects.
* Stop tracking when the delivery is completed, cancelled, or no longer assigned.

The backend must verify that the authenticated partner owns the active delivery before accepting location updates. Reject stale or implausible updates and expose the last update time.

---

# B. ADMIN WEB DASHBOARD

The admin dashboard is a core part of this project—not an optional future feature.

## Admin access and roles

Include secure admin login with no public admin signup.

Use backend-enforced role permissions where appropriate, such as:

* Super Admin
* Partner Verification
* Operations
* Support

Record sensitive admin actions in an audit log, including actor, action, target, timestamp, and reason where applicable.

## Admin overview

Use real backend data to show:

* Pending partner applications
* Approved partners
* Online partners
* Active deliveries
* Unassigned test/real orders, if supported
* Delayed or issue-flagged deliveries
* Recent partner applications
* Recent delivery issues

Include loading, empty, error, and stale-data states. Do not hardcode dashboard numbers.

## Partner verification

Admins with permission can:

* View applications by status
* Review partner profile and submitted documents
* Approve
* Reject with a reason
* Request corrected/missing documents
* View verification history

Verification decisions must persist in the backend and appear in the partner app.

## Partner management

Provide search and filters for partners.

Partner details should show authorized information:

* Profile and verification status
* Online/offline status
* Current assignment, if any
* Delivery history
* Relevant performance information
* Reported issues
* Account status

Allow authorized admins to suspend/reactivate a partner with a required reason and audit record.

## Live delivery operations

Provide a map-based operations screen showing active deliveries and partner locations.

Include:

* Partner location and last update time
* Assigned order and delivery status
* Pickup/drop-off markers where authorized
* Filters by status, partner, order, and service area
* Detail panel for a selected partner/order
* Clear stale, offline, reconnecting, and unavailable states

Use the same backend tracking data as the partner/customer tracking integration. Do not create a second tracking system.

## Order and issue management

Admins should be able to:

* Search by order reference or partner
* Filter by delivery status and date
* View delivery timeline and relevant events
* Review partner-reported issues
* Add internal resolution notes
* Escalate or assign issues if supported

Any permitted correction to a delivery record must be validated and audited.

---

# C. ADMIN-ONLY TEST ORDER TOOL

This is essential for development and end-to-end testing.

Create a clearly labeled **“Create Test Delivery”** section in the admin dashboard.

It must not look like a customer checkout screen.

## Test order creation

Allow an authorized admin to create a test delivery by:

* Selecting or entering a pickup location
* Selecting or entering a drop-off location
* Optionally entering a test customer name/contact placeholder
* Optionally entering pickup instructions and delivery instructions
* Reviewing the selected locations before creating the test delivery

For location selection, support a practical option based on the configured map provider:

* Pick a point on a map, or
* Search for a location, or
* Enter latitude/longitude manually

If no map provider is configured, provide a clearly labeled manual coordinate/location fallback. Do not pretend a map is connected when it is not.

Allow test orders to be created with clearly marked test data. Do not require a real customer account or payment.

## Test mode safeguards

* Restrict test-order creation to authorized admins.
* Mark test orders unmistakably as **TEST** in the database and UI.
* Keep test orders distinguishable from real customer orders in filters and reports.
* Do not let test orders trigger real payments, customer notifications, or external side effects.
* Make it possible to cancel/reset test deliveries safely.
* Do not use hardcoded fake delivery status or fake tracking data to simulate success.
* Test orders must use the real backend assignment, status-transition, and tracking flow wherever possible.

## Test delivery workflow

The admin should be able to:

1. Create a test delivery with pickup and drop-off locations.
2. See it appear in the backend as an unassigned delivery.
3. Log in to the delivery-partner app as an approved test partner.
4. Receive and accept the delivery.
5. Complete pickup.
6. Send real device location updates during the active delivery.
7. Observe the delivery on the admin operations map.
8. Complete delivery using the configured proof-of-delivery method.
9. View the final status and delivery timeline in the admin dashboard.

If the current assignment system is automatic, use it. If assignment is manual, provide an authorized admin action to assign the test delivery to a partner. Do not silently invent a dispatch mechanism.

---

# D. API DESIGN FOR THE SEPARATE CUSTOMER APP TEAM

The customer ordering app is being built by another team. Design the backend APIs so that team can integrate without depending on the admin dashboard or delivery-partner UI.

## Core principle

The admin test-order tool and the future customer app should call the **same order-creation service/API**, with different authorization and validation rules.

Do not create one special business-logic implementation for test orders and a separate incompatible implementation for customer orders.

Use an explicit test-mode flag or a separate protected test endpoint only where needed. Keep test-only permissions and side-effect safeguards on the backend.

## Integration requirements

Provide:

* Versioned REST APIs, such as `/api/v1/...`
* Consistent Pydantic request/response schemas
* Clear authentication and authorization requirements
* Pagination and filtering for list endpoints
* Standard error responses
* Server-side order and delivery state validation
* Idempotency protection for order creation/acceptance where appropriate
* OpenAPI documentation generated by FastAPI
* A concise integration guide for the customer-app team

Document the expected contract for:

* Creating an order/delivery
* Retrieving order and delivery status
* Cancelling an order, if permitted
* Delivery-partner assignment
* Pickup and delivery status updates
* Tracking snapshot
* Tracking WebSocket authentication and message format

Include example request and response bodies in the integration documentation. Keep API fields stable and avoid requiring the customer app to know internal database implementation details.

Do not build customer-facing UI.

---

# E. DATA AND SECURITY

Reuse existing database models when possible. Ensure the data model can represent:

* Delivery partner and verification status
* Order
* Pickup and drop-off locations
* Delivery assignment
* Delivery status timeline/events
* Latest valid location
* Test-order flag
* Earnings, if already supported
* Admin audit events
* Delivery issue/support records, if supported

Enforce authorization on the backend:

* Partners can access only their own profile and assignments.
* Partners can update only their own active assigned delivery.
* Customers in the future customer app can access only their own orders.
* Admin access depends on role.
* Tracking is order-scoped and available only to authorized viewers.
* Test-order creation is admin-only.

Do not expose sensitive customer or partner data unnecessarily.

---

# F. DATABASE AND LOCAL DEVELOPMENT

Use SQLite for local backend development, with a configurable database URL.

* Use SQLAlchemy and Alembic migrations.
* Keep the schema reasonably portable to PostgreSQL later.
* Use `expo-sqlite` only for appropriate mobile caching/recovery.
* The backend database remains authoritative.
* Provide `.env.example` and setup documentation.
* Never put backend secrets in the mobile app.

---

# G. UI AND BRAND

Use the Digi Mess brand colors:

* Indigo: `#5B3DF5`
* Mint: `#19C6A5`
* Amber: `#FFC857`

The delivery-partner app should prioritize quick, readable actions while working.

The admin dashboard should prioritize operational clarity: searchable tables, clear status indicators, map visibility, and safe confirmation for sensitive actions.

Do not copy Swiggy, Zomato, Blinkit, or Zepto branding or exact screens. Use them only as general usability references.

---

# H. TESTING AND ACCEPTANCE CRITERIA

Test the complete workflow using an admin session and a delivery-partner session.

The project is complete only when:

1. Admin can log in securely.
2. Admin can review and approve/reject partner applications.
3. An approved partner can log in and go online.
4. Admin can create a clearly marked test delivery using pickup/drop-off locations.
5. The test delivery appears through the normal backend delivery flow.
6. The partner can receive and accept the delivery.
7. The partner can confirm pickup and complete delivery through backend-validated state transitions.
8. Active delivery location updates appear in the admin operations dashboard.
9. Stale/offline tracking states are shown accurately.
10. Admin can inspect partner and delivery history.
11. Test orders cannot trigger real payment or customer-facing side effects.
12. APIs are documented for the separate customer-app team.
13. Existing working functionality is preserved.
14. Loading, empty, error, and poor-network states are handled.
15. Tests and local setup instructions are included.

**Start by inspecting the existing repository. Implement the delivery-partner app, admin dashboard, and admin-only test-order tool. Do not build the customer ordering app. Do not stop after creating static mockups or a plan.**
