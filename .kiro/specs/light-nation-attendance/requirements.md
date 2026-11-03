# Requirements Document

## Introduction

The Light Nation Church Attendance Management System is a web application built on top of the TailAdmin Pro Next.js 16 template. It enables a single church administrator (Light Nation, Ibadan) to create and manage attendance sessions, generate QR-code-based registration links, and view attendance records. Congregation members register their attendance by scanning a QR code or visiting a public link — no app installation required. The admin can also manage church departments and configure basic app settings.

The system replaces all ecommerce and demo content in the template with church-specific pages, a new brand palette (deep red), and a neutral theme mode alongside the existing light and dark modes.

---

## Glossary

- **Admin**: The single authenticated user who manages the system.
- **Session**: A scheduled church event for which attendance is collected (e.g., Sunday Service, Bible Study).
- **Registration**: A single attendance entry submitted by a congregant for a session.
- **Token**: A unique, unguessable string embedded in a public registration URL that identifies a session.
- **Department**: A ministry group within the church (e.g., Choir, Ushers, Youth).
- **QR Code**: A scannable image encoding the public registration URL for a session.
- **Brand_Color**: The church's primary colour — deep red (~#C0392B).
- **Theme_Mode**: The user's preferred colour scheme: `light`, `dark`, or `neutral`.
- **Neutral_Theme**: A warm off-white / soft grey surface variant stored as `"neutral"` in `localStorage`.
- **Registration_Page**: The public, shell-free page at `/attend/[token]` used by congregants.
- **Admin_Shell**: The sidebar + header layout wrapping all admin pages.

---

## Requirements

### Requirement 1: Brand Design System

**User Story:** As an admin, I want the application to use Light Nation's deep-red brand identity, so that the interface reflects the church's visual identity.

#### Acceptance Criteria

1. THE System SHALL replace all `brand-*` colour tokens in `src/app/globals.css` with a deep-red palette (base `brand-500` ≈ `#C0392B`) across the full 50–950 range.
2. WHEN the brand palette is updated, THE System SHALL update all `shadow-focus-ring` and any hex values in flatpickr/ApexCharts overrides within `globals.css` to reference the new brand colour.
3. THE System SHALL define a `neutral` theme variant that applies warm off-white (`#FAF9F7`) surface and soft grey (`#E8E5E0`) border tokens via a `.neutral` root class.
4. WHEN the `neutral` class is active on `<html>`, THE System SHALL override background and surface colours to neutral values without interfering with the `.dark` class hierarchy.
5. THE System SHALL update `src/context/theme-context.tsx` so that `ThemeMode` includes `"neutral"` as a valid value alongside `"light"` and `"dark"`.
6. WHEN `themeMode` is set to `"neutral"`, THE System SHALL apply the `.neutral` CSS class to `document.documentElement` and persist `"neutral"` to `localStorage` under the key `"theme-mode"`.
7. THE System SHALL update the theme toggler UI in `src/layout/header/theme-toggler/index.tsx` to offer three options — Light, Dark, Neutral — replacing the binary toggle button.

---

### Requirement 2: Admin Shell Cleanup

**User Story:** As an admin, I want the sidebar and shell to show only church-relevant navigation, so that the UI is clean and focused.

#### Acceptance Criteria

1. THE System SHALL replace the existing `navItems` and `othersItems` arrays in `src/layout/app-layout/sidebar/data.tsx` with entries for: Overview, Attendance Sessions, Attendance Records, Departments, and Settings.
2. THE System SHALL remove all route files, page files, and component folders belonging to the ecommerce dashboard, calendar, profile, form-elements, basic-tables, charts, and ui-elements demo pages.
3. THE System SHALL update `src/layout/app-layout/sidebar/sidebar-header.tsx` to render a logo placeholder image on the left and the text "LIGHT NATION" (primary, larger) with "IBADAN" (secondary, smaller) beside it, replacing the TailAdmin logo.
4. WHEN the sidebar is collapsed to icon-only mode, THE System SHALL visually hide the "LIGHT NATION" and "IBADAN" text (e.g., via CSS width/opacity transition) while keeping the text nodes in the DOM for accessibility and screen readers.
5. THE System SHALL add permanent redirects in `next.config.ts` for any removed routes that previously existed (e.g., `/calendar`, `/profile`) pointing to `/`.
6. THE System SHALL remove the sign-up page (`/signup`) and its associated route, component files, and sidebar link, as the system supports only a single admin.
7. THE System SHALL update all four i18n message files (`en.json`, `ar.json`, `es.json`, `de.json`) to include translation keys for the new sidebar items: `overview`, `attendanceSessions`, `attendanceRecords`, `departments`, `settings`.

