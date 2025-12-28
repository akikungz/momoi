# Product Requirements Document (PRD)

## Momoi Frontend (Web App)

**Document status:** Draft (v0.1)

**Last updated:** December 28, 2025

**Related docs:**
- `docs/API.md` (API endpoints + RBAC)
- `docs/QUEUE.md` (async provisioning/deprovisioning architecture)
- `docs/NOTIFICATION_ANALYSIS.md` (notification gaps + future direction)

---

## 1) Problem statement

Momoi currently exposes a role-based REST API for managing:
- user profile + SSH keys
- VM instances (provisioning, deletion, reverse proxies)
- student requests + extended requests
- instructor/admin review flows
- storage (files/folders with ACL + versions)
- academic data (admin only)

Users need a **frontend web application** that makes these capabilities discoverable and usable without direct API calls.

The key user-facing problems the frontend must solve:
1. **Self-service clarity:** users can quickly find “what I have” (instances, requests, files) and “what I can do” (based on role).
2. **Asynchronous operations:** provisioning/deprovisioning are async; users need clear progress/status and guidance.
3. **Access control visibility:** storage and admin functions have nuanced permissions; the UI must prevent invalid actions and explain why.
4. **Review workflow usability:** instructors/admins must efficiently review requests, see context, and act with confidence.

---

## 2) Goals (what success looks like)

### MVP goals
- A responsive web app supporting **STUDENT**, **INSTRUCTOR**, **ADMIN**.
- Role-aware navigation and guards:
  - students cannot access instructor/admin-only screens
  - UI hides or disables actions not allowed by role
- Feature-complete UX for:
  - **Auth + session handling** (relying on API sessions)
  - **User profile** (“Me”) + **SSH keys** CRUD
  - **Instances** list/detail + delete + reverse proxies
  - **Requests** (student create + cancel; instructor/admin review)
  - **Storage** browsing + search + file detail + version list
    - with role constraints (students read-only)
  - **Academic admin** CRUD screens for mailing list, courses, semesters, instructors (admin-only)
- Clear loading/empty/error states across all modules.

### Success metrics (initial)
- Time-to-first-action after login (e.g., open instance detail / create request) reduced vs API usage.
- Reduction in support tickets related to “where do I do X?” and “why can’t I do X?”
- Task completion rates:
  - student creates request successfully
  - instructor reviews and approves/rejects
  - instructor creates instance and sees it reach RUNNING/ACTIVE
  - user adds SSH key successfully

---

## 3) Non-goals (explicitly out of scope for MVP)

- A native mobile app.
- Real-time push notifications (websockets/SSE) unless the backend provides it.
- Direct VM console access, VNC/SPICE integration.
- Advanced storage operations unless fully specified and stable in the API contract (e.g., rich uploads, chunking, previews).
- Building or deploying the worker microservice (handled in a separate repo per `docs/QUEUE.md`).

---

## 4) Personas & roles

### Student
- Wants to request resources for coursework and track status.
- Can view own instances and read accessible storage content.

### Instructor
- Manages own instances.
- Reviews student requests for their courses.
- Manages own storage and sharing permissions.

### Admin
- Manages academic data (courses/semesters/instructors/mailing list).
- Has access to system-wide views where enabled by API.
- Note: Admin does **not** automatically bypass Storage ACL (per `docs/API.md`).

---

## 5) User journeys (high-level)

### Student journey
1. Login
2. Dashboard shows: “My Requests”, “My Instances”, “My Storage” quick links
3. Create request → see it listed as PENDING → later see APPROVED/REJECTED
4. If approved, see instance provisioning states in “My Instances”

### Instructor journey
1. Login
2. “My Instances”: create instance → status shows PROVISIONING/PENDING → becomes RUNNING/ACTIVE
3. “Requests to Review”: filter by course/status → open detail → approve/reject
4. “Storage”: create folder/file, manage sharing permissions, view versions

