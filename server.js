// ...existing code...
// ========== SINGLE BOOKING APPROVAL ========== 
// (Place this after app is defined)

// Core & libs
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');

// App
const app = express();
app.use(cors());
app.use(express.json());

// ==== Ensure uploads/ directory exists ====
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// ==== Multer config for file uploads ====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, ''))
});
const upload = multer({ storage });

// ==== Serve uploaded images statically ====
app.use('/uploads', express.static(uploadDir));

// ==== Serve HTML files ====
app.use(express.static(__dirname));

// ==== Connect to MongoDB (consider moving to env vars) ====
const facilitiesDB = mongoose.createConnection('mongodb+srv://dasun:dasun1234@cluster0.kyxbb5f.mongodb.net/facilitiesDB');
const bookingDB    = mongoose.createConnection('mongodb+srv://dasun:dasun1234@cluster0.kyxbb5f.mongodb.net/bookingDB');
const logDB        = mongoose.createConnection('mongodb+srv://dasun:dasun1234@cluster0.kyxbb5f.mongodb.net/logDB');

// ==== Nodemailer Setup ====
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// ==== Email Template ====
function bookingEmailTemplate({ fullname, status, facility, bookingDate, startTime, endTime, participants, purpose, cancellationReason }) {
  const statusText = status === "Approved" ? "Approved"
                   : status === "Cancelled" ? "Cancelled"
                   : "Pending";
  return `
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;box-shadow:0 10px 24px rgba(44,62,80,0.09);overflow:hidden;font-family:'Inter',Arial,sans-serif;">
    <div style="background:#34495e;padding:36px 30px 28px;text-align:center;color:#fff;">
      <div style="font-size:40px;margin-bottom:12px;">🏛️</div>
      <div style="font-size:26px;font-weight:700;margin-bottom:6px;">LHMS</div>
      <div style="font-size:16px;opacity:0.88;">Lecture Hall Management System</div>
    </div>
    <div style="padding:36px 36px 24px;">
      <div style="font-size:18px;margin-bottom:20px;color:#636e72;">Dear <b style="color:#273c75;">${fullname}</b>,<br>We are writing to update you about your booking request.</div>
      <div style="background:#f1f7ff;border-radius:15px;padding:18px 0;margin:32px 0 22px;text-align:center;border:1px solid #dcdde1;">
        <div style="font-size:13px;color:#636e72;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Booking Status</div>
        <span style="display:inline-block;padding:12px 24px;border-radius:25px;font-weight:600;color:#fff;font-size:16px;
          background:${status === "Approved" ? "#2ecc71" : status === "Pending" ? "#f39c12" : status === "Cancelled" ? "#e74c3c" : "#3498db"};">
          ${statusText}
        </span>
      </div>
      <div style="background:#f1f7ff;border-radius:15px;padding:25px 22px;margin-bottom:18px;border-left:4px solid #3498db;">
        <div style="font-size:17px;font-weight:600;color:#273c75;margin-bottom:12px;">📋 Booking Details</div>
        <div style="display:flex;flex-wrap:wrap;gap:12px;">
          <div style="flex:1;min-width:120px;">
            <div style="font-size:12px;color:#636e72;text-transform:uppercase;">Facility</div>
            <div style="font-size:15px;font-weight:600;">${facility}</div>
          </div>
          <div style="flex:1;min-width:120px;">
            <div style="font-size:12px;color:#636e72;text-transform:uppercase;">Date</div>
            <div style="font-size:15px;font-weight:600;">${new Date(bookingDate).toLocaleDateString()}</div>
          </div>
          <div style="flex:1;min-width:120px;">
            <div style="font-size:12px;color:#636e72;text-transform:uppercase;">Time</div>
            <div style="font-size:15px;font-weight:600;">${startTime} - ${endTime}</div>
          </div>
          <div style="flex:1;min-width:120px;">
            <div style="font-size:12px;color:#636e72;text-transform:uppercase;">Participants</div>
            <div style="font-size:15px;font-weight:600;">${participants || 'N/A'}</div>
          </div>
        </div>
        <div style="margin-top:18px;">
          <div style="font-size:12px;color:#636e72;text-transform:uppercase;">Purpose</div>
          <div style="font-size:15px;font-weight:600;color:#273c75;">${purpose || '-'}</div>
        </div>
      </div>
      ${status === "Cancelled" && cancellationReason ? `
        <div style="background:#fff2f2;border-radius:15px;padding:20px 18px;margin:24px 0;border-left:4px solid #e74c3c;border:1px solid #f5c6cb;">
          <div style="font-weight:600;color:#e74c3c;margin-bottom:8px;">Cancellation Reason</div>
          <div style="color:#721c24;font-size:15px;line-height:1.5;">${cancellationReason}</div>
        </div>
      ` : ""}
      <div style="background:#f1f7ff;padding:15px 18px;border-radius:10px;text-align:center;border:1px solid #dcdde1;">
        <div style="color:#636e72;">Questions or concerns? Our admin team is here to help you.<br>
        <b>📧 admin@lhms.edu &nbsp; | &nbsp; 📞 +1 (555) 123-4567</b>
        </div>
      </div>
    </div>
    <div style="background:#34495e;color:#fff;text-align:center;padding:20px 16px;font-size:13px;">
      <div style="font-weight:600;">LHMS Team</div>
      <div>Lecture Hall Management System © 2024</div>
    </div>
  </div>
  `;
}

// ==== Helper: Get Current Week Range (Mon - Sun) ====
function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(0, 0, 0, 0);
  return { weekStart, weekEnd };
}