---

### Requirement 3: Admin Dashboard

**User Story:** As an admin, I want an overview dashboard, so that I can quickly see the current state of attendance activity.

#### Acceptance Criteria

1. THE Dashboard SHALL display four stats cards: Total Sessions (all-time count), Total Attendees (all-time registrations), Today's Attendance (registrations today), and Active Sessions (sessions currently open).
2. THE Dashboard SHALL display an attendance trend chart (ApexCharts area/line) showing daily registration counts over the past 30 days.
3. THE Dashboard SHALL display a Recent Sessions mini-table showing the five most recent sessions with columns: Event Name, Date, Registrations, Status.
4. THE Dashboard SHALL display an Upcoming Sessions section listing sessions scheduled for the future.
5. THE Dashboard SHALL display a "Create Session" quick-action button that navigates to `/sessions/new`.
6. WHEN no sessions exist yet, THE Dashboard SHALL display an empty-state message in place of the chart and tables.
7. THE Dashboard page SHALL export static `metadata` with the title "Overview — Light Nation".

---

### Requirement 4: Attendance Sessions

**User Story:** As an admin, I want to list, filter, and manage attendance sessions, so that I can track what events have been set up.

#### Acceptance Criteria

1. THE Sessions_Page SHALL display a table with columns: Event Name, Date, Opening Time, Closing Time, Registrations, Status badge, and an Actions menu.
2. THE Sessions_Page SHALL provide a status filter (All / Active / Upcoming / Closed) that filters the table client-side.
3. WHEN the "Create Session" button is clicked, THE System SHALL navigate the admin to `/sessions/new`.
4. THE Sessions_Page SHALL show a Status badge using `"active"` (green), `"upcoming"` (blue), and `"closed"` (gray) colour variants.
5. WHEN the Actions menu is opened for a session, THE System SHALL offer: View QR Code (navigates to `/sessions/[id]/qr`) and Delete.
6. WHEN no sessions exist, THE Sessions_Page SHALL display an empty-state prompt with a "Create your first session" call to action.
7. THE Sessions_Page SHALL export static `metadata` with the title "Attendance Sessions — Light Nation".

---

### Requirement 5: Create Session

**User Story:** As an admin, I want to create a new attendance session with specific date and time windows, so that congregants can register within the correct time frame.

#### Acceptance Criteria

1. THE Create_Session_Form SHALL include fields: Event Name (required, max 120 chars), Date (required, flatpickr date picker), Opening Time (required, flatpickr time picker), Closing Time (required, flatpickr time picker), and Description (optional, textarea, max 500 chars).
2. THE Create_Session_Form SHALL use `react-hook-form` with a `zod` schema for all field validation.
3. IF the Event Name field is empty on submit, THEN THE Create_Session_Form SHALL display the validation error "Event name is required".
4. IF the Closing Time is not after the Opening Time, THEN THE Create_Session_Form SHALL display the validation error "Closing time must be after opening time".
5. WHEN the form is successfully submitted, THE System SHALL generate a unique token for the session and navigate the admin to the QR Code view at `/sessions/[id]/qr`.
6. THE Create_Session_Page SHALL export static `metadata` with the title "Create Session — Light Nation".

---

### Requirement 6: QR Code View

**User Story:** As an admin, I want to view a QR code for a session, so that I can display or share it with congregants.

#### Acceptance Criteria

1. THE QR_Code_View SHALL display a large QR code image encoding the full public registration URL `/attend/[token]`.
2. WHEN the `qrcode` or compatible package is not present in `package.json`, THE System SHALL render a placeholder `<canvas>` element showing the registration URL as text until a QR library is added.
3. THE QR_Code_View SHALL display the session details: Event Name, Date, Opening Time, and Closing Time.
4. THE QR_Code_View SHALL display the registration URL in a read-only text input with a "Copy link" button that copies the URL to the clipboard.
5. WHEN the "Copy link" button is clicked, THE System SHALL provide visual confirmation (button label change or toast) for at least 2 seconds.
6. THE QR_Code_View SHALL display a "Download QR" button that is visually present but may be a no-op placeholder in the initial implementation.
7. THE QR_Code_View SHALL display the session Status badge.
8. THE QR_Code_View SHALL export static `metadata` with the title "QR Code — Light Nation".