### Admin journey
1. Login
2. “Academic Admin”: manage mailing list, courses, semesters, instructors
3. Troubleshoot user issues by viewing relevant admin screens (within API limits)

---

## 6) Information architecture (routes / screens)

### Global
- `/login` (if required; or redirect to auth provider)
- `/app` (authenticated shell)
  - `/app/dashboard`
  - `/app/me` (profile)
  - `/app/ssh-keys`

### Instances
- `/app/instances` (list)
- `/app/instances/:id` (detail)
  - reverse proxies section
  - audit logs section (instructor/admin only)

### Requests
- `/app/requests` (list)
  - student: own requests
  - instructor/admin: course/system relevant requests
- `/app/requests/new` (student)
- `/app/requests/:id` (detail)
- `/app/extended-requests` (list)
- `/app/extended-requests/:id` (detail)

### Storage
- `/app/storage` (file explorer; supports `parentId` query)
- `/app/storage/search`
- `/app/storage/:fileId` (details)
  - `/versions` view embedded
  - `/permissions` view embedded (owner-only)

### Academic (Admin)
- `/app/admin/academic/mailing-list`
- `/app/admin/academic/instructors`
- `/app/admin/academic/courses`
- `/app/admin/academic/semesters`

---

## 7) Functional requirements (by module)

### 7.1 Authentication & session

**Requirements**
- The frontend must rely on the backend’s session mechanism described in `docs/API.md` (better-auth).
- It must handle:
  - unauthenticated → redirect to login/start auth
  - expired session → show a “Session expired” message and re-authenticate
  - 401/403 errors → friendly, actionable copy

**Acceptance criteria**
- If user visits any `/app/*` route without a valid session, they are redirected to auth.
- If an API call returns 401, the app clears local user state and triggers re-auth.

---

### 7.2 Role-based navigation & guards

**Requirements**
- The app must fetch the current user profile from `GET /api/user/me`.
- UI must:
  - show role badge (STUDENT/INSTRUCTOR/ADMIN)
  - hide admin navigation for non-admin users
  - prevent deep-link access to forbidden routes (redirect + explain)

**Acceptance criteria**
- Non-admin deep-link to `/app/admin/*` results in a 403-safe screen (no sensitive data shown).

---

### 7.3 “Me” (profile)

**API**
- `GET /api/user/me`

**Requirements**
- Display ID, name, email, role.
- Provide link to SSH keys page.

---

### 7.4 SSH keys management

**API**
- `GET /api/user/ssh-keys` (paginated)
- `POST /api/user/ssh-keys`
- `DELETE /api/user/ssh-keys`

**Requirements**
- List SSH keys with pagination.
- Add SSH key:
  - validate name required
  - validate publicKey format (basic client-side check; server is source of truth)
- Delete keys:
  - multi-select delete supported
  - show “N keys removed” confirmation

**Acceptance criteria**
- User can add a key and immediately see it in the list.
- If server returns 400 for invalid key, UI shows the server message.

---

### 7.5 Instances

**API**
- `GET /api/instances`
- `GET /api/instances/:instanceId`
- `DELETE /api/instances/:instanceId`
- `POST /api/instances/` (instructor/admin)
- `GET /api/instances/admin` (admin)
- `GET /api/instances/:instanceId/audit-logs` (instructor/admin)
- Reverse proxies:
  - `POST /api/instances/:instanceId/reverse-proxies`
  - `GET /api/instances/:instanceId/reverse-proxies`
  - `DELETE /api/instances/:instanceId/reverse-proxies/:proxyId`

**Requirements**
- Instances list:
  - show name, status, createdAt, quick actions (view, delete)
  - support pagination
  - instructor/admin: show “Create instance” CTA
- Instance detail:
  - show IP address, status, VM metadata if provided
  - show reverse proxies table + create/delete
  - show audit logs tab/section (only when allowed)
- Delete:
  - confirmation dialog
  - post-delete UX should acknowledge that deprovisioning is async (per `docs/QUEUE.md`)