// ===================== Admin guard middleware =====================
function requireAdmin(req, res, next) {
  const key = req.header('x-admin-key');
  if (!key || key !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ========== OWNER (ACCOUNT) IDENTITY EXTRACTION ==========
function extractOwnerFromHeaders(req) {
  return {
    ownerId:    req.header('x-user-id')    || null,
    ownerRole:  req.header('x-user-role')  || null,
    ownerEmail: req.header('x-user-email') || null,
    ownerName:  req.header('x-user-name')  || null
  };
}

function normalizeOwnerId(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return mongoose.Types.ObjectId.isValid(raw) ? raw : null;
}

// ==== User Schemas ====
const studentLogSchema = new mongoose.Schema({
  fullname: String, email: String, password: String, idFront: String, idBack: String, createdAt: { type: Date, default: Date.now }
});
const StudentLog = logDB.model('StudentLog', studentLogSchema, 'studentlog');

// Union members (faculty union) — replaces student registrations
const unionLogSchema = new mongoose.Schema({
  fullname: String,
  email: String,
  password: String,
  faculty: String,
  idFront: String,
  idBack: String,
  createdAt: { type: Date, default: Date.now }
});
const UnionLog = logDB.model('UnionLog', unionLogSchema, 'unionlog');

const staffLogSchema = new mongoose.Schema({
  fullname: String, email: String, password: String, createdAt: { type: Date, default: Date.now }
});
const StaffLog = logDB.model('StaffLog', staffLogSchema, 'stafflog');

// ==== Facility Schema ====
const facilitySchema = new mongoose.Schema({
  facilityType: String, facilityName: String, facilityCode: String,
  capacity: Number, location: String, facilities: [String], additionalEquipment: String,
  status: String, bookingRestrictions: String, notes: String, imageUrl: String
}, { timestamps: true });
function createFacilityModel(collectionName) {
  if (facilitiesDB.models[collectionName]) return facilitiesDB.model(collectionName);
  return facilitiesDB.model(collectionName, facilitySchema, collectionName);
}
const facilityCollections = [
  'auditorium','computerlab','conferencehall','lecturehall','meetingroom','seminarroom'
];

// ==== Timetable schema (dynamic for each facility) ====
const timetableSchema = new mongoose.Schema({
  date: String, time: String, status: { type: String, default: "available" }, bookedBy: String, bookingId: String
}, { strict: false });
function getTimetableCollectionName(facilityName) {
  return facilityName.trim().replace(/\s+/g, '').toLowerCase() + '_timetable';
}
function getOrCreateTimetableModel(collectionName) {
  if (facilitiesDB.models[collectionName]) return facilitiesDB.model(collectionName);
  return facilitiesDB.model(collectionName, timetableSchema, collectionName);
}

// ==== Booking schema ====
const bookingSchema = new mongoose.Schema({
  fullname: { type: String, required: true },
  email:    { type: String, required: true },
  phone:    { type: String, required: true },
  facultyDept: String,
  facility: String,
  bookingDate: { type: Date, required: true },
  startTime: String,
  endTime: String,
  participants: Number,
  purpose: String,
  description: String,
  terms: Boolean,
  status: String, // "Pending", "Approved", "Cancelled"
  cancellationReason: String,
  position: String, // Added position field

  // 🔗 Owner link — set by server from headers
  ownerId:   { type: mongoose.Schema.Types.ObjectId, index: true, sparse: true },
  ownerRole: String,    // 'student' | 'staff'
  ownerEmail:String,
  ownerName: String
}, { timestamps: true });

// Helpful indexes
bookingSchema.index({ ownerId: 1, bookingDate: -1 });
bookingSchema.index({ ownerEmail: 1, bookingDate: -1 });

const Booking = bookingDB.model('Booking', bookingSchema);

// ==== Approve Booking Schema ====
const approveBookingSchema = new mongoose.Schema({
  fullname: String, email: String, phone: String, facultyDept: String, facility: String,
  bookingDate: { type: Date, required: true },
  startTime: String, endTime: String, participants: Number,
  purpose: String, description: String, terms: Boolean, status: String,
  cancellationReason: String,
  position: String,

  // carry owner link too
  ownerId:   { type: mongoose.Schema.Types.ObjectId, index: true, sparse: true },
  ownerRole: String,
  ownerEmail:String,
  ownerName: String,

  // link back to original booking
  originalBookingId: { type: mongoose.Schema.Types.ObjectId, index: true, sparse: true }
}, { timestamps: true });

approveBookingSchema.index({ ownerId: 1, bookingDate: -1 });
approveBookingSchema.index({ ownerEmail: 1, bookingDate: -1 });

const ApproveBooking = bookingDB.model('ApproveBooking', approveBookingSchema);

// ==== Booking History Schema ====
const bookingHistorySchema = new mongoose.Schema({
  fullname: String,
  email: String,
  phone: String,
  facultyDept: String,
  facility: String,
  bookingDate: Date,
  startTime: String,
  endTime: String,
  participants: Number,
  purpose: String,
  description: String,
  terms: Boolean,
  status: String,
  actionBy: String,
  actionAt: { type: Date, default: Date.now },
  cancellationReason: String,
  position: String,

  // keep owner link for auditing / "My History"
  ownerId:   { type: mongoose.Schema.Types.ObjectId, index: true, sparse: true },
  ownerRole: String,
  ownerEmail:String,
  ownerName: String
}, { timestamps: true });
const BookingHistory = bookingDB.model('BookingHistory', bookingHistorySchema);

// ========== USER MANAGEMENT ==========
// Register union member (faculty union)
app.post('/api/register/union', upload.fields([{ name: 'idfront', maxCount: 1 }, { name: 'idback', maxCount: 1 }]), async (req, res) => {
  try {
    const { fullname, email, password, faculty } = req.body;
    const idFront = req.files['idfront'] ? req.files['idfront'][0].filename : '';
    const idBack  = req.files['idback']  ? req.files['idback'][0].filename  : '';
    if (!fullname || !email || !password || !faculty || !idFront || !idBack)
      return res.status(400).json({ message: 'Missing required fields' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const union = new UnionLog({ fullname, email, password: hashedPassword, faculty, idFront, idBack });
    await union.save();
    // Return userId for frontend
    res.json({ message: 'Faculty Union Member registered!', userId: union._id });
  } catch (err) { 
    console.error('Union registration error:', err);
    res.status(500).json({ message: 'Error registering union member' });
  }
});

// Legacy: student registration (kept for backwards compatibility)
app.post('/api/register/student', upload.fields([{ name: 'idfront', maxCount: 1 }, { name: 'idback', maxCount: 1 }]), async (req, res) => {
  try {
    const { fullname, email, password } = req.body;
    const idFront = req.files['idfront'] ? req.files['idfront'][0].filename : '';
    const idBack  = req.files['idback']  ? req.files['idback'][0].filename  : '';
    if (!fullname || !email || !password || !idFront || !idBack)
      return res.status(400).json({ message: 'Missing required fields' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const student = new StudentLog({ fullname, email, password: hashedPassword, idFront, idBack });
    await student.save();
    // Return userId for frontend
    res.json({ message: 'Student registered!', userId: student._id });
  } catch (err) { res.status(500).json({ message: 'Error registering student' }); }
});
app.post('/api/register/staff', async (req, res) => {
  try {
    const { fullname, email, password } = req.body;
    if (!fullname || !email || !password)
      return res.status(400).json({ message: 'Missing required fields' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const staff = new StaffLog({ fullname, email, password: hashedPassword });
    await staff.save();
    // Return userId for frontend
    res.json({ message: 'Staff registered!', userId: staff._id });
  } catch (err) { res.status(500).json({ message: 'Error registering staff' }); }
});
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    // Check union members first
    const union = await UnionLog.findOne({ email });
    if (union && await bcrypt.compare(password, union.password)) {
      return res.json({ success: true, role: 'union', fullname: union.fullname, userId: union._id, email: union.email, faculty: union.faculty });
    }

    // Then students (legacy)
    const student = await StudentLog.findOne({ email });
    if (student && await bcrypt.compare(password, student.password)) {
      return res.json({ success: true, role: 'student', fullname: student.fullname, userId: student._id, email: student.email });
    }

    // Finally staff
    const staff = await StaffLog.findOne({ email });
    if (staff && await bcrypt.compare(password, staff.password)) {
      return res.json({ success: true, role: 'staff',   fullname: staff.fullname,   userId: staff._id,   email: staff.email });
    }
    res.json({ success: false });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
});
app.get('/api/users', async (req, res) => {
  try {
    const unions = await UnionLog.find();
    const students = await StudentLog.find();
    const staff = await StaffLog.find();
    const users = [
      ...staff.map(user => ({ id: user._id, fullname: user.fullname, email: user.email, userType: 'Academic Staff' })),
      ...unions.map(user => ({ id: user._id, fullname: user.fullname, email: user.email, userType: 'Faculty Union Member', faculty: user.faculty })),
      ...students.map(user => ({ id: user._id, fullname: user.fullname, email: user.email, userType: 'Student' }))
    ];
    res.json(users);
  } catch (err) { res.status(500).json({ message: 'Error fetching users' }); }
});
app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params; const { type } = req.query;
  try {
    let deleted;
    if (type === 'staff') deleted = await StaffLog.findByIdAndDelete(id);
    else if (type === 'union') deleted = await UnionLog.findByIdAndDelete(id);
    else if (type === 'student') deleted = await StudentLog.findByIdAndDelete(id);
    else return res.status(400).json({ message: 'User type not specified or invalid' });
    if (!deleted) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) { res.status(500).json({ message: 'Error deleting user' }); }
});

// ========== FACILITY MANAGEMENT ==========
app.post('/api/facilities', async (req, res) => {
  try {
    const { facilityType, facilityName, ...rest } = req.body;
    if (!facilityType || !facilityName)
      return res.status(400).json({ error: 'Facility type and name are required' });
    if (typeof rest.facilities === "string") {
      rest.facilities = rest.facilities.split(',').map(f => f.trim()).filter(Boolean);
    }
    const collectionName = facilityType.replace(/_/g, '');
    const Facility = createFacilityModel(collectionName);
    const newFacility = new Facility({ facilityType, facilityName, ...rest });
    await newFacility.save();

    const timetableCollectionName = getTimetableCollectionName(facilityName);
    getOrCreateTimetableModel(timetableCollectionName);

    res.status(201).json({ message: 'Facility saved successfully and timetable collection created!' });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});
app.get('/api/facilities', async (req, res) => {
  try {
    let all = [];
    for (const collectionName of facilityCollections) {
      const Facility = createFacilityModel(collectionName);
      const data = await Facility.find();
      all = all.concat(data);
    }
    res.json(all);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch facilities' }); }
});
app.post('/api/facilities/upload', upload.single('facilityImage'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ filename: req.file.filename });
});
app.get('/api/facilities/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const collectionName = type.replace(/_/g, '');
    const Facility = createFacilityModel(collectionName);
    const facilities = await Facility.find();
    res.json(facilities);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch facilities' }); }
});
app.get('/api/facilities/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const collectionName = type.replace(/_/g, '');
    const Facility = createFacilityModel(collectionName);
    const data = await Facility.findById(id);
    if (!data) return res.status(404).json({ message: 'Not found' });
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch facility' }); }
});
app.put('/api/facilities/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    if (typeof req.body.facilities === "string") {
      req.body.facilities = req.body.facilities.split(',').map(f => f.trim()).filter(Boolean);
    }
    const collectionName = type.replace(/_/g, '');
    const Facility = createFacilityModel(collectionName);
    const result = await Facility.findByIdAndUpdate(id, req.body, { new: true });
    if (!result) return res.status(404).json({ message: 'Not found' });
    res.json(result);
  } catch (err) { res.status(500).json({ error: 'Failed to update facility' }); }
});
app.delete('/api/facilities/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const collectionName = type.replace(/_/g, '');
    const Facility = createFacilityModel(collectionName);
    const result = await Facility.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ message: 'Facility not found' });
    res.json({ message: 'Facility deleted successfully' });
  } catch (err) { 
    console.error('Delete facility error:', err);
    res.status(500).json({ error: 'Failed to delete facility' }); 
  }
});

