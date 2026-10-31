import express, { type Request, type Response, type NextFunction } from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || "event_manager_campus_secret_key_2026";
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "event_manager_db.json");

interface UserRecord {
  id: string;
  username: string;
  password_salt: string;
  password_hash: string;
  full_name: string;
  email: string;
  phone: string;
  department: string;
  role: "STUDENT" | "ORGANIZER";
  base_events_count?: number;
  created_at: string;
}

interface ParticipantMember {
  name: string;
  email: string;
  phone: string;
  roll_no?: string;
  department?: string;
}

interface EventRecord {
  id: string;
  title: string;
  category: string;
  description: string;
  venue: string;
  event_date: string;
  event_time: string;
  registration_deadline: string;
  cost: number;
  prizes?: string;
  max_capacity: number | null;
  show_remaining_seats?: boolean;
  min_team_size: number;
  max_team_size: number;
  organizer_id: string;
  organizer_name: string;
  organizer_phone: string;
  image_url: string;
  participants_count: number;
  is_completed?: boolean;
  created_at: string;
}

interface RegistrationRecord {
  id: string;
  reference_code: string;
  event_id: string;
  student_id: string;
  student_name: string;
  student_username: string;
  team_name?: string;
  participants: ParticipantMember[];
  participant_count: number;
  notes?: string;
  checked_in?: boolean;
  checked_in_at?: string;
  registered_at: string;
}

interface FAQRecord {
  id: string;
  event_id: string;
  question: string;
  asked_by_name: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
}

interface EventAnnouncementRecord {
  id: string;
  event_id: string;
  title: string;
  message: string;
  is_urgent?: boolean;
  created_at: string;
}

interface OrganizerFeedbackRecord {
  id: string;
  organizer_id: string;
  event_id?: string;
  event_title?: string;
  rating: number; // 1 to 5 stars
  comment: string;
  created_at: string;
}

interface DatabaseSchema {
  users: UserRecord[];
  events: EventRecord[];
  registrations: RegistrationRecord[];
  faqs: FAQRecord[];
  announcements: EventAnnouncementRecord[];
  feedbacks: OrganizerFeedbackRecord[];
}

function loadDatabaseSync(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const freshDb: DatabaseSchema = {
    users: [],
    events: [],
    registrations: [],
    faqs: [],
    announcements: [],
    feedbacks: [],
  };

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(freshDb, null, 2), "utf-8");
    return freshDb;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      registrations: Array.isArray(parsed.registrations) ? parsed.registrations : [],
      faqs: Array.isArray(parsed.faqs) ? parsed.faqs : [],
      announcements: Array.isArray(parsed.announcements) ? parsed.announcements : [],
      feedbacks: Array.isArray(parsed.feedbacks) ? parsed.feedbacks : [],
    };
  } catch {
    return freshDb;
  }
}

const db: DatabaseSchema = loadDatabaseSync();