**Async status UX**
- For provisioning/deprovisioning-related statuses, show:
  - a “processing” banner
  - suggested user actions (e.g., “Check back in a few minutes”)
  - a manual refresh button

**Acceptance criteria**
- Instructor can create an instance and see it appear with a non-final status.
- User can create and delete reverse proxies and sees list update.

---

### 7.6 Requests (standard)

**API**
- `POST /api/requests` (student)
- `GET /api/requests` (student/instructor/admin with different visibility)
- `PATCH /api/requests/:requestId/status` (cancel for student; approve/reject for instructor/admin)
- `GET /api/requests/:requestId/audit-logs`

**Requirements**
- Request list:
  - filter by status
  - role-based scope messaging:
    - student: “Your requests”
    - instructor: “Requests for your courses”
    - admin: “All requests”
- Create request (student):
  - fields per API doc: courseId, semesterId, templateId, description, requestedResources
  - validation: required fields; numeric bounds sanity checks
- Review request (instructor/admin):
  - approve/reject actions require “reason”
  - show audit log history

**Acceptance criteria**
- Student can cancel a PENDING request and sees status change.
- Instructor/admin can approve/reject and sees audit logs update.

---

### 7.7 Extended requests

**API**
- `POST /api/extended-requests` (student)
- `GET /api/extended-requests`
- `PATCH /api/extended-requests/:extendedRequestId/status`
- `GET /api/extended-requests/:extendedRequestId/audit-logs`

**Requirements**
- Similar patterns to standard requests.
- Capture `requestType`, `description`, and `requestedChanges`.

---

### 7.8 Storage (files/folders)

**API** (documented subset)
- Listing/search owned by caller:
  - `GET /api/storage/files`
  - `GET /api/storage/files/search`
- File/folder detail + versions (ACL-governed):
  - `GET /api/storage/files/:fileId`
  - `GET /api/storage/files/:fileId/versions`

**Additional endpoints referenced in RBAC matrix (details TBD)**
- `POST /api/storage/files`
- `PATCH /api/storage/files/:fileId`
- `DELETE /api/storage/files/:fileId`
- `POST /api/storage/files/:fileId/move`
- `POST /api/storage/files/:fileId/copy`
- `POST /api/storage/files/:fileId/versions`
- `DELETE /api/storage/files/:fileId/versions/:versionId`
- permissions management: `GET|POST|PATCH|DELETE /api/storage/files/:fileId/permissions/*`

**MVP requirements**
- File explorer:
  - show folders/files for `parentId` (root when omitted)
  - breadcrumb navigation
  - pagination controls
  - type filters (FILE/FOLDER)
- Search:
  - query + optional type filter
  - results show path context if available; otherwise show name + type
- File/folder detail:
  - display metadata and access summary (“Owner”, “Shared with you”, “Public viewer”)
  - show versions list (for files)

**Role behavior**
- Student:
  - read-only UI
  - hide create/rename/delete/move/copy/upload/version actions
- Instructor/Admin:
  - show management actions only if the user is owner (owner-only for many permission endpoints)

**UX requirement: permission denials**
- If user opens a file detail but API returns 403, show:
  - “You don’t have access”
  - optional CTA: “Request access” (placeholder; backend not yet defined)

**Acceptance criteria**
- Student can browse own file list and search.
- Instructor can browse and see versions for an accessible file.

---

### 7.9 Academic admin

**API**
- Mailing list:
  - `GET /api/academic/mailing-list`
  - `POST /api/academic/mailing-list`
  - `DELETE /api/academic/mailing-list/:mailingId`
- Instructors:
  - `GET /api/academic/instructors`
  - `GET /api/academic/instructors/:instructorId`
  - `PATCH /api/academic/instructors/:instructorId`
