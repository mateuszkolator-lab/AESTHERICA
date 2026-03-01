# AestheticaMD - Patient Management System

## Original Problem Statement
Build a patient management app for a facial plastic surgeon with:
- Patient database with CRUD operations and sorting
- Google Calendar integration for surgery dates (placeholder ready)
- Sorting by preferred date range, surgery date, status
- Status tracking: Consultation, Planned, Awaiting Term, Operated
- Photo uploads (7-10 per visit) with before/after comparison
- Statistics per month/year/location with Excel export
- Surgery price tracking
- Single-user password protected
- Web and mobile responsive

## User Persona
- **Primary User**: Facial Plastic Surgeon
- **Technical Level**: Non-technical
- **Use Case**: Managing patient records, surgery schedules, and clinical photos

## Tech Stack
- **Frontend**: React 19 + TailwindCSS + Radix UI
- **Backend**: FastAPI + Python
- **Database**: MongoDB
- **Authentication**: JWT (single-user password: doctor2024)

## Core Requirements (Static)
1. ✅ Patient CRUD with full data management
2. ✅ Multi-visit support per patient
3. ✅ Photo upload and gallery per visit
4. ✅ Before/after photo comparison slider
5. ✅ Status tracking workflow
6. ✅ Surgery date and preferred date range management
7. ✅ Location/clinic management
8. ✅ Statistics dashboard with charts
9. ✅ Excel export functionality
10. ⏳ Google Calendar sync (placeholder ready - needs API credentials)

## What's Been Implemented (Jan 2026)
- [x] Authentication system with JWT
- [x] Dashboard with stats overview and upcoming surgeries
- [x] Patient list with search, filtering, sorting
- [x] Patient detail page (split-view design)
- [x] Visit management (consultation, surgery, follow-up)
- [x] Photo upload with categories (before, after, during, other)
- [x] Photo comparison tool with slider
- [x] Calendar view for surgery dates
- [x] Statistics page with bar charts
- [x] Location management in settings
- [x] Excel export for patient data
- [x] Mobile-responsive design
- [x] Clean medical aesthetic (teal/white theme)

## API Endpoints
- POST /api/auth/login - Login
- GET /api/dashboard - Dashboard data
- CRUD /api/patients - Patient management
- CRUD /api/patients/{id}/visits - Visit management
- CRUD /api/patients/{id}/visits/{vid}/photos - Photo management
- CRUD /api/locations - Location management
- GET /api/stats - Statistics data
- GET /api/export/patients - Excel export
- GET /api/calendar/status - Google Calendar status

## Prioritized Backlog

### P0 (Critical)
- None currently

### P1 (High Priority)
- Google Calendar integration (when credentials provided)
- Patient medical record number (MRN) generation

### P2 (Medium Priority)
- Bulk photo upload with drag-and-drop
- Patient search with advanced filters
- Email/SMS appointment reminders

### P3 (Low Priority)
- Dark mode option
- PDF report generation
- Backup/restore functionality

## Next Tasks
1. Add Google Calendar integration when user provides API credentials
2. Consider adding procedure templates for common surgeries
3. Implement patient consent form tracking
