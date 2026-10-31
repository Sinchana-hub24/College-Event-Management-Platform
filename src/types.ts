/// <reference types="vite/client" />
import hackathonBanner from "./assets/images/event_hackathon_hall_1793466743149.jpg";
import sportsBanner from "./assets/images/event_sports_arena_1793466743689.jpg";
import musicBanner from "./assets/images/event_music_fest_1793466743227.jpg";
import culturalBanner from "./assets/images/event_cultural_stage_1793466744119.jpg";

export type UserRole = "STUDENT" | "ORGANIZER";

export interface User {
  id: string;
  username: string;
  full_name: string;
  email: string;
  phone: string;
  department: string;
  role: UserRole;
  xp?: number;
  events_registered_count?: number;
  created_at: string;
}

export interface StudentLeaderboardEntry {
  id: string;
  full_name: string;
  username: string;
  department?: string;
  xp: number;
  events_registered_count: number;
  rank: number;
}

export interface ParticipantMember {
  name: string;
  email: string;
  phone: string;
  roll_no?: string;
  department?: string;
}

export interface CampusEvent {
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
  unanswered_faqs?: number;
  announcements_count?: number;
  created_at: string;
}

export interface EventAnnouncement {
  id: string;
  event_id: string;
  title: string;
  message: string;
  is_urgent?: boolean;
  created_at: string;
}

export interface FAQItem {
  id: string;
  event_id: string;
  question: string;
  asked_by_name: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
}

export interface RegistrationRecord {
  id: string;
  reference_code: string; // Official Pass ID (e.g. PASS-8F42A1)
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

export interface StudentRegistrationEntry {
  registration: RegistrationRecord;
  event: CampusEvent;
  is_completed: boolean;
  announcements: EventAnnouncement[];
}

export interface OrganizerFeedback {
  id: string;
  organizer_id: string;
  event_id?: string;
  event_title?: string;
  rating: number; // 1 to 5
  comment: string;
  created_at: string;
}

export interface OrganizerProfileStats {
  organizer: User;
  stats: {
    events_hosted: number;
    total_participants: number;
    pending_faqs: number;
    answered_faqs: number;
    average_rating: number;
    total_reviews: number;
  };
  hosted_events: CampusEvent[];
  feedbacks: OrganizerFeedback[]; // Strictly anonymous
}

export const CATEGORY_PRESET_IMAGES: Record<string, string> = {
  Hackathon: hackathonBanner,
  Technical: hackathonBanner,
  Workshop: hackathonBanner,
  Music: musicBanner,
  Sports: sportsBanner,
  Cultural: culturalBanner,
  Dance: culturalBanner,
  Art: culturalBanner,
};

export const PRESET_GALLERY_OPTIONS = [
  {
    label: "Hackathon & Tech Hall",
    category: "Hackathon",
    url: hackathonBanner,
  },
  {
    label: "Collegiate Athletics Stadium",
    category: "Sports",
    url: sportsBanner,
  },
  {
    label: "Open-Air Music Stage",
    category: "Music",
    url: musicBanner,
  },
  {
    label: "Performing Arts & Cultural Stage",
    category: "Cultural",
    url: culturalBanner,
  },
];

export const DEFAULT_CATEGORIES = [
  "All",
  "Hackathon",
  "Sports",
  "Music",
  "Dance",
  "Art",
  "Technical",
  "Cultural",
  "Workshop",
];

export function resolveEventBanner(imageUrl: string | undefined, category: string): string {
  if (imageUrl && imageUrl.trim()) {
    return imageUrl.trim();
  }
  const exact = CATEGORY_PRESET_IMAGES[category];
  if (exact) return exact;
  const lower = category.toLowerCase();
  if (lower.includes("sport") || lower.includes("cricket") || lower.includes("football") || lower.includes("athletics")) {
    return sportsBanner;
  }
  if (lower.includes("music") || lower.includes("band") || lower.includes("sing") || lower.includes("concert")) {
    return musicBanner;
  }
  if (lower.includes("dance") || lower.includes("drama") || lower.includes("theatre") || lower.includes("cultur") || lower.includes("art")) {
    return culturalBanner;
  }
  return hackathonBanner;
}

export function formatEventCost(cost: number): string {
  if (!cost || Number(cost) <= 0) return "Complimentary";
  return `₹${Number(cost).toLocaleString("en-IN")}`;
}

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatShortMonthDay(dateStr: string): { month: string; day: string } {
  if (!dateStr) return { month: "—", day: "—" };
  const parts = dateStr.split("-");
  if (parts.length !== 3) return { month: "—", day: "—" };
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(d.getTime())) return { month: "—", day: "—" };
  return {
    month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate()).padStart(2, "0"),
  };
}
