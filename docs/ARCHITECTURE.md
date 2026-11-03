# Light Nation Ibadan — Church Attendance Management System

## 1. Design System & Brand Tokens
Defined centrally in `src/app/globals.css`:
- **Primary Brand Scale (`--color-brand-50…950`)**: Deep Church Red (`#B91C1C` / `#991B1B`).
- **Accent Scale (`--color-gold-50…900`)**: Restrained Gold (`#C69214`).
- **Three-Theme Appearance System (`src/context/theme-context.tsx`)**:
  - **Light Mode (`.light`)**: Clean white surfaces (`#FFFFFF`), subtle slate canvas (`#F8FAFC`), deep charcoal text (`#101828`).
  - **Neutral Mode (`.neutral`)**: Balanced warm stone canvas (`#E9E6E0`), soft alabaster cards (`#F5F3EF`), warm borders (`#D5D0C7`), and restrained charcoal contrast (`#1F1E1B`).
  - **Dark Mode (`.dark`)**: Deep charcoal canvas (`#0C0E12`), elevated dark surfaces (`#151921`), and accessible light text (`#F3F4F6`).

## 2. Application Routes
- `/` & `/admin` — **Dashboard Overview**: Attendance KPIs, growth trend chart, upcoming scheduled sessions, recent sessions, and quick session creator.
- `/attendance` — **Attendance Sessions**: Full session table, status filtering, inline & modal session creator, and live QR Code pass preview & SVG download.
- `/records` — **Attendance Records**: Searchable attendee check-in logs with Department, Session, and Date filters plus CSV export and print view.
- `/departments` — **Departments**: Workforce & ministry unit management with Add, Edit, and real-time Enable/Disable toggle.
- `/settings` — **Settings**: Three-theme visual switcher, Light Nation Ibadan brand lockup preview, administrator profile, and attendance governance toggles.
- `/login` & `/signin` — **Administrator Login**: Branded sign-in experience with validation.
- `/attend/[token]` — **Public Mobile-First Registration Experience**: Fast 5–10 second attendee check-in supporting `form`, `loading`, `success`, `duplicate`, `not-open`, `closed`, and `invalid-qr` states across all three themes.