// ========== BOOKING MANAGEMENT ==========

// Pending bookings (admin view)
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find({ $or: [{ status: { $exists: false } }, { status: "Pending" }] }).sort({ bookingDate: -1 });
    res.json(bookings);
  } catch (err) { res.status(500).json({ message: 'Error fetching bookings' }); }
});

// Create booking (uses headers to set owner identity)
app.post('/api/booking', async (req, res) => {
  try {
    const entryData = { ...req.body };
    entryData.bookingDate = new Date(entryData.bookingDate);
    const isEmergencyBooking =
      entryData.isEmergency === true ||
      (typeof entryData.purpose === 'string' && entryData.purpose.trim().toLowerCase() === 'emergency booking');
    entryData.status = isEmergencyBooking ? "Approved" : "Pending";

    // ✅ CHECK FACILITY STATUS BEFORE BOOKING
    const facilityName = entryData.facility;
    if (facilityName) {
      try {
        const facilityCollectionName = facilityName.trim().replace(/\s+/g, '').toLowerCase();
        const FacilityModel = createFacilityModel(facilityCollectionName);
        const facility = await FacilityModel.findOne({ facilityName: { $regex: new RegExp('^' + facilityName + '$', 'i') } });
        
        if (facility) {
          const facilityStatus = (facility.status || 'available').toLowerCase();
          if (facilityStatus === 'maintenance' || facilityStatus === 'unavailable') {
            return res.status(400).json({ 
              message: `This facility is currently ${facilityStatus === 'maintenance' ? 'under maintenance' : 'temporarily unavailable'}. Bookings cannot be made at this time.` 
            });
          }
        }
      } catch (err) {
        console.error('Error checking facility status:', err);
        // Continue with booking if facility check fails
      }
    }

    // Overwrite with header-provided identity
    const { ownerId, ownerRole, ownerEmail, ownerName } = extractOwnerFromHeaders(req);
    const headerOwnerId = normalizeOwnerId(ownerId);
    const bodyOwnerId = normalizeOwnerId(entryData.ownerId);
    entryData.ownerId    = headerOwnerId ?? bodyOwnerId ?? null;
    entryData.ownerRole  = ownerRole  ?? entryData.ownerRole ?? null;
    entryData.ownerEmail = ownerEmail ?? entryData.ownerEmail ?? null;
    entryData.ownerName  = ownerName  ?? entryData.ownerName ?? null;

    if (isEmergencyBooking) {
      const approvedEntry = new ApproveBooking({
        ...entryData,
        originalBookingId: null
      });
      await approvedEntry.save();

      await BookingHistory.create({
        ...entryData,
        status: "Approved",
        actionBy: "system-emergency",
        actionAt: new Date()
      });

      return res.json(approvedEntry);
    }

    const entry = new Booking(entryData);
    await entry.save();

    // return full created doc (frontend uses _id as bookingId for timetable)
    res.json(entry);
  } catch (err) { 
    console.error(err);
    res.status(500).json({ message: "Error saving entry." }); 
  }
});