let writeQueue: Promise<void> = Promise.resolve();
function persistDb(): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    const tmp = `${DB_FILE}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(db, null, 2), "utf-8");
    await fsp.rename(tmp, DB_FILE);
  });
  return writeQueue;
}

function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, actualSalt, 64).toString("hex");
  return { salt: actualSalt, hash: derived };
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(expectedHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function ensureCampusPeers(database: DatabaseSchema): void {
  const existingUsernames = new Set(database.users.map((u) => u.username));
  const peers = [
    {
      username: "priya_p",
      full_name: "Priya Patel",
      email: "priya.patel@college.edu",
      phone: "9876500111",
      department: "CSE · 3rd Year",
      base_events_count: 4, // 40 XP
    },
    {
      username: "aarav_s",
      full_name: "Aarav Sharma",
      email: "aarav.sharma@college.edu",
      phone: "9876500222",
      department: "Mechanical · Final Year",
      base_events_count: 3, // 30 XP
    },
    {
      username: "ananya_i",
      full_name: "Ananya Iyer",
      email: "ananya.iyer@college.edu",
      phone: "9876500333",
      department: "ECE · 2nd Year",
      base_events_count: 2, // 20 XP
    },
    {
      username: "rohan_n",
      full_name: "Rohan Nair",
      email: "rohan.nair@college.edu",
      phone: "9876500444",
      department: "Information Tech · 1st Year",
      base_events_count: 1, // 10 XP
    },
  ];

  let added = false;
  for (const peer of peers) {
    if (!existingUsernames.has(peer.username)) {
      const { salt, hash } = hashPassword("campus123");
      database.users.push({
        id: crypto.randomUUID(),
        username: peer.username,
        password_salt: salt,
        password_hash: hash,
        full_name: peer.full_name,
        email: peer.email,
        phone: peer.phone,
        department: peer.department,
        role: "STUDENT",
        base_events_count: peer.base_events_count,
        created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      });
      added = true;
    }
  }
  if (added) {
    persistDb().catch((err) => console.error("Failed to persist seeded peers", err));
  }
}

ensureCampusPeers(db);

function signToken(payload: { sub: string; username: string; role: string }): string {
  const exp = Date.now() + 72 * 60 * 60 * 1000;
  const data = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifyToken(token: string): { sub: string; username: string; role: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  if (sig !== expectedSig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf-8")) as {
      sub: string;
      username: string;
      role: string;
      exp: number;
    };
    if (Date.now() > parsed.exp) return null;
    return { sub: parsed.sub, username: parsed.username, role: parsed.role };
  } catch {
    return null;
  }
}

function getUserStats(userId: string): { xp: number; events_registered_count: number } {
  const regCount = db.registrations.filter((r) => r.student_id === userId).length;
  const user = db.users.find((u) => u.id === userId);
  const baseCount = (user as any)?.base_events_count || 0;
  const totalCount = regCount + baseCount;
  return {
    xp: totalCount * 10,
    events_registered_count: totalCount,
  };
}

function sanitizeUser(u: UserRecord) {
  const stats = u.role === "STUDENT" ? getUserStats(u.id) : { xp: 0, events_registered_count: 0 };
  return {
    id: u.id,
    username: u.username,
    full_name: u.full_name,
    email: u.email,
    phone: u.phone,
    department: u.department,
    role: u.role,
    xp: stats.xp,
    events_registered_count: stats.events_registered_count,
    created_at: u.created_at,
  };
}

function getLocalTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isEventCompleted(e: EventRecord, todayStr: string): boolean {
  if (e.is_completed) return true;
  if (e.event_date && e.event_date < todayStr) return true;
  if (e.registration_deadline && e.registration_deadline < todayStr) return true;
  return false;
}

interface AuthedRequest extends Request {
  currentUser?: UserRecord;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ detail: "Authentication required. Please sign in." });
    return;
  }
  const token = authHeader.slice("Bearer ".length).trim();
  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({ detail: "Invalid or expired session. Please sign in again." });
    return;
  }
  const user = db.users.find((u) => u.id === decoded.sub);
  if (!user) {
    res.status(401).json({ detail: "User account not found." });
    return;
  }
  req.currentUser = user;
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  // Health Check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Check if username exists
  app.get("/api/auth/check-username", (req, res) => {
    const username = String(req.query.username || "").trim().toLowerCase();
    if (!username) {
      res.json({ exists: false });
      return;
    }
    const existing = db.users.find((u) => u.username === username);
    if (existing) {
      res.json({
        exists: true,
        role: existing.role,
        message: `An account for "${existing.username}" already exists (${existing.role}). Switch to Sign In to access it.`,
      });
      return;
    }
    res.json({ exists: false });
  });

  // Register New User
  app.post("/api/auth/register", async (req, res) => {
    const { username, password, full_name, email, phone, department, role } = req.body as Record<
      string,
      string
    >;

    const cleanUsername = String(username || "").trim().toLowerCase();
    const cleanName = String(full_name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPhone = String(phone || "").trim();
    const cleanDept = String(department || "").trim();
    const cleanRole = role === "ORGANIZER" ? "ORGANIZER" : "STUDENT";

    if (cleanUsername.length < 3) {
      res.status(400).json({ detail: "Username must be at least 3 characters." });
      return;
    }
    if (!password || String(password).length < 6) {
      res.status(400).json({ detail: "Password must be at least 6 characters." });
      return;
    }
    if (!cleanName) {
      res.status(400).json({ detail: "Full name is required." });
      return;
    }
    if (!cleanEmail || !cleanEmail.includes("@")) {
      res.status(400).json({ detail: "A valid email address is required." });
      return;
    }

    const existing = db.users.find(
      (u) => u.username === cleanUsername || u.email === cleanEmail
    );
    if (existing) {
      res.status(409).json({
        detail: {
          code: "ACCOUNT_EXISTS",
          role: existing.role,
          username: existing.username,
          message:
            existing.username === cleanUsername
              ? `Account "${existing.username}" already exists. Switch to existing account Sign In.`
              : `An account with email "${cleanEmail}" already exists (@${existing.username}). Switch to existing account Sign In.`,
        },
      });
      return;
    }

    const { salt, hash } = hashPassword(String(password));
    const newUser: UserRecord = {
      id: crypto.randomUUID(),
      username: cleanUsername,
      password_salt: salt,
      password_hash: hash,
      full_name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      department: cleanDept,
      role: cleanRole,
      created_at: new Date().toISOString(),
    };

    db.users.push(newUser);
    await persistDb();

    const token = signToken({
      sub: newUser.id,
      username: newUser.username,
      role: newUser.role,
    });
    res.status(201).json({ token, user: sanitizeUser(newUser) });
  });

  // Login
  app.post("/api/auth/login", (req, res) => {
    const { username, password, role } = req.body as Record<string, string>;
    const cleanUsername = String(username || "").trim().toLowerCase();
    const user = db.users.find(
      (u) => u.username === cleanUsername || u.email === cleanUsername
    );

    if (!user || !verifyPassword(String(password || ""), user.password_salt, user.password_hash)) {
      res.status(401).json({ detail: "Invalid username or password." });
      return;
    }

    if (role && user.role !== role) {
      res.status(403).json({
        detail: `This account is registered as ${user.role}. Please select ${user.role} above to sign in.`,
        expectedRole: user.role,
      });
      return;
    }

    const token = signToken({
      sub: user.id,
      username: user.username,
      role: user.role,
    });
    res.json({ token, user: sanitizeUser(user) });
  });

  // Me
  app.get("/api/auth/me", requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: sanitizeUser(req.currentUser!) });
  });

  // Change Password by verifying current password
  app.post("/api/auth/change-password", requireAuth, async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const { old_password, new_password, confirm_password } = req.body as Record<string, string>;

    if (!old_password) {
      res.status(400).json({ detail: "Please provide your current password." });
      return;
    }

    if (!verifyPassword(String(old_password), user.password_salt, user.password_hash)) {
      res.status(400).json({ detail: "The current password you entered is incorrect." });
      return;
    }

    if (!new_password || String(new_password).length < 6) {
      res.status(400).json({ detail: "New password must be at least 6 characters." });
      return;
    }

    if (confirm_password !== undefined && new_password !== confirm_password) {
      res.status(400).json({ detail: "New password and confirmation do not match." });
      return;
    }

    if (old_password === new_password) {
      res.status(400).json({ detail: "New password cannot be the same as your current password." });
      return;
    }

    const { salt, hash } = hashPassword(String(new_password));
    user.password_salt = salt;
    user.password_hash = hash;
    await persistDb();

    res.json({ message: "Password updated successfully!" });
  });

  // Student XP Leaderboard - Top 5 students with highest XP (+10 XP per event)
  app.get("/api/leaderboard", (_req, res) => {
    const students = db.users.filter((u) => u.role === "STUDENT");

    const entries = students.map((s) => {
      const stats = getUserStats(s.id);
      return {
        id: s.id,
        full_name: s.full_name,
        username: s.username,
        department: s.department || "General",
        xp: stats.xp,
        events_registered_count: stats.events_registered_count,
      };
    });

    entries.sort((a, b) => {
      if (b.xp !== a.xp) return b.xp - a.xp;
      if (b.events_registered_count !== a.events_registered_count) {
        return b.events_registered_count - a.events_registered_count;
      }
      return a.full_name.localeCompare(b.full_name);
    });

    const top5 = entries.slice(0, 5).map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    res.json({ leaderboard: top5, total_students: entries.length });
  });

  // Distinct Hosts for filtering
  app.get("/api/events/hosts", (_req, res) => {
    const todayStr = getLocalTodayDateString();
    const activeList = db.events.filter((e) => !isEventCompleted(e, todayStr));
    const hostMap = new Map<string, string>();
    for (const ev of activeList) {
      if (ev.organizer_name) {
        hostMap.set(ev.organizer_name, ev.organizer_id);
      }
    }
    // Also include organizers from user records
    for (const u of db.users) {
      if (u.role === "ORGANIZER" && u.full_name) {
        hostMap.set(u.full_name, u.id);
      }
    }
    const hosts = Array.from(hostMap.keys()).sort();
    res.json({ hosts });
  });

  // List Active Events (COMPLETED EVENTS ARE REMOVED FROM WEBSITE)
  app.get("/api/events", (req, res) => {
    const search = String(req.query.search || "").trim().toLowerCase();
    const category = String(req.query.category || "").trim().toLowerCase();
    const host = String(req.query.host || "").trim().toLowerCase();
    const todayStr = getLocalTodayDateString();

    // Only active (not completed) events appear on the website explore section
    let activeList = db.events.filter((e) => !isEventCompleted(e, todayStr));

    if (category && category !== "all") {
      activeList = activeList.filter((e) => e.category.toLowerCase() === category);
    }
    if (host && host !== "all") {
      activeList = activeList.filter(
        (e) =>
          e.organizer_name.toLowerCase() === host ||
          e.organizer_id.toLowerCase() === host
      );
    }
    if (search) {
      activeList = activeList.filter(
        (e) =>
          e.title.toLowerCase().includes(search) ||
          e.description.toLowerCase().includes(search) ||
          e.venue.toLowerCase().includes(search) ||
          e.organizer_name.toLowerCase().includes(search) ||
          e.category.toLowerCase().includes(search)
      );
    }

    activeList.sort((a, b) => a.event_date.localeCompare(b.event_date));
    res.json({ events: activeList });
  });

  // Top 5 Active Events by Registration Count
  app.get("/api/events/top", (_req, res) => {
    const todayStr = getLocalTodayDateString();
    const activeList = db.events.filter((e) => !isEventCompleted(e, todayStr));

    const sorted = [...activeList]
      .sort((a, b) => {
        if (b.participants_count !== a.participants_count) {
          return b.participants_count - a.participants_count;
        }
        return b.created_at.localeCompare(a.created_at);
      })
      .slice(0, 5);

    res.json({ events: sorted });
  });

  // Event Details + FAQs + Announcements
  app.get("/api/events/:id", (req, res) => {
    const event = db.events.find((e) => e.id === req.params.id);
    if (!event) {
      res.status(404).json({ detail: "Event not found." });
      return;
    }
    const faqs = db.faqs
      .filter((f) => f.event_id === event.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const announcements = db.announcements
      .filter((a) => a.event_id === event.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json({ event, faqs, announcements });
  });

  // Create Event (Organizer)
  app.post("/api/events", requireAuth, async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (user.role !== "ORGANIZER") {
      res.status(403).json({ detail: "Only organizers can create events." });
      return;
    }

    const {
      title,
      category,
      description,
      venue,
      event_date,
      event_time,
      registration_deadline,
      cost,
      prizes,
      max_capacity,
      show_remaining_seats,
      min_team_size,
      max_team_size,
      organizer_phone,
      image_url,
      initial_faqs,
    } = req.body;

    if (!title || !category || !description || !venue || !event_date || !event_time || !registration_deadline || !organizer_phone) {
      res.status(400).json({ detail: "Please fill in all required event details." });
      return;
    }

    const nowIso = new Date().toISOString();
    const newEvent: EventRecord = {
      id: crypto.randomUUID(),
      title: String(title).trim(),
      category: String(category).trim(),
      description: String(description).trim(),
      venue: String(venue).trim(),
      event_date: String(event_date).trim(),
      event_time: String(event_time).trim(),
      registration_deadline: String(registration_deadline).trim(),
      cost: Math.max(0, Number(cost || 0)),
      prizes: prizes ? String(prizes).trim() : undefined,
      max_capacity: max_capacity ? Math.max(1, Number(max_capacity)) : null,
      show_remaining_seats: Boolean(show_remaining_seats),
      min_team_size: Math.max(1, Number(min_team_size || 1)),
      max_team_size: Math.max(1, Number(max_team_size || 4)),
      organizer_id: user.id,
      organizer_name: user.full_name,
      organizer_phone: String(organizer_phone).trim(),
      image_url: String(image_url || "").trim(),
      participants_count: 0,
      is_completed: false,
      created_at: nowIso,
    };

    db.events.push(newEvent);

    if (Array.isArray(initial_faqs)) {
      for (const item of initial_faqs) {
        if (item?.question && String(item.question).trim()) {
          db.faqs.push({
            id: crypto.randomUUID(),
            event_id: newEvent.id,
            question: String(item.question).trim(),
            asked_by_name: user.full_name,
            answer: item?.answer ? String(item.answer).trim() : null,
            answered_at: item?.answer ? nowIso : null,
            created_at: nowIso,
          });
        }
      }
    }

    await persistDb();
    res.status(201).json({ event: newEvent });
  });

  // Update Event
  app.put("/api/events/:id", requireAuth, async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (user.role !== "ORGANIZER") {
      res.status(403).json({ detail: "Only organizers can update events." });
      return;
    }
    const event = db.events.find((e) => e.id === req.params.id);
    if (!event) {
      res.status(404).json({ detail: "Event not found." });
      return;
    }
    if (event.organizer_id !== user.id) {
      res.status(403).json({ detail: "You can only update events you created." });
      return;
    }

    const fields = req.body as Partial<EventRecord>;
    if (fields.title !== undefined) event.title = String(fields.title).trim();
    if (fields.category !== undefined) event.category = String(fields.category).trim();
    if (fields.description !== undefined) event.description = String(fields.description).trim();
    if (fields.venue !== undefined) event.venue = String(fields.venue).trim();
    if (fields.event_date !== undefined) event.event_date = String(fields.event_date).trim();
    if (fields.event_time !== undefined) event.event_time = String(fields.event_time).trim();
    if (fields.registration_deadline !== undefined) {
      event.registration_deadline = String(fields.registration_deadline).trim();
    }
    if (fields.cost !== undefined) event.cost = Math.max(0, Number(fields.cost));
    if (fields.prizes !== undefined) event.prizes = String(fields.prizes || "").trim() || undefined;
    if (fields.max_capacity !== undefined) {
      event.max_capacity = fields.max_capacity ? Math.max(1, Number(fields.max_capacity)) : null;
    }
    if (fields.show_remaining_seats !== undefined) {
      event.show_remaining_seats = Boolean(fields.show_remaining_seats);
    }
    if (fields.min_team_size !== undefined) {
      event.min_team_size = Math.max(1, Number(fields.min_team_size || 1));
    }
    if (fields.max_team_size !== undefined) {
      event.max_team_size = Math.max(1, Number(fields.max_team_size || 4));
    }
    if (fields.organizer_phone !== undefined) {
      event.organizer_phone = String(fields.organizer_phone).trim();
    }
    if (fields.image_url !== undefined) {
      event.image_url = String(fields.image_url).trim();
    }
    if (fields.is_completed !== undefined) {
      event.is_completed = Boolean(fields.is_completed);
    }

    await persistDb();
    res.json({ event });
  });

  // Delete Event
  app.delete("/api/events/:id", requireAuth, async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (user.role !== "ORGANIZER") {
      res.status(403).json({ detail: "Only organizers can delete events." });
      return;
    }
    const idx = db.events.findIndex((e) => e.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ detail: "Event not found." });
      return;
    }
    if (db.events[idx].organizer_id !== user.id) {
      res.status(403).json({ detail: "You can only delete events you created." });
      return;
    }
    const removedId = db.events[idx].id;
    db.events.splice(idx, 1);
    db.registrations = db.registrations.filter((r) => r.event_id !== removedId);
    db.faqs = db.faqs.filter((f) => f.event_id !== removedId);
    await persistDb();
    res.json({ deleted: true });
  });

  // MULTI-PARTICIPANT REGISTRATION (COLLECTS DETAILS OF ALL X PARTICIPANTS)
  app.post("/api/events/:id/register", requireAuth, async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (user.role !== "STUDENT") {
      res.status(403).json({ detail: "Only student accounts can register for events." });
      return;
    }
    const event = db.events.find((e) => e.id === req.params.id);
    if (!event) {
      res.status(404).json({ detail: "Event not found." });
      return;
    }

    const today = getLocalTodayDateString();
    if (isEventCompleted(event, today)) {
      res.status(400).json({ detail: "Registration for this event has closed or the event has completed." });
      return;
    }

    const existing = db.registrations.find(
      (r) => r.event_id === event.id && r.student_id === user.id
    );
    if (existing) {
      res.status(409).json({ detail: "You have already registered for this event." });
      return;
    }

    const rawParticipants = Array.isArray(req.body.participants)
      ? req.body.participants
      : [];

    if (rawParticipants.length === 0) {
      res.status(400).json({ detail: "At least 1 participant must be registered." });
      return;
    }

    // Validate details of all X participants
    const cleanParticipants: ParticipantMember[] = [];
    for (let i = 0; i < rawParticipants.length; i++) {
      const p = rawParticipants[i];
      const name = String(p?.name || "").trim();
      const email = String(p?.email || "").trim().toLowerCase();
      const phone = String(p?.phone || "").trim();
      const roll_no = String(p?.roll_no || "").trim();
      const dept = String(p?.department || "").trim();

      if (!name) {
        res.status(400).json({ detail: `Name is required for Participant #${i + 1}.` });
        return;
      }
      if (!email || !email.includes("@")) {
        res.status(400).json({ detail: `Valid email is required for Participant #${i + 1}.` });
        return;
      }
      if (phone.length < 7) {
        res.status(400).json({ detail: `Valid phone number is required for Participant #${i + 1}.` });
        return;
      }

      cleanParticipants.push({
        name,
        email,
        phone,
        roll_no: roll_no || dept,
        department: dept || roll_no,
      });
    }

    const participantCount = cleanParticipants.length;

    if (
      event.max_capacity &&
      event.participants_count + participantCount > event.max_capacity
    ) {
      const remaining = Math.max(0, event.max_capacity - event.participants_count);
      res.status(400).json({
        detail: `This event has only ${remaining} seat(s) remaining; cannot register ${participantCount} participant(s).`,
      });
      return;
    }

    const reg: RegistrationRecord = {
      id: crypto.randomUUID(),
      reference_code: `EM-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      event_id: event.id,
      student_id: user.id,
      student_name: user.full_name,
      student_username: user.username,
      team_name: String(req.body.team_name || "").trim() || undefined,
      participants: cleanParticipants,
      participant_count: participantCount,
      notes: String(req.body.notes || "").trim() || undefined,
      registered_at: new Date().toISOString(),
    };

    db.registrations.push(reg);
    event.participants_count += participantCount;
    await persistDb();

    res.status(201).json({ registration: reg, event });
  });

  // Student Cancel Registration
  app.delete("/api/events/:id/register", requireAuth, async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const event = db.events.find((e) => e.id === req.params.id);
    if (!event) {
      res.status(404).json({ detail: "Event not found." });
      return;
    }
    const today = getLocalTodayDateString();
    if (isEventCompleted(event, today)) {
      res.status(400).json({ detail: "Event has completed; registration is locked in history." });
      return;
    }
    const idx = db.registrations.findIndex(
      (r) => r.event_id === event.id && r.student_id === user.id
    );
    if (idx === -1) {
      res.status(404).json({ detail: "Registration not found." });
      return;
    }
    const reg = db.registrations[idx];
    const countToDeduct = reg.participant_count || reg.participants?.length || 1;
    db.registrations.splice(idx, 1);
    event.participants_count = Math.max(0, event.participants_count - countToDeduct);
    await persistDb();
    res.json({ cancelled: true, event });
  });

  // Student Registrations (Current vs History by Deadline & Event Completion) + Announcements
  app.get("/api/student/registrations", requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const today = getLocalTodayDateString();
    const myRegs = db.registrations
      .filter((r) => r.student_id === user.id)
      .sort((a, b) => b.registered_at.localeCompare(a.registered_at));

    const current: Array<{
      registration: RegistrationRecord;
      event: EventRecord;
      is_completed: boolean;
      announcements: EventAnnouncementRecord[];
    }> = [];
    const history: typeof current = [];

    for (const r of myRegs) {
      const ev = db.events.find((e) => e.id === r.event_id);
      if (!ev) continue;
      const completed = isEventCompleted(ev, today);
      const announcements = db.announcements
        .filter((a) => a.event_id === ev.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));

      const entry = {
        registration: r,
        event: ev,
        is_completed: completed,
        announcements,
      };
      if (completed) {
        history.push(entry);
      } else {
        current.push(entry);
      }
    }

    res.json({ current, history, today });
  });

  // Post Event Announcement (Organizer Broadcast)
  app.post("/api/events/:id/announcements", requireAuth, async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (user.role !== "ORGANIZER") {
      res.status(403).json({ detail: "Organizer access required." });
      return;
    }
    const event = db.events.find((e) => e.id === req.params.id);
    if (!event || event.organizer_id !== user.id) {
      res.status(403).json({ detail: "You can only broadcast announcements for events you organize." });
      return;
    }
    const title = String(req.body.title || "").trim();
    const message = String(req.body.message || "").trim();
    const is_urgent = Boolean(req.body.is_urgent);

    if (!title || !message) {
      res.status(400).json({ detail: "Please provide both an announcement title and message." });
      return;
    }

    const item: EventAnnouncementRecord = {
      id: crypto.randomUUID(),
      event_id: event.id,
      title,
      message,
      is_urgent,
      created_at: new Date().toISOString(),
    };
    db.announcements.push(item);
    await persistDb();
    res.status(201).json({ announcement: item });
  });

  // Delete Event Announcement
  app.delete("/api/events/:id/announcements/:announcementId", requireAuth, async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (user.role !== "ORGANIZER") {
      res.status(403).json({ detail: "Organizer access required." });
      return;
    }
    const event = db.events.find((e) => e.id === req.params.id);
    if (!event || event.organizer_id !== user.id) {
      res.status(403).json({ detail: "Access denied." });
      return;
    }
    const idx = db.announcements.findIndex(
      (a) => a.id === req.params.announcementId && a.event_id === event.id
    );
    if (idx === -1) {
      res.status(404).json({ detail: "Announcement not found." });
      return;
    }
    db.announcements.splice(idx, 1);
    await persistDb();
    res.json({ deleted: true });
  });

  // Student Submits Anonymous Organizer Feedback & Rating
  app.post("/api/organizers/:id/feedback", requireAuth, async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (user.role !== "STUDENT") {
      res.status(403).json({ detail: "Only student attendees can submit reviews." });
      return;
    }
    const targetOrganizerId = req.params.id;
    const organizer = db.users.find((u) => u.id === targetOrganizerId && u.role === "ORGANIZER");
    if (!organizer) {
      res.status(404).json({ detail: "Organizer record not found." });
      return;
    }

    const rating = Math.min(5, Math.max(1, Number(req.body.rating || 5)));
    const comment = String(req.body.comment || "").trim();
    const event_id = req.body.event_id ? String(req.body.event_id).trim() : undefined;
    const event_title = req.body.event_title ? String(req.body.event_title).trim() : undefined;

    if (!comment) {
      res.status(400).json({ detail: "Feedback commentary is required." });
      return;
    }

    // STRICT ANONYMITY: Neither student ID nor student name is saved in the record
    const fb: OrganizerFeedbackRecord = {
      id: crypto.randomUUID(),
      organizer_id: targetOrganizerId,
      event_id,
      event_title,
      rating,
      comment,
      created_at: new Date().toISOString(),
    };
    db.feedbacks.push(fb);
    await persistDb();
    res.status(201).json({ success: true, message: "Anonymous feedback received and recorded." });
  });

  // Organizer Check-in Pass (Pass Tracker)
  app.put("/api/organizer/events/:id/checkin", requireAuth, async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (user.role !== "ORGANIZER") {
      res.status(403).json({ detail: "Organizer access required." });
      return;
    }
    const event = db.events.find((e) => e.id === req.params.id);
    if (!event || event.organizer_id !== user.id) {
      res.status(403).json({ detail: "Access denied for this event." });
      return;
    }

    const query = String(req.body.pass_code || req.body.registration_id || "").trim();
    if (!query) {
      res.status(400).json({ detail: "Registration Pass ID or code required." });
      return;
    }

    const reg = db.registrations.find(
      (r) =>
        r.event_id === event.id &&
        (r.reference_code.toUpperCase() === query.toUpperCase() ||
          r.id === query ||
          r.student_name.toLowerCase().includes(query.toLowerCase()) ||
          r.student_username.toLowerCase() === query.toLowerCase() ||
          r.participants.some(
            (p) =>
              p.name.toLowerCase().includes(query.toLowerCase()) ||
              p.email.toLowerCase() === query.toLowerCase() ||
              (p.roll_no && p.roll_no.toLowerCase() === query.toLowerCase())
          ))
    );

    if (!reg) {
      res.status(404).json({ detail: `No registration record found matching "${query}".` });
      return;
    }

    const toggle = req.body.toggle === true;
    if (toggle && reg.checked_in) {
      reg.checked_in = false;
      reg.checked_in_at = undefined;
    } else {
      reg.checked_in = true;
      reg.checked_in_at = new Date().toISOString();
    }

    await persistDb();
    res.json({ registration: reg, event });
  });

  // Submit FAQ Question
  app.post("/api/events/:id/faqs", requireAuth, async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const event = db.events.find((e) => e.id === req.params.id);
    if (!event) {
      res.status(404).json({ detail: "Event not found." });
      return;
    }
    const question = String(req.body.question || "").trim();
    const answerRaw = req.body.answer ? String(req.body.answer).trim() : null;
    if (question.length < 3) {
      res.status(400).json({ detail: "Please enter a valid question." });
      return;
    }

    const isHost = user.role === "ORGANIZER" && event.organizer_id === user.id;
    const nowIso = new Date().toISOString();
    const faq: FAQRecord = {
      id: crypto.randomUUID(),
      event_id: event.id,
      question,
      asked_by_name: user.full_name,
      answer: isHost && answerRaw ? answerRaw : null,
      answered_at: isHost && answerRaw ? nowIso : null,
      created_at: nowIso,
    };
    db.faqs.push(faq);
    await persistDb();
    res.status(201).json({ faq });
  });

  // Organizer Answers FAQ
  app.put("/api/events/:id/faqs/:faqId", requireAuth, async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (user.role !== "ORGANIZER") {
      res.status(403).json({ detail: "Only organizers can answer FAQs." });
      return;
    }
    const event = db.events.find((e) => e.id === req.params.id);
    if (!event || event.organizer_id !== user.id) {
      res.status(403).json({ detail: "You can only answer FAQs for events you host." });
      return;
    }
    const faq = db.faqs.find((f) => f.id === req.params.faqId && f.event_id === event.id);
    if (!faq) {
      res.status(404).json({ detail: "Question not found." });
      return;
    }
    const answer = String(req.body.answer || "").trim();
    if (!answer) {
      res.status(400).json({ detail: "Answer cannot be empty." });
      return;
    }
    faq.answer = answer;
    faq.answered_at = new Date().toISOString();
    await persistDb();
    res.json({ faq });
  });

  // Organizer Hosted Events List
  app.get("/api/organizer/events", requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (user.role !== "ORGANIZER") {
      res.status(403).json({ detail: "Organizer access required." });
      return;
    }
    const todayStr = getLocalTodayDateString();
    const events = db.events
      .filter((e) => e.organizer_id === user.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    const enriched = events.map((ev) => {
      const unansweredCount = db.faqs.filter(
        (f) => f.event_id === ev.id && !f.answer
      ).length;
      const announcementsCount = db.announcements.filter(
        (a) => a.event_id === ev.id
      ).length;
      return {
        ...ev,
        is_completed: isEventCompleted(ev, todayStr),
        unanswered_faqs: unansweredCount,
        announcements_count: announcementsCount,
      };
    });

    res.json({ events: enriched });
  });

  // Organizer Participant Management + FAQs + Announcements
  app.get("/api/organizer/events/:id/participants", requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (user.role !== "ORGANIZER") {
      res.status(403).json({ detail: "Organizer access required." });
      return;
    }
    const event = db.events.find((e) => e.id === req.params.id);
    if (!event || event.organizer_id !== user.id) {
      res.status(403).json({ detail: "Access denied for this event." });
      return;
    }
    const todayStr = getLocalTodayDateString();
    const eventWithStatus = {
      ...event,
      is_completed: isEventCompleted(event, todayStr),
    };

    const registrations = db.registrations
      .filter((r) => r.event_id === event.id)
      .sort((a, b) => b.registered_at.localeCompare(a.registered_at));

    const faqs = db.faqs
      .filter((f) => f.event_id === event.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    const announcements = db.announcements
      .filter((a) => a.event_id === event.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    res.json({ event: eventWithStatus, registrations, faqs, announcements });
  });

  // Organizer Profile Stats & Anonymous Feedback
  app.get("/api/organizer/profile", requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (user.role !== "ORGANIZER") {
      res.status(403).json({ detail: "Organizer access required." });
      return;
    }
    const todayStr = getLocalTodayDateString();
    const hosted = db.events
      .filter((e) => e.organizer_id === user.id)
      .map((e) => ({ ...e, is_completed: isEventCompleted(e, todayStr) }));

    const hostedIds = new Set(hosted.map((e) => e.id));
    const totalParticipants = hosted.reduce((sum, e) => sum + e.participants_count, 0);
    const eventFaqs = db.faqs.filter((f) => hostedIds.has(f.event_id));
    const pendingFaqs = eventFaqs.filter((f) => !f.answer).length;
    const answeredFaqs = eventFaqs.filter((f) => Boolean(f.answer)).length;

    // Anonymous Reviews for this Organizer
    const feedbacks = db.feedbacks
      .filter((f) => f.organizer_id === user.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    const totalReviews = feedbacks.length;
    const averageRating = totalReviews > 0
      ? Number((feedbacks.reduce((sum, f) => sum + f.rating, 0) / totalReviews).toFixed(1))
      : 5.0;

    res.json({
      organizer: sanitizeUser(user),
      stats: {
        events_hosted: hosted.length,
        total_participants: totalParticipants,
        pending_faqs: pendingFaqs,
        answered_faqs: answeredFaqs,
        average_rating: averageRating,
        total_reviews: totalReviews,
      },
      hosted_events: hosted,
      feedbacks,
    });
  });

  // Serve Vite in dev or built SPA in production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`EVENT MANAGER server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