- Courses:
  - `GET /api/academic/courses`
  - `GET /api/academic/courses/:courseId`
  - `POST /api/academic/courses`
  - `PATCH /api/academic/courses/:courseId`
  - `PATCH /api/academic/courses/:courseId/instructors`
  - `PATCH /api/academic/courses/:courseId/semesters`
- Semesters:
  - `GET /api/academic/semesters`
  - `GET /api/academic/semesters/:semesterId`
  - `POST /api/academic/semesters`
  - `PATCH /api/academic/semesters/:semesterId`
  - `PATCH /api/academic/semesters/:semesterId/courses`
  - `DELETE /api/academic/semesters/:semesterId`

**Requirements**
- Admin-only navigation section.
- Common list patterns:
  - pagination
  - row actions: view/edit/delete (where supported)
- Form validation and optimistic UI where safe.

**Acceptance criteria**
- Admin can create a course, then assign instructors and semesters.

---

## 8) Cross-cutting UX requirements

### Loading, empty, and error states
- Each page must define:
  - skeleton/loading state
  - empty state with CTA (role-aware)
  - error state using standard API error format:
    ```json
    { "status": 400, "message": "Detailed error message" }
    ```

### Pagination
- Support `page` + `pageSize` where endpoints provide it.
- Persist pagination state in URL query params.

### Time & date display
- Display server timestamps in user’s local timezone.

### Accessibility
- Keyboard navigable UI.
- Form fields with labels and inline validation messages.
- Color contrast AA minimum.

---

## 9) Notifications (MVP approach)

Per `docs/NOTIFICATION_ANALYSIS.md`, the backend does not currently provide a notification queue/channel for user-facing updates.

**MVP requirement**
- Provide an in-app “Activity” pattern via:
  - polling on key pages (instances/requests) with a sensible interval and a manual refresh button
  - visible last-updated timestamp

**Phase 2 (future)**
- Add real notifications once backend supports it (queue + worker + channel). Frontend should be designed so a notification center can be added without restructuring the app shell.

---

## 10) Technical requirements & constraints (frontend)

### Recommended approach
- A standalone frontend web app (separate package/repo) consuming Momoi API.
- Type-safe API client:
  - Prefer generating from OpenAPI (Momoi includes `@elysiajs/openapi`), or
  - Use a typed client pattern aligned with existing Eden treaty usage in E2E tests.

### Security
- Do not store secrets in the frontend.
- Treat session cookies/tokens per backend requirements.
- Apply CSRF/secure-cookie considerations depending on deployment topology.

### Observability
- Track client-side errors (Sentry or equivalent).
- Log key UX events (optional): create request, approve/reject, create instance, etc.

---

## 11) Testing requirements (frontend)

- Unit tests for:
  - role guard logic
  - client-side validation
  - key components (tables/forms)
- E2E tests (browser) for critical flows:
  - login → dashboard
  - student create request → cancel
  - instructor approve request
  - instructor create instance
  - storage browse + search

---

## 12) Open questions / follow-ups

1. Storage write APIs: request/response bodies for create/rename/move/copy/version/permissions endpoints are referenced but not fully specified in `docs/API.md`. Frontend implementation requires a finalized contract.
2. Instance statuses: confirm canonical status enum values (API doc shows both RUNNING/STOPPED/TERMINATED and PENDING/ACTIVE in queue doc examples).
3. Auth UX: confirm whether the frontend needs a custom login page or should always redirect to provider.
4. Notifications: confirm whether roadmap includes SSE/websocket endpoints or a notifications table.

---

## 13) Milestones (suggested)

- **M1 (MVP shell):** Auth/session, role guards, app shell + navigation
- **M2 (Core self-service):** Me + SSH keys, Instances list/detail + reverse proxies
- **M3 (Requests):** Student create/cancel, Instructor/Admin review
- **M4 (Storage read):** Explorer + search + details + versions
- **M5 (Admin academic):** Mailing list + courses + semesters + instructors
- **M6 (Hardening):** Accessibility, performance, analytics, E2E test suite