// My pending bookings (filter)
app.get('/api/my-bookings', async (req, res) => {
  try {
    const { ownerId, email } = req.query;
    const q = { $or: [{ status: { $exists: false } }, { status: "Pending" }] };
    if (ownerId) {
      q.$and = [{ $or: [{ ownerId: ownerId }, { ownerEmail: email }] }];
    } else if (email) {
      q.$and = [{ $or: [{ ownerEmail: email }, { email: email }] }];
    }
    const bookings = await Booking.find(q).sort({ bookingDate: -1 });
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching my bookings' });
  }
});

// Approved bookings (supports filtering by owner)
app.get('/api/approved-bookings', async (req, res) => {
  try {
    const { ownerId, email } = req.query;
    const query = {};
    if (ownerId) {
      query.$or = [{ ownerId: ownerId }, { ownerEmail: email }];
    } else if (email) {
      query.$or = [{ ownerEmail: email }, { email: email }];
    }
    const approved = await ApproveBooking.find(query).sort({ bookingDate: -1 });
    res.json(approved);
  } catch (err) { 
    console.error(err);
    res.status(500).json({ message: 'Error fetching approved bookings' }); 
  }
});

app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const deletedBooking = await Booking.findByIdAndDelete(req.params.id);
    if (!deletedBooking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ message: 'Booking deleted successfully' });
  } catch (err) { res.status(500).json({ message: 'Error deleting booking' }); }
});

