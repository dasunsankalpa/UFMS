# University Hall Management System (UHMS)

UHMS is a campus facility management system built with Node.js, Express, MongoDB, and Multer. It lets administrators manage lecture halls, labs, seminar rooms, and auditoriums, while staff can browse and book facilities.

## Features
- Facility CRUD with image upload (admin only)
- Public facility browsing + booking
- Faculty union member signup (with faculty dropdown and ID upload)
- Simple role check via localStorage flags

## Stack
- Node.js + Express
- MongoDB (Atlas/local) via Mongoose
- Multer for uploads to `/uploads`
- Static HTML/CSS/JS frontend

## Roles
- Admin: full facility CRUD, bookings oversight
- Academic staff & faculty union members: browse and book
- Students: access removed (per requirements)

## Key Pages
- `facilitiesNEW.html` – admin add/edit/delete (delete button shows only in edit mode)
- `facilitiesVIEW.html` – public browse/booking (no delete)
- `signup.html` – faculty union member registration (faculty dropdown + ID upload)

## API
- `POST /api/register/union` – register faculty union member (multipart with ID photo)
- `POST /api/facilities` – create
- `GET /api/facilities` – list all
- `GET /api/facilities/:type/:id` – get detail
- `PUT /api/facilities/:type/:id` – update
- `DELETE /api/facilities/:type/:id` – delete
- Static uploads served from `/uploads`

## Quick Start
1) `npm install`
2) Set MongoDB URI in `server.js` (or use an env var if you refactor)
3) `node server.js` (defaults to port 3000)
4) Open `http://localhost:3000/adminMAIN.html` (admin) or `http://localhost:3000/facilitiesVIEW.html` (public)

## Notes
- Images: <5MB, common formats
- LocalStorage flags: `lhms_role`, `lhms_loggedIn`
- Timetable collection auto-created when adding a facility