---

### Requirement 7: Attendance Records

**User Story:** As an admin, I want to view and filter all attendance registrations, so that I can analyse who attended each session.

#### Acceptance Criteria

1. THE Records_Page SHALL display a table with columns: Registration Time, Full Name, Department, and Session.
2. THE Records_Page SHALL provide a search input that filters rows by Full Name (case-insensitive, client-side).
3. THE Records_Page SHALL provide filter controls for: Department (select), Session (select), and Date Range (flatpickr range picker).
4. THE Records_Page SHALL support pagination scoped to the full unfiltered dataset (filtering is applied per-page to the current page's rows), displaying a configurable number of rows per page (default 20), with Previous/Next and page indicator.
5. THE Records_Page SHALL display an Export button that triggers a mock CSV download (a no-op or simple blob in the initial implementation).
6. WHEN no records match the active filters, THE Records_Page SHALL display an empty-state message.
7. THE Records_Page SHALL export static `metadata` with the title "Attendance Records — Light Nation".

---

### Requirement 8: Departments

**User Story:** As an admin, I want to manage church departments, so that congregants can identify their ministry group when registering.

#### Acceptance Criteria

1. THE Departments_Page SHALL display a list or table of departments with columns: Name, Member Count (number of registrations from that department), Status (Enabled / Disabled).
2. WHEN the "Add Department" button is clicked, THE System SHALL open a dialog with a Name field (required, max 60 chars, unique).
3. IF the Name field is empty on submit, THEN THE Add_Department_Dialog SHALL display the validation error "Department name is required".
4. IF a department with the same name already exists (case-insensitive), THEN THE Add_Department_Dialog SHALL display the validation error "A department with this name already exists".
5. WHEN a department row's Enable/Disable toggle is activated, THE System SHALL update the department status immediately in the UI.
6. WHEN a department is disabled, THE Registration_Page SHALL NOT include that department in the Department selector dropdown; existing registrations linked to that department SHALL remain unchanged.
7. WHEN the Delete action is triggered for a department, THE System SHALL prompt the admin for confirmation before removing the department.
8. THE Departments_Page SHALL export static `metadata` with the title "Departments — Light Nation".

---

### Requirement 9: Settings

**User Story:** As an admin, I want to configure basic app and profile information, so that the system reflects the correct church details and admin credentials.

#### Acceptance Criteria

1. THE Settings_Page SHALL display an App Info section with fields: Church Name (text, required) and Church City (text, required).
2. THE Settings_Page SHALL display an Admin Profile section with fields: Full Name (text, required), Email (email, required), and a Password Change sub-form (Current Password, New Password, Confirm New Password).
3. THE Settings_Page SHALL use `react-hook-form` + `zod` for all field validation.
4. IF the New Password and Confirm New Password fields do not match, THEN THE Password_Change_Form SHALL display the validation error "Passwords do not match".
5. WHEN any settings section is saved successfully, THE System SHALL display a success toast/alert confirming the save for that specific section independently; each section (App Info, Admin Profile, Password Change) has its own save action.
6. THE Settings_Page SHALL export static `metadata` with the title "Settings — Light Nation".

---

### Requirement 10: Public Registration Page

**User Story:** As a congregant, I want to register my attendance by visiting a link or scanning a QR code, so that my presence is recorded without needing an app.

#### Acceptance Criteria

1. THE Registration_Page SHALL be rendered outside the Admin_Shell, using a standalone, mobile-first layout with no sidebar or header.
2. THE Registration_Page SHALL display the Light Nation logo, the session's Event Name as a prominent heading, and a short instruction paragraph.
3. THE Registration_Page SHALL present a form with: Full Name (text, required), Department (select, populated with enabled departments), and a conditional Other Department text field that appears WHEN "Other" is selected.
4. IF the Full Name field is empty on submit, THEN THE Registration_Form SHALL display the validation error "Full name is required".
5. IF the Department field has no selection on submit, THEN THE Registration_Form SHALL display the validation error "Please select your department".
6. IF the "Other" option is selected and the Other Department field is empty on submit, THEN THE Registration_Form SHALL display the validation error "Please specify your department".
7. WHEN the form is submitted successfully, THE Registration_Page SHALL transition to a Success state showing a confirmation message and the submitted name.
8. IF a congregant submits the same Full Name (exact string match, case-sensitive, whitespace-sensitive) for the same session a second time, THEN THE Registration_Page SHALL transition to a Duplicate state explaining the duplicate submission.
9. IF the session has not yet reached its Opening Time, THEN THE Registration_Page SHALL display a "Not Yet Open" state with the opening time.
10. IF the session's Closing Time has passed, THEN THE Registration_Page SHALL display a "Closed" state.
11. IF the token in the URL does not match any session, THEN THE Registration_Page SHALL display an "Invalid" state with a generic error message.
12. WHILE the registration form is submitting, THE Registration_Page SHALL display a loading indicator and disable the submit button.
13. THE Registration_Page SHALL use `react-hook-form` + `zod` for client-side validation.
14. THE Registration_Page submit button SHALL use the `brand-500` (deep red) colour as its primary background.

---

### Requirement 11: Authentication

**User Story:** As an admin, I want to sign in to the system with my credentials, so that the admin pages are protected from public access.

#### Acceptance Criteria

1. THE Sign_In_Page SHALL be accessible at `/signin` and rendered in the full-width (no Admin_Shell) layout.
2. THE Sign_In_Page SHALL display the Light Nation branding (logo + church name) and an admin sign-in heading.
3. THE Sign_In_Form SHALL include fields: Email (required) and Password (required).
4. THE Sign_In_Form SHALL use `react-hook-form` + `zod` for client-side validation.
5. IF the Email field is empty on submit, THEN THE Sign_In_Form SHALL display the validation error "Email is required".
6. IF the Password field is empty on submit, THEN THE Sign_In_Form SHALL display the validation error "Password is required".
7. THE Sign_Up_Page (`/signup`) SHALL be removed and SHALL NOT be accessible; requests to `/signup` SHALL be redirected to `/signin`.
8. THE System SHALL NOT include a sign-up link anywhere in the UI.

---

### Requirement 12: Internationalisation

**User Story:** As a developer, I want all new user-facing strings to be added to the i18n message files, so that the project maintains its translation structure.

#### Acceptance Criteria

1. THE System SHALL add every new user-facing string introduced by this feature to **all four** message files: `src/messages/en.json`, `src/messages/ar.json`, `src/messages/es.json`, and `src/messages/de.json`.
2. THE System SHALL nest new keys under a `"attendance"` top-level namespace in each message file.
3. WHEN adding navigation labels, THE System SHALL place them under the existing `"sidebar.items"` namespace.
4. THE Registration_Page SHALL NOT rely on next-intl server APIs, as it is a locale-free public page; it SHALL use hardcoded English strings or a separate lightweight i18n approach.
5. WHEN a new user-facing string is introduced in any component, THE System SHALL add that string to all four message files (`en.json`, `ar.json`, `es.json`, `de.json`) simultaneously.

---

### Requirement 13: Data Layer (In-Memory / Local State)

**User Story:** As a developer, I want the initial implementation to use in-memory or local state for data, so that the feature is fully functional for demonstration without requiring a backend.

#### Acceptance Criteria

1. THE System SHALL define TypeScript interfaces for `Session`, `Registration`, `Department`, and `AppSettings` in a shared `src/types/attendance.ts` file.
2. THE System SHALL provide a `src/lib/attendance-store.ts` module that exposes typed CRUD functions using React state or a simple in-memory store.
3. WHEN a session is created, THE System SHALL generate a `token` using `crypto.randomUUID()` or an equivalent, ensuring uniqueness within the store.
4. THE System SHALL use Supabase as the persistence backend; all CRUD operations SHALL be backed by Supabase tables so that data survives page refreshes and is shared across sessions.
5. THE System SHALL seed the store with at least three sample departments (e.g., Choir, Ushers, Youth) on first load.