// ========== BOOKING APPROVAL & HISTORY (EMAILS) ==========
app.post('/api/approve-bulk', async (req, res) => {
  try {
    let { bookings } = req.body;
    if (!Array.isArray(bookings) || bookings.length === 0)
      return res.status(400).json({ message: "No bookings received." });

    // Normalize + carry owner fields
    bookings = bookings.map(b => ({
      ...b,
      bookingDate: new Date(b.bookingDate),
      cancellationReason: b.cancellationReason || "",
      ownerId: b.ownerId || null,
      ownerRole: b.ownerRole || null,
      ownerEmail: b.ownerEmail || null,
      ownerName: b.ownerName || null
    }));

    // history
    const historyToInsert = bookings.map(b => ({
      ...b,
      status: b.status || "Approved",
      actionBy: "admin",
      actionAt: new Date(),
      cancellationReason: b.cancellationReason || "",
      ownerId: b.ownerId || null,
      ownerRole: b.ownerRole || null,
      ownerEmail: b.ownerEmail || null,
      ownerName: b.ownerName || null
    }));
    await BookingHistory.insertMany(historyToInsert);

    // approved set (include originalBookingId)
    const approvedToAdd = bookings
      .filter(b => (b.status || "Approved") === "Approved")
      .map(b => ({
        ...b,
        originalBookingId: b._id || null,
        ownerId: b.ownerId || null,
        ownerRole: b.ownerRole || null,
        ownerEmail: b.ownerEmail || null,
        ownerName: b.ownerName || null
      }));
    if (approvedToAdd.length > 0) await ApproveBooking.insertMany(approvedToAdd);

    // remove from pending
    const ids = bookings.map(b => b._id).filter(Boolean);
    if (ids.length) {
      await Booking.deleteMany({ _id: { $in: ids } });
    } else {
      for (const b of bookings) {
        await Booking.deleteOne({
          email: b.email,
          bookingDate: b.bookingDate,
          facility: b.facility,
          startTime: b.startTime,
          endTime: b.endTime
        });
      }
    }

    // emails
    for (const booking of bookings) {
      if (!booking.email) continue;
      const mailOptions = {
        from: `"LHMS Admin" <${process.env.EMAIL_USER}>`,
        to: booking.email,
        subject: `Your Booking is ${booking.status || "Approved"}`,
        html: bookingEmailTemplate(booking)
      };
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) console.error("Failed to send mail:", error);
        else console.log("Email sent:", info.response);
      });
    }

    res.json({ message: "Booking(s) actioned and moved to history!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error processing booking actions." });
  }
});

// Booking history
app.get('/api/booking-history', async (req, res) => {
  try {
    const { ownerId, email } = req.query;
    const q = {};
    if (ownerId) q.ownerId = ownerId;
    else if (email) q.ownerEmail = email;
    const history = await BookingHistory.find(q).sort({ actionAt: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: "Error fetching booking history." });
  }
});

// Dashboard totals
app.get('/api/bookings-total', async (req, res) => {
  try {
    const pendingCount = await Booking.countDocuments();
    const approvedCount = await ApproveBooking.countDocuments();
    res.json({ total: pendingCount + approvedCount });
  } catch (err) { res.status(500).json({ message: 'Error counting bookings' }); }
});
app.get('/api/approved-bookings-total', async (req, res) => {
  try {
    const total = await ApproveBooking.countDocuments();
    res.json({ total });
  } catch (err) { res.status(500).json({ message: 'Error counting approved bookings' }); }
});
app.get('/api/pending-bookings-total', async (req, res) => {
  try {
    const total = await Booking.countDocuments();
    res.json({ total });
  } catch (err) { res.status(500).json({ message: 'Error counting pending bookings' }); }
});

/* =================== Complaints (logDB) + Inbox + SSE =================== */
const complaintSchema = new mongoose.Schema({
  subject:  { type: String, enum: ['booking-issue','technical-support','schedule-conflict','facility-problem','general-inquiry','other'], required: true },
  message:  { type: String, required: true, trim: true },
  priority: { type: String, enum: ['low','medium','high','critical'], required: true },
  status:   { type: String, enum: ['open','in-progress','closed'], default: 'open', index: true },
  isRead:   { type: Boolean, default: false, index: true },
  readAt:   { type: Date },
  user: {
    id:    { type: mongoose.Schema.Types.ObjectId },
    email: { type: String, index: true, sparse: true },
    name:  String,
    role:  String,
    meta:  { inferredFrom: String, verified: { type: Boolean, default: false } }
  },
  context: { page: String, ua: String },

  // NEW: store outbound replies
  replies: [{
    subject: String,
    message: String,
    from: String,
    sentAt: { type: Date, default: Date.now }
  }]
}, { collection: 'complains', timestamps: true });

const Complaint = logDB.model('Complaint', complaintSchema);

// Create complaint (public — from user site)
app.post('/api/complains', async (req, res) => {
  try {
    const { subject, message, priority, user = {}, context = {} } = req.body || {};
    if (!subject || !message || !priority) {
      return res.status(400).json({ error: 'subject, message, and priority are required' });
    }
    const doc = await Complaint.create({ subject, message, priority, user, context });

    // optional notify admin by email
    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"LHMS" <${process.env.EMAIL_USER}>`,
          to: process.env.ADMIN_EMAIL || 'admin@lhms.edu',
          subject: `New Complaint: ${subject} [${priority}]`,
          html: `
            <p><b>From:</b> ${user?.name || '—'} (${user?.email || '—'})</p>
            <p><b>Priority:</b> ${priority}</p>
            <p><b>Message:</b><br>${message}</p>
            ${(context?.page || context?.ua) ? `<hr><p><b>Context</b><br>Page: ${context?.page || '—'}<br>UA: ${context?.ua || '—'}</p>` : ''}
          `
        });
      } catch (e) { console.warn('[complains] email send failed:', e.message); }
    }

    broadcastComplainEvent({ op: 'insert', id: String(doc._id) }); // SSE
    return res.status(201).json({ id: String(doc._id), createdAt: doc.createdAt });
  } catch (err) {
    console.error('Create complain failed:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: list inbox (mapped for UI)
app.get('/api/inbox', requireAdmin, async (_req, res) => {
  try {
    const items = await Complaint.find().sort({ createdAt: -1 }).limit(500).lean();

    const out = items.map(x => ({
      _id: String(x._id),
      subject: x.subject,
      message: x.message,
      priority: x.priority,
      status: x.status,
      isRead: !!x.isRead,
      readAt: x.readAt || null,

      // 👇 add these two top-level fields for the UI
      fullname: x.user?.name || x.user?.fullName || '',
      email:    x.user?.email || '',

      // keep the nested user if you still want it
      user: {
        id: x.user?.id || null,
        name: x.user?.name || '',
        email: x.user?.email || '',
        role: x.user?.role || '',
        meta: x.user?.meta || undefined
      },

      createdAt: x.createdAt
    }));

    res.json(out);
  } catch (err) {
    console.error('Inbox list failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: unread count (for red dot)
app.get('/api/inbox/unread-count', requireAdmin, async (_req, res) => {
  try {
    const count = await Complaint.countDocuments({ isRead: false });
    res.json({ count });
  } catch (err) {
    console.error('Unread count failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: mark single complaint as read
app.patch('/api/complains/:id/read', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Complaint.findByIdAndUpdate(
      id, { $set: { isRead: true, readAt: new Date() } }, { new: true }
    );
    if (!doc) return res.status(404).json({ error: 'Not found' });
    broadcastComplainEvent({ op: 'update', id: String(doc._id) });
    res.json({ ok: true });
  } catch (err) {
    console.error('Mark read failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// NEW: Admin sends a reply to a complaint (email + log)
app.post('/api/complains/:id/reply', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, message } = req.body || {};
    if (!subject || !message) {
      return res.status(400).json({ error: 'subject and message are required' });
    }

    const doc = await Complaint.findById(id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const to = doc.user?.email;
    if (!to) return res.status(400).json({ error: 'No recipient email on complaint' });

    if (transporter) {
      await transporter.sendMail({
        from: `"LHMS Admin" <${process.env.EMAIL_USER || 'no-reply@lhms.local'}>`,
        to,
        subject,
        html: `
          <div style="font-family:Arial,sans-serif">
            <p>${String(message).replace(/\n/g,'<br>')}</p>
            <hr>
            <p style="color:#555"><b>Re:</b> ${doc.subject}</p>
            <blockquote style="color:#555">${String(doc.message||'').replace(/\n/g,'<br>')}</blockquote>
          </div>`
      });
    }

    await Complaint.findByIdAndUpdate(id, {
      $push: {
        replies: {
          subject,
          message,
          from: process.env.EMAIL_USER || 'admin',
          sentAt: new Date()
        }
      }
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[complain reply] failed:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/* ======== SSE for complaints (red dot + live refresh) ======== */
const complainClients = [];
app.get('/api/stream/complains', (req, res) => {
  res.set({ 'Content-Type':'text/event-stream', 'Cache-Control':'no-store', 'Connection':'keep-alive' });
  res.flushHeaders();
  res.write(': ok\n\n');
  complainClients.push(res);
  req.on('close', () => {
    const i = complainClients.indexOf(res);
    if (i !== -1) complainClients.splice(i, 1);
  });
});
function broadcastComplainEvent(payload){
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  complainClients.forEach(c => { try { c.write(data); } catch {} });
}
setInterval(()=> complainClients.forEach(c => { try { c.write(':\n\n'); } catch {} }), 30000);

// Change stream (optional, only if replica set) to push DB changes to SSE as well
try {
  Complaint.watch([], { fullDocument: 'updateLookup' }).on('change', ch => {
    broadcastComplainEvent({ op: ch.operationType, id: ch.documentKey?._id });
  });
} catch (e) {
  console.warn('Complaint change stream not available (non-replica set).');
}

// Admin: delete a complaint
app.delete('/api/complains/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Complaint.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    // ping SSE listeners so the red dot/list can refresh if you want
    try { broadcastComplainEvent({ op: 'delete', id: String(id) }); } catch {}
    return res.json({ ok: true });
  } catch (err) {
    console.error('[complain delete] failed:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});



// ========== TIMETABLE MANAGEMENT ==========

// Normal (user) booking for a single day (no admin key)
app.post('/api/timetable/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    const decodedCollection = decodeURIComponent(collection);
    const { date, times, bookedBy, bookingId, faculty, eventType, additionalNotes, fullname, email, phone, position } = req.body;
    if (!decodedCollection || !date || !times || !bookedBy)
      return res.status(400).json({ error: "Missing required fields" });

    const Timetable = getOrCreateTimetableModel(decodedCollection);
    for (let time of times) {
      await Timetable.updateOne(
        { date, time },
        { $set: { 
          status: "booked", 
          bookedBy, 
          bookingId,
          faculty: faculty || null,
          eventType: eventType || null,
          additionalNotes: additionalNotes || null,
          fullname: fullname || bookedBy,
          email: email || null,
          phone: phone || null,
          position: position || null
        } },
        { upsert: true }
      );
    }
    res.json({ message: "Slots booked successfully!" });
  } catch (err) { res.status(500).json({ error: "Error booking slots" }); }
});

// Fetch timetable (no-cache so the UI refreshes)
app.get('/api/timetable/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    const decodedCollection = decodeURIComponent(collection);
    const { start, end } = req.query;
    if (!decodedCollection || !start || !end)
      return res.status(400).json({ error: "Missing parameters" });

    res.set('Cache-Control', 'no-store'); // prevent caching old results
    const Model = getOrCreateTimetableModel(decodedCollection);
    const results = await Model.find({ date: { $gte: start, $lte: end }, status: "booked" });
    res.json(results);
  } catch (err) { res.status(500).json({ error: "Failed to fetch timetable slots" }); }
});

// Generate empty slots
app.post('/api/timetable/:collection/generate', async (req, res) => {
  try {
    const { collection } = req.params;
    const decodedCollection = decodeURIComponent(collection);
    const { startDate, days } = req.body;
    if (!decodedCollection || !startDate)
      return res.status(400).json({ error: "Missing parameters" });

    const Timetable = getOrCreateTimetableModel(decodedCollection);
    const times = [
      "8.00-9.00","9.00-10.00","10.00-11.00","11.00-12.00",
      "12.00-13.00","13.00-14.00","14.00-15.00","15.00-16.00","16.00-17.00"
    ];
    for (let d = 0; d < (days || 7); d++) {
      const dateObj = new Date(startDate);
      dateObj.setDate(dateObj.getDate() + d);
      const dateStr = dateObj.toISOString().split('T')[0];
      for (let time of times) {
        await Timetable.updateOne(
          { date: dateStr, time },
          { $setOnInsert: { status: "available" } },
          { upsert: true }
        );
      }
    }
    res.json({ message: "Slots generated successfully!" });
  } catch (err) { res.status(500).json({ error: "Failed to generate slots" }); }
});

// ===== ADMIN: Bulk timetable booking (multi days/times) =====
app.post('/api/timetable/:collection/bulk', requireAdmin, async (req, res) => {
  try {
    const { collection } = req.params;
    const decodedCollection = decodeURIComponent(collection);
    const { entries, bookedBy, bookingId } = req.body;
    if (!decodedCollection || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'Missing collection or entries' });
    }
    const Timetable = getOrCreateTimetableModel(decodedCollection);
    for (const e of entries) {
      if (!e?.date || !Array.isArray(e.times) || e.times.length === 0) continue;
      for (const t of e.times) {
        await Timetable.updateOne(
          { date: e.date, time: t },
          { $set: { status: 'booked', bookedBy: bookedBy || 'admin', bookingId: bookingId || '' } },
          { upsert: true }
        );
      }
    }
    return res.json({ message: 'Bulk slots booked successfully!' });
  } catch (err) {
    console.error('[Bulk Timetable Error]', err);
    return res.status(500).json({ error: 'Error in bulk booking' });
  }
});

// ===== ADMIN: Release one booked slot =====
app.delete('/api/timetable/:collection', requireAdmin, async (req, res) => {
  try {
    const { collection } = req.params;
    const decodedCollection = decodeURIComponent(collection);
    const { date, time } = req.body || {};
    if (!decodedCollection || !date || !time) {
      return res.status(400).json({ error: 'Missing collection, date or time' });
    }
    const Timetable = getOrCreateTimetableModel(decodedCollection);
    const result = await Timetable.deleteOne({ date, time });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Slot not found' });
    }
    return res.json({ message: 'Slot released successfully' });
  } catch (err) {
    console.error('[Release Slot Error]', err);
    return res.status(500).json({ error: 'Failed to release slot' });
  }
});

// ========== AUTOMATIC TIMETABLE SLOT CLEANUP ==========
cron.schedule('0 * * * *', async () => {
  console.log('[Timetable Cleanup] Running...');
  try {
    const collections = await facilitiesDB.db.listCollections().toArray();
    const timetableCollections = collections
      .map(c => c.name)
      .filter(name => name.endsWith('_timetable'));
    const now = new Date();
    const nowISO = now.toISOString().slice(0, 10);

    const allTimes = [
      "8.00-9.00","9.00-10.00","10.00-11.00","11.00-12.00",
      "12.00-13.00","13.00-14.00","14.00-15.00","15.00-16.00","16.00-17.00"
    ];

    function getPassedSlotsForToday() {
      const current = now.getHours() + now.getMinutes()/60;
      let passed = [];
      for (const t of allTimes) {
        const [ , to] = t.split('-');
        const [toH, toM] = to.split('.').map(Number);
        const slotEnd = toH + (toM ? toM/60 : 0);
        if (current >= slotEnd) passed.push(t);
      }
      return passed;
    }

    for (const collection of timetableCollections) {
      const Timetable = getOrCreateTimetableModel(collection);
      await Timetable.deleteMany({ date: { $lt: nowISO } });
      const passedSlots = getPassedSlotsForToday();
      if (passedSlots.length > 0) {
        await Timetable.deleteMany({ date: nowISO, time: { $in: passedSlots } });
      }
    }
    console.log('[Timetable Cleanup] Complete.');
  } catch (err) {
    console.error('[Timetable Cleanup] Error:', err);
  }
});

// ========== AUTOMATIC APPROVED BOOKINGS CLEANUP ==========
cron.schedule('0 * * * *', async () => {
  console.log('[ApproveBooking Cleanup] Running...');
  try {
    const now = new Date();
    const bookings = await ApproveBooking.find({});
    for (const booking of bookings) {
      let endHour = 23, endMin = 59;
      if (typeof booking.endTime === "string" && booking.endTime.includes('-')) {
        let end = booking.endTime.split('-')[1];
        let [h, m] = end.split('.').map(Number);
        endHour = h ?? 23;
        endMin = m ?? 0;
      } else if (typeof booking.endTime === "string" && booking.endTime.includes(':')) {
        let [h, m] = booking.endTime.split(':').map(Number);
        endHour = h ?? 23;
        endMin = m ?? 0;
      }
      const bookingEnd = new Date(booking.bookingDate);
      bookingEnd.setHours(endHour, endMin, 0, 0);
      if (bookingEnd < now) {
        await ApproveBooking.findByIdAndDelete(booking._id);
      }
    }
    console.log('[ApproveBooking Cleanup] Complete.');
  } catch (err) {
    console.error('[ApproveBooking Cleanup] Error:', err);
  }
});

// ========== HISTORY-BACKED TIMETABLE ENDPOINT ==========
app.get('/api/history-timetable', async (req, res) => {
  try {
    const { facility, start, end, status = "Approved" } = req.query;
    if (!facility || !start || !end) {
      return res.status(400).json({ error: "Missing facility, start or end" });
    }
    const startDate = new Date(start + 'T00:00:00.000Z');
    const endDate   = new Date(end   + 'T23:59:59.999Z');

    const items = await BookingHistory.find({
      facility,
      status,
      bookingDate: { $gte: startDate, $lte: endDate }
    }).lean();

    const SLOT_LABELS = [
      "8.00-9.00","9.00-10.00","10.00-11.00","11.00-12.00",
      "12.00-13.00","13.00-14.00","14.00-15.00","15.00-16.00","16.00-17.00"
    ];

    const toNum = (t) => {
      if (!t) return NaN;
      const s = String(t).replace(':', '.');
      const [h, m] = s.split('.').map(n => parseInt(n || '0', 10));
      return (isNaN(h) ? 0 : h) + ((isNaN(m) ? 0 : m) / 60);
    };

    const labelFor = (h) => `${h}.00-${h+1}.00`;

    const out = [];
    for (const b of items) {
      const isoDate = new Date(b.bookingDate).toISOString().slice(0,10);
      const from = Math.floor(toNum(b.startTime));
      const to   = Math.ceil(toNum(b.endTime));
      for (let h = from; h < to; h++) {
        const lbl = labelFor(h);
        if (SLOT_LABELS.includes(lbl)) {
          out.push({
            date: isoDate,
            time: lbl,
            status: "booked",
            bookedBy: b.fullname || "history",
            bookingId: (b._id || "").toString(),
            source: "history"
          });
        }
      }
    }
    res.set('Cache-Control', 'no-store');
    return res.json(out);
  } catch (err) {
    console.error('[History Timetable Error]', err);
    return res.status(500).json({ error: "Failed to fetch history timetable" });
  }
});
// ===== TODAY'S TIMETABLE (live from ApproveBooking) =====
app.get('/api/today-timetable', async (req, res) => {
  try {
    const { facility } = req.query; // optional filter

    // Calculate today's date range
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const q = { bookingDate: { $gte: today, $lt: tomorrow } };
    if (facility) q.facility = facility;

    const items = await ApproveBooking.find(q).lean();

    // Format for frontend
    const rows = items.map(b => ({
      id: String(b._id),
      facility: b.facility || '—',
      title: b.purpose || b.description || 'Booked',
      startTime: b.startTime || '',
      endTime: b.endTime || '',
      organizer: b.fullname || '—'
    }));

    // Sort by start time
    const toNum = (t) => {
      if (!t) return Infinity;
      const s = String(t).replace(':','.');
      const [h,m] = s.split('.').map(n => parseInt(n||'0',10));
      return (isNaN(h)?0:h) + ((isNaN(m)?0:m)/60);
    };
    rows.sort((a,b) => toNum(a.startTime) - toNum(b.startTime));

    res.set('Cache-Control', 'no-store');
    res.json(rows);
  } catch (err) {
    console.error('[today-timetable] error', err);
    res.status(500).json({ message: 'Failed to load today timetable' });
  }
});

// ========== ROOT ==========
app.get('/', (req, res) => { res.send('Server is up and running 🚀'); });

// ========== SSE: Live Booking Updates ==========
// Keep a list of open SSE clients
const sseClients = [];

// EventSource endpoint (matches user.html)
app.get('/api/stream/bookings', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store',
    'Connection': 'keep-alive'
  });
  res.flushHeaders();
  res.write(': connected\n\n'); // comment event, useful for proxies

  sseClients.push(res);

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// Broadcast helper
function broadcastBookingUpdate(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try { client.write(payload); } catch {}
  });
}

// Watch MongoDB change streams (Atlas/replica set required)
function watchBookings() {
  const opts = { fullDocument: 'updateLookup' };

  try {
    Booking.watch([], opts).on('change', change => {
      broadcastBookingUpdate({
        kind: 'pending',
        op: change.operationType,
        id: change.documentKey?._id,
        doc: change.fullDocument || null
      });
    });

    ApproveBooking.watch([], opts).on('change', change => {
      broadcastBookingUpdate({
        kind: 'approved',
        op: change.operationType,
        id: change.documentKey?._id,
        doc: change.fullDocument || null
      });
    });
  } catch (e) {
    console.error('Change streams are unavailable (need replica set). Falling back to no-op.', e.message);
  }
}
watchBookings();

// Heartbeat (prevents idle disconnects)
setInterval(() => {
  sseClients.forEach(res => {
    try { res.write(':\n\n'); } catch {}
  });
}, 30000);

// Start
const PORT = 3000;
app.listen(PORT, () => { 
  console.log(`Server running on port ${PORT}`);
  console.log(`\n🌐 Opening browser...`);
  
  // Auto-open browser
  const { exec } = require('child_process');
  exec(`start http://localhost:${PORT}/index.html`);
  
  console.log(`\n📍 Available pages:`);
  console.log(`   http://localhost:${PORT}/index.html`);
  console.log(`   http://localhost:${PORT}/adminMAIN.html`);
  console.log(`   http://localhost:${PORT}/facilitiesVIEW.html\n`);
});


