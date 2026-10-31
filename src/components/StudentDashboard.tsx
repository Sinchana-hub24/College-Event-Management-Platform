import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  X,
  Phone,
  Calendar as CalendarIcon,
  MapPin,
  Users,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Trophy,
  Star,
  Bell,
  Printer,
  Copy,
  Check,
  Building2,
  ShieldCheck,
  KeyRound,
  Zap,
  Lock,
  Award,
} from "lucide-react";
import { apiRequest, ApiError } from "../api";
import {
  User,
  CampusEvent,
  FAQItem,
  StudentRegistrationEntry,
  StudentLeaderboardEntry,
  ParticipantMember,
  EventAnnouncement,
  DEFAULT_CATEGORIES,
  formatEventCost,
  formatDisplayDate,
  formatShortMonthDay,
} from "../types";
import { EventImage } from "./EventImage";

interface StudentDashboardProps {
  user: User;
  isDrawerOpen: boolean;
  onCloseDrawer: () => void;
  onOpenDrawer: () => void;
  onLogout: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  user,
  isDrawerOpen,
  onCloseDrawer,
  onOpenDrawer,
  onLogout,
}) => {
  const [activeEvents, setActiveEvents] = useState<CampusEvent[]>([]);
  const [topEvents, setTopEvents] = useState<CampusEvent[]>([]);
  const [availableHosts, setAvailableHosts] = useState<string[]>([]);
  const [registrations, setRegistrations] = useState<{
    current: StudentRegistrationEntry[];
    history: StudentRegistrationEntry[];
    today?: string;
  }>({ current: [], history: [] });

  const [loading, setLoading] = useState(true);
  const [activeHeroIdx, setActiveHeroIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedHost, setSelectedHost] = useState("All");
  const [drawerTab, setDrawerTab] = useState<"CURRENT" | "CALENDAR" | "HISTORY" | "SECURITY">("CURRENT");

  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState<StudentLeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Calendar State
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [selectedCalendarDayStr, setSelectedCalendarDayStr] = useState<string | null>(null);

  // Digital Pass Modal State
  const [activePassRegistration, setActivePassRegistration] = useState<StudentRegistrationEntry | null>(null);
  const [copiedPassCode, setCopiedPassCode] = useState(false);

  // Anonymous Review Modal State
  const [evaluatingOrganizer, setEvaluatingOrganizer] = useState<{
    organizerId: string;
    organizerName: string;
    eventId?: string;
    eventTitle?: string;
  } | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewToast, setReviewToast] = useState<string | null>(null);

  // Event Details Modal State
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [modalEvent, setModalEvent] = useState<CampusEvent | null>(null);
  const [modalFaqs, setModalFaqs] = useState<FAQItem[]>([]);
  const [modalAnnouncements, setModalAnnouncements] = useState<EventAnnouncement[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Multi-Participant Registration State
  const [showRegForm, setShowRegForm] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [participantList, setParticipantList] = useState<ParticipantMember[]>([
    {
      name: user.full_name || "",
      email: user.email || "",
      phone: user.phone || "",
      roll_no: user.department || "",
    },
  ]);
  const [regNotes, setRegNotes] = useState("");
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regFeedback, setRegFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // FAQ State
  const [questionText, setQuestionText] = useState("");
  const [faqSubmitting, setFaqSubmitting] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      const [evRes, topRes, regRes, hostsRes, leadRes] = await Promise.all([
        apiRequest<{ events: CampusEvent[] }>("/api/events"),
        apiRequest<{ events: CampusEvent[] }>("/api/events/top"),
        apiRequest<{
          current: StudentRegistrationEntry[];
          history: StudentRegistrationEntry[];
          today?: string;
        }>("/api/student/registrations"),
        apiRequest<{ hosts: string[] }>("/api/events/hosts").catch(() => ({ hosts: [] })),
        apiRequest<{ leaderboard: StudentLeaderboardEntry[] }>("/api/leaderboard").catch(() => ({ leaderboard: [] })),
      ]);
      setActiveEvents(evRes.events || []);
      setTopEvents(topRes.events || []);
      setRegistrations({
        current: regRes.current || [],
        history: regRes.history || [],
        today: regRes.today,
      });
      setAvailableHosts(hostsRes.hosts || []);
      setLeaderboard(leadRes.leaderboard || []);
    } finally {
      setLoading(false);
      setLoadingLeaderboard(false);
    }
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (newPassword.length < 6) {
      setPasswordFeedback({
        type: "error",
        message: "New password must be at least 6 characters long.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({
        type: "error",
        message: "New password and confirmation do not match.",
      });
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordFeedback({
        type: "error",
        message: "New password cannot be the same as your old password.",
      });
      return;
    }

    setPasswordSubmitting(true);
    try {
      const res = await apiRequest<{ message: string }>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          old_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      setPasswordFeedback({
        type: "success",
        message: res.message || "Password changed successfully! You can now use your new password next time you sign in.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : "Failed to change password.";
      setPasswordFeedback({
        type: "error",
        message,
      });
    } finally {
      setPasswordSubmitting(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const openEventDetails = async (eventId: string) => {
    setSelectedEventId(eventId);
    setModalLoading(true);
    setShowRegForm(false);
    setRegFeedback(null);
    setTeamName("");
    setParticipantList([
      {
        name: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
        roll_no: user.department || "",
      },
    ]);
    setRegNotes("");
    try {
      const res = await apiRequest<{
        event: CampusEvent;
        faqs: FAQItem[];
        announcements?: EventAnnouncement[];
      }>(`/api/events/${eventId}`);
      setModalEvent(res.event);
      setModalFaqs(res.faqs || []);
      setModalAnnouncements(res.announcements || []);
    } finally {
      setModalLoading(false);
    }
  };

  const closeEventDetails = () => {
    setSelectedEventId(null);
    setModalEvent(null);
    setModalFaqs([]);
    setModalAnnouncements([]);
    setRegFeedback(null);
  };

  const categories = useMemo(() => {
    const list = [...DEFAULT_CATEGORIES];
    for (const ev of activeEvents) {
      if (
        ev.category &&
        !list.some((c) => c.toLowerCase() === ev.category.toLowerCase())
      ) {
        list.push(ev.category);
      }
    }
    return list;
  }, [activeEvents]);

  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeEvents.filter((ev) => {
      const matchesCat =
        selectedCategory === "All" ||
        ev.category.toLowerCase() === selectedCategory.toLowerCase();
      if (!matchesCat) return false;

      const matchesHost =
        selectedHost === "All" ||
        ev.organizer_name.toLowerCase() === selectedHost.toLowerCase();
      if (!matchesHost) return false;

      if (!q) return true;
      return (
        ev.title.toLowerCase().includes(q) ||
        ev.description.toLowerCase().includes(q) ||
        ev.venue.toLowerCase().includes(q) ||
        ev.organizer_name.toLowerCase().includes(q) ||
        ev.category.toLowerCase().includes(q) ||
        (ev.prizes && ev.prizes.toLowerCase().includes(q))
      );
    });
  }, [activeEvents, searchQuery, selectedCategory, selectedHost]);

  const currentRegistrationMatch = useMemo(() => {
    if (!modalEvent) return null;
    return (
      registrations.current.find((r) => r.event.id === modalEvent.id) ||
      registrations.history.find((r) => r.event.id === modalEvent.id) ||
      null
    );
  }, [modalEvent, registrations]);

  const isRegistrationClosed = useMemo(() => {
    if (!modalEvent) return false;
    const todayStr =
      registrations.today || new Date().toISOString().slice(0, 10);
    return (
      modalEvent.registration_deadline < todayStr ||
      modalEvent.event_date < todayStr ||
      Boolean(modalEvent.is_completed)
    );
  }, [modalEvent, registrations.today]);

  const handleParticipantChange = (
    index: number,
    field: keyof ParticipantMember,
    val: string
  ) => {
    setParticipantList((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const handleAddParticipant = () => {
    if (!modalEvent) return;
    const maxLimit = modalEvent.max_team_size || 10;
    if (participantList.length >= maxLimit) return;
    setParticipantList((prev) => [
      ...prev,
      { name: "", email: "", phone: "", roll_no: "" },
    ]);
  };

  const handleRemoveParticipant = (index: number) => {
    if (participantList.length <= 1) return;
    setParticipantList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirmRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEvent) return;
    setRegSubmitting(true);
    setRegFeedback(null);

    // Validate details of all participants
    for (let i = 0; i < participantList.length; i++) {
      const p = participantList[i];
      if (!p.name.trim() || !p.email.trim() || !p.phone.trim()) {
        setRegFeedback({
          type: "error",
          text: `Name, email, and phone number are required for Participant #${i + 1}.`,
        });
        setRegSubmitting(false);
        return;
      }
    }

    try {
      await apiRequest(`/api/events/${modalEvent.id}/register`, {
        method: "POST",
        body: JSON.stringify({
          team_name: teamName.trim(),
          participants: participantList,
          notes: regNotes.trim(),
        }),
      });
      await loadDashboardData();
      const refreshed = await apiRequest<{
        event: CampusEvent;
        faqs: FAQItem[];
        announcements?: EventAnnouncement[];
      }>(`/api/events/${modalEvent.id}`);
      setModalEvent(refreshed.event);
      setModalFaqs(refreshed.faqs || []);
      setModalAnnouncements(refreshed.announcements || []);
      setShowRegForm(false);
      setRegFeedback({
        type: "success",
        text: `Registration successful for ${participantList.length} participant(s)! Your event pass is ready in your dashboard.`,
      });
    } catch (err) {
      setRegFeedback({
        type: "error",
        text:
          err instanceof ApiError
            ? err.message
            : "Could not complete registration.",
      });
    } finally {
      setRegSubmitting(false);
    }
  };

  const handleCancelRegistration = async (eventId: string) => {
    try {
      await apiRequest(`/api/events/${eventId}/register`, {
        method: "DELETE",
      });
      await loadDashboardData();
      if (modalEvent && modalEvent.id === eventId) {
        const refreshed = await apiRequest<{
          event: CampusEvent;
          faqs: FAQItem[];
          announcements?: EventAnnouncement[];
        }>(`/api/events/${eventId}`);
        setModalEvent(refreshed.event);
        setModalFaqs(refreshed.faqs || []);
        setModalAnnouncements(refreshed.announcements || []);
      }
      setRegFeedback({
        type: "success",
        text: "Registration cancelled.",
      });
    } catch (err) {
      setRegFeedback({
        type: "error",
        text:
          err instanceof ApiError
            ? err.message
            : "Unable to cancel registration.",
      });
    }
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEvent || !questionText.trim()) return;
    setFaqSubmitting(true);
    try {
      const res = await apiRequest<{ faq: FAQItem }>(
        `/api/events/${modalEvent.id}/faqs`,
        {
          method: "POST",
          body: JSON.stringify({ question: questionText }),
        }
      );
      setModalFaqs((prev) => [...prev, res.faq]);
      setQuestionText("");
    } finally {
      setFaqSubmitting(false);
    }
  };

  const handleCopyPassCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedPassCode(true);
    setTimeout(() => setCopiedPassCode(false), 2200);
  };

  const handleSubmitAnonymousFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluatingOrganizer || !reviewComment.trim()) return;
    setSubmittingReview(true);
    try {
      await apiRequest(`/api/organizers/${evaluatingOrganizer.organizerId}/feedback`, {
        method: "POST",
        body: JSON.stringify({
          rating: reviewRating,
          comment: reviewComment.trim(),
          event_id: evaluatingOrganizer.eventId,
          event_title: evaluatingOrganizer.eventTitle,
        }),
      });
      setReviewToast("Your anonymous review was sent to the organizer.");
      setEvaluatingOrganizer(null);
      setReviewComment("");
      setReviewRating(5);
      setTimeout(() => setReviewToast(null), 4000);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to submit review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  // Calendar Helpers
  const registeredDateMap = useMemo(() => {
    const map = new Map<string, StudentRegistrationEntry[]>();
    for (const item of registrations.current) {
      const dateKey = item.event.event_date;
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(item);
    }
    return map;
  }, [registrations.current]);

  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: Array<{ dayNumber: number; dateStr: string; hasEvents: boolean }> = [];

    for (let i = 1; i <= daysInMonth; i++) {
      const mStr = String(month + 1).padStart(2, "0");
      const dStr = String(i).padStart(2, "0");
      const dateStr = `${year}-${mStr}-${dStr}`;
      days.push({
        dayNumber: i,
        dateStr,
        hasEvents: registeredDateMap.has(dateStr),
      });
    }
    return { firstDay, days };
  }, [calendarDate, registeredDateMap]);

  const userTotalEventsJoined = registrations.current.length + registrations.history.length;
  const userXP = userTotalEventsJoined * 10;
  const myLeaderboardEntry = useMemo(() => {
    return leaderboard.find((item) => item.id === user.id || item.username === user.username) || null;
  }, [leaderboard, user]);

  const safeHeroIdx = activeHeroIdx < topEvents.length ? activeHeroIdx : 0;
  const featuredEvent = topEvents[safeHeroIdx] || null;

  return (
    <div>
      {/* Toast Notification */}
      {reviewToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-950 border border-emerald-500/50 text-emerald-200 text-xs font-semibold px-4 py-3 rounded-lg shadow-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{reviewToast}</span>
        </div>
      )}

      {/* HERO SECTION: TOP 5 EVENTS (ACTIVE ONLY) */}
      <section
        id="popular-showcase"
        className="bg-slate-950 text-white border-b border-slate-800 py-10 lg:py-12"
      >
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex items-baseline justify-between gap-4 mb-5">
            <div>
              <p className="text-xs font-bold text-rose-500 tracking-wider uppercase">
                Featured
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Top 5 Events
              </h1>
            </div>
            <p className="text-xs text-slate-400 tabular-nums hidden sm:block">
              Ranked by student registrations · Active events only
            </p>
          </div>

          {loading ? (
            <div className="h-[380px] rounded-xl bg-slate-900 border border-slate-800 animate-pulse" />
          ) : !featuredEvent ? (
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-10 sm:p-14 flex flex-col items-start justify-center min-h-[300px]">
              <p className="font-mono text-xs text-rose-400 mb-2">
                NO UPCOMING EVENTS SCHEDULED
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-3 balance-text">
                No active college events right now.
              </h2>
              <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
                When organizers create new events, the top 5 most registered events will appear here automatically. Past events are removed once completed.
              </p>
            </div>
          ) : (
            <>
              {/* Featured Frame */}
              <div className="relative rounded-xl overflow-hidden border border-slate-800 min-h-[380px] sm:min-h-[420px] flex items-end">
                <div className="absolute inset-0">
                  <EventImage
                    imageUrl={featuredEvent.image_url}
                    category={featuredEvent.category}
                    alt={featuredEvent.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/20" />
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/40 to-transparent" />
                </div>

                {/* Highlighted Date Tile on Featured Event */}
                {(() => {
                  const shortDate = formatShortMonthDay(featuredEvent.event_date);
                  return (
                    <div className="absolute top-5 right-5 z-20 bg-slate-950/90 border border-rose-500/60 backdrop-blur-md px-3.5 py-2 rounded-lg shadow-lg flex flex-col items-center leading-none">
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                        {shortDate.month}
                      </span>
                      <span className="text-2xl font-black text-white mt-0.5 tracking-tight">
                        {shortDate.day}
                      </span>
                    </div>
                  );
                })()}

                <div className="relative z-10 p-7 sm:p-10 max-w-2xl">
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="font-display text-4xl sm:text-5xl font-extrabold text-rose-500 leading-none tabular-nums">
                      0{safeHeroIdx + 1}
                    </span>
                    <span className="text-xs font-medium text-slate-300">
                      Popular · {featuredEvent.category} · Organized by{" "}
                      <span className="text-white font-semibold">{featuredEvent.organizer_name}</span>
                    </span>
                  </div>

                  <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-[1.12] balance-text mb-3">
                    {featuredEvent.title}
                  </h2>

                  <p className="text-sm text-slate-200 line-clamp-2 mb-4 max-w-xl">
                    {featuredEvent.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-slate-300 tabular-nums mb-6">
                    <span className="text-rose-300 font-semibold">
                      {formatDisplayDate(featuredEvent.event_date)} at {featuredEvent.event_time}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{featuredEvent.venue}</span>
                    <span aria-hidden="true">·</span>
                    <span>{featuredEvent.participants_count} Registered</span>
                    {featuredEvent.prizes && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-300 font-semibold flex items-center gap-1">
                          <Trophy className="w-3.5 h-3.5" /> Prize: {featuredEvent.prizes}
                        </span>
                      </>
                    )}
                    {featuredEvent.show_remaining_seats && featuredEvent.max_capacity && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-rose-400 font-semibold">
                          {Math.max(0, featuredEvent.max_capacity - featuredEvent.participants_count)} seats left
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="text-white font-bold">
                      {formatEventCost(featuredEvent.cost)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => openEventDetails(featuredEvent.id)}
                    className="py-2.5 px-6 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-md hover:shadow-rose-600/30"
                  >
                    View Details &amp; Register
                  </button>
                </div>
              </div>

              {/* Top 5 Thumbnails */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
                {topEvents.map((ev, index) => {
                  const isActive = index === safeHeroIdx;
                  const shortDate = formatShortMonthDay(ev.event_date);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => setActiveHeroIdx(index)}
                      className={`group text-left p-3.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-3.5 ${
                        isActive
                          ? "bg-slate-900 border-rose-500"
                          : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <span
                        className={`font-display text-3xl font-extrabold leading-none tabular-nums shrink-0 ${
                          isActive
                            ? "text-rose-500"
                            : "text-slate-500 group-hover:text-slate-300"
                        }`}
                      >
                        0{index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">
                          {ev.title}
                        </p>
                        <p className="text-xs text-slate-400 tabular-nums truncate mt-0.5">
                          {shortDate.month} {shortDate.day} · {ev.category}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* CAMPUS XP LEADERBOARD: TOP 5 STUDENTS */}
      <section className="bg-slate-900 text-white border-b border-slate-800 py-10">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-7">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest bg-rose-600/30 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-amber-400" />
                  Campus Rankings
                </span>
                <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 fill-amber-400" />
                  +10 XP per event registered
                </span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Student XP Leaderboard
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Top 5 college students with the highest XP. Earn +10 XP for every event you register for!
              </p>
            </div>

            {/* Logged-in Student Standing Banner */}
            <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3.5 sm:p-4 flex items-center justify-between gap-4 shrink-0 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-amber-500 to-rose-600 text-white flex items-center justify-center font-black text-base shadow-sm">
                  ⚡
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Your Standing · {user.full_name}
                  </p>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {userTotalEventsJoined} event{userTotalEventsJoined === 1 ? "" : "s"} joined
                    {myLeaderboardEntry ? ` · Rank #${myLeaderboardEntry.rank}` : " · Unranked"}
                  </p>
                </div>
              </div>
              <div className="text-right pl-3 border-l border-slate-700">
                <span className="font-mono text-2xl font-black text-amber-400">
                  {userXP}
                </span>
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                  Your XP
                </span>
              </div>
            </div>
          </div>

          {/* Top 5 Students Grid */}
          {loadingLeaderboard ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="h-36 rounded-xl bg-slate-800/60 border border-slate-700/60 animate-pulse" />
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="p-8 text-center bg-slate-800/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
              No student XP recorded yet. Register for college events to earn XP!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {leaderboard.map((item, idx) => {
                const isCurrentUser = item.id === user.id || item.username === user.username;
                const isFirst = idx === 0;
                const isSecond = idx === 1;
                const isThird = idx === 2;

                return (
                  <div
                    key={item.id || idx}
                    className={`relative rounded-xl p-4 transition-all flex flex-col justify-between ${
                      isCurrentUser
                        ? "bg-slate-800/95 border-2 border-rose-500 shadow-lg shadow-rose-950/40"
                        : isFirst
                        ? "bg-slate-800/90 border-2 border-amber-500/80 shadow-md shadow-amber-950/30"
                        : "bg-slate-800/60 border border-slate-700/70 hover:border-slate-600"
                    }`}
                  >
                    <div>
                      {/* Rank Indicator */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          {isFirst ? (
                            <span className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-xs">
                              🥇
                            </span>
                          ) : isSecond ? (
                            <span className="w-7 h-7 rounded-lg bg-slate-300 text-slate-950 font-black text-xs flex items-center justify-center shadow-xs">
                              🥈
                            </span>
                          ) : isThird ? (
                            <span className="w-7 h-7 rounded-lg bg-amber-700 text-white font-black text-xs flex items-center justify-center shadow-xs">
                              🥉
                            </span>
                          ) : (
                            <span className="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center">
                              #{item.rank}
                            </span>
                          )}
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            {isFirst ? "1st Place" : isSecond ? "2nd Place" : isThird ? "3rd Place" : `Rank ${item.rank}`}
                          </span>
                        </div>

                        {isCurrentUser && (
                          <span className="text-[10px] font-black uppercase bg-rose-600 text-white px-2 py-0.5 rounded-full">
                            You
                          </span>
                        )}
                      </div>

                      {/* Student Name */}
                      <h3 className="font-display text-sm font-bold text-white truncate" title={item.full_name}>
                        {item.full_name}
                      </h3>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        @{item.username}
                      </p>

                      {item.department && (
                        <p className="text-[11px] text-slate-400 truncate mt-1.5 bg-slate-900/60 px-2 py-1 rounded border border-slate-700/50">
                          {item.department}
                        </p>
                      )}
                    </div>

                    {/* XP & Events count */}
                    <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {item.events_registered_count} {item.events_registered_count === 1 ? "event" : "events"}
                      </span>
                      <div className="flex items-center gap-1 font-mono font-black text-sm text-amber-400">
                        <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>{item.xp} XP</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* DISCOVERY CATALOG & FILTERS */}
      <section id="explore-events" className="max-w-[1200px] mx-auto px-6 py-10 lg:py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">
              Explore
            </p>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Upcoming College Events
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Search by event name, category, host, or prizes
            </p>
          </div>

          {/* Search Bar & My Passes */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenDrawer}
              className="py-2.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
            >
              <CalendarIcon className="w-3.5 h-3.5 text-rose-400" />
              <span>My Registered Passes ({registrations.current.length})</span>
            </button>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search events, venue, host..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Filter Controls Row: Category buttons + Host Filter */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mb-8 pb-4 border-b border-slate-200">
          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => {
              const active = selectedCategory.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Host Filter Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <label htmlFor="host-filter" className="text-xs font-medium text-slate-600 whitespace-nowrap">
              Hosted by:
            </label>
            <select
              id="host-filter"
              value={selectedHost}
              onChange={(e) => setSelectedHost(e.target.value)}
              className="bg-white border border-slate-200 rounded-md py-1.5 px-3 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-slate-900 cursor-pointer"
            >
              <option value="All">All Organizers</option>
              {availableHosts.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Events Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-80 rounded-xl bg-white border border-slate-200 animate-pulse"
              />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <h3 className="font-display text-lg font-semibold text-slate-900 mb-1">
              {activeEvents.length === 0
                ? "No upcoming events right now"
                : "No events match your filter"}
            </h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              {activeEvents.length === 0
                ? "There are currently no active events. Once an organizer publishes an event, it will appear here."
                : "Try resetting your search query, choosing All categories, or clearing the host filter."}
            </p>
            {(searchQuery || selectedCategory !== "All" || selectedHost !== "All") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                  setSelectedHost("All");
                }}
                className="mt-4 py-2 px-4 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((ev) => {
              const isReg =
                registrations.current.some((r) => r.event.id === ev.id) ||
                registrations.history.some((r) => r.event.id === ev.id);
              const shortDate = formatShortMonthDay(ev.event_date);

              return (
                <article
                  key={ev.id}
                  onClick={() => openEventDetails(ev.id)}
                  className="group bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col cursor-pointer hover:border-slate-400 hover:shadow-sm transition-all"
                >
                  {/* Event Card Image Frame with Date Tile */}
                  <div className="h-48 bg-slate-900 overflow-hidden relative">
                    <EventImage
                      imageUrl={ev.image_url}
                      category={ev.category}
                      alt={ev.title}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent pointer-events-none" />

                    {/* Highlighted Date Badge */}
                    <div className="absolute top-3 left-3 bg-slate-950/90 text-white border border-rose-500/50 backdrop-blur-md px-2.5 py-1.5 rounded-md shadow-md flex flex-col items-center leading-none">
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                        {shortDate.month}
                      </span>
                      <span className="text-lg font-black text-white mt-0.5 tracking-tight">
                        {shortDate.day}
                      </span>
                    </div>

                    {/* Category Tag on Card */}
                    <div className="absolute top-3 right-3 bg-slate-950/80 text-white text-[11px] font-semibold px-2.5 py-1 rounded-md backdrop-blur-md">
                      {ev.category}
                    </div>

                    {/* Prize Badge if provided */}
                    {ev.prizes && (
                      <div className="absolute bottom-3 left-3 bg-amber-500/90 text-slate-950 text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
                        <Trophy className="w-3 h-3" />
                        <span className="truncate max-w-[190px]">{ev.prizes}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 tabular-nums mb-1.5">
                      <span className="font-semibold text-slate-700">
                        Host: {ev.organizer_name}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Deadline: {formatDisplayDate(ev.registration_deadline)}
                      </span>
                      {isReg && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-bold text-emerald-700">
                            ✓ Registered
                          </span>
                        </>
                      )}
                    </div>

                    <h3 className="font-display text-lg font-bold text-slate-900 group-hover:text-rose-600 transition-colors line-clamp-1 mb-1.5">
                      {ev.title}
                    </h3>

                    <p className="text-sm text-slate-600 line-clamp-2 mb-4 leading-relaxed">
                      {ev.description}
                    </p>

                    <div className="mt-auto pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-600 tabular-nums">
                      <span className="truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        {ev.venue}
                      </span>
                      <div className="shrink-0 flex items-center gap-2">
                        {/* Only show seats if organizer opted to show */}
                        {ev.show_remaining_seats && ev.max_capacity && (
                          <span className="text-rose-600 font-semibold">
                            {Math.max(0, ev.max_capacity - ev.participants_count)} seats left
                          </span>
                        )}
                        <span className="font-semibold text-slate-900">
                          {formatEventCost(ev.cost)}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* RIGHT SLIDE-OVER DASHBOARD DRAWER */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-950/40"
            onClick={onCloseDrawer}
          />
          <aside
            className="relative z-50 w-full max-w-lg bg-white h-full border-l border-slate-200 flex flex-col justify-between"
            aria-label="Student Dashboard"
          >
            {/* Profile Header */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-0.5">
                    Student Account
                  </p>
                  <h2 className="font-display text-xl font-bold text-slate-900 truncate">
                    {user.full_name}
                  </h2>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    @{user.username} · {user.email}
                  </p>
                  {user.department && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {user.department}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onCloseDrawer}
                  className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
                  aria-label="Close Dashboard"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Student Experience / XP Card in Profile */}
              <div className="mt-4 p-3 bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-xs">
                      ⚡
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                          Student Experience
                        </span>
                        <span className="text-[10px] bg-amber-200/90 text-amber-900 font-bold px-1.5 py-0.2 rounded-full">
                          +10 XP / event
                        </span>
                      </div>
                      <p className="text-xs text-amber-800 mt-0.5">
                        {userTotalEventsJoined} event{userTotalEventsJoined === 1 ? "" : "s"} joined
                        {myLeaderboardEntry ? ` · Campus Rank #${myLeaderboardEntry.rank}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right pl-2 border-l border-amber-200">
                    <span className="font-mono text-xl font-black text-amber-950">
                      {userXP}
                    </span>
                    <span className="text-[9px] font-bold text-amber-700 block uppercase tracking-wider">
                      Your XP
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Segmented Switch: My Events vs Calendar vs Past Events vs Change Password */}
            <div className="px-6 pt-4 pb-2">
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg text-center text-[11px]">
                <button
                  type="button"
                  onClick={() => setDrawerTab("CURRENT")}
                  className={`py-2 px-1 font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                    drawerTab === "CURRENT"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Events ({registrations.current.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab("CALENDAR")}
                  className={`py-2 px-1 font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    drawerTab === "CALENDAR"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Calendar
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab("HISTORY")}
                  className={`py-2 px-1 font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                    drawerTab === "HISTORY"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Past ({registrations.history.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab("SECURITY")}
                  className={`py-2 px-1 font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1 ${
                    drawerTab === "SECURITY"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <KeyRound className="w-3 h-3 text-rose-600" />
                  <span>Password</span>
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto px-6 py-3 space-y-4">
              {/* TAB 1: MY EVENTS */}
              {drawerTab === "CURRENT" && (
                <>
                  {registrations.current.length === 0 ? (
                    <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center my-4">
                      <p className="text-sm font-semibold text-slate-800 mb-1">
                        No upcoming registered events
                      </p>
                      <p className="text-xs text-slate-500">
                        Explore college events on the platform and register to get your event pass.
                      </p>
                    </div>
                  ) : (
                    registrations.current.map((item) => (
                      <div
                        key={item.registration.id}
                        className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-400 transition-colors shadow-2xs space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                            Pass: {item.registration.reference_code}
                          </span>
                          {item.registration.checked_in ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3" /> Checked In
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                              <ShieldCheck className="w-3 h-3" /> Valid Pass
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="font-display text-base font-bold text-slate-900">
                            {item.event.title}
                          </h3>
                          <p className="text-xs text-rose-600 font-semibold tabular-nums mt-0.5">
                            {formatDisplayDate(item.event.event_date)} at {item.event.event_time} · {item.event.venue}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Host: {item.event.organizer_name} ({item.event.organizer_phone})
                          </p>
                        </div>

                        {/* Announcements (if any) */}
                        {item.announcements && item.announcements.length > 0 && (
                          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-xs space-y-1.5">
                            <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                              <Bell className="w-3.5 h-3.5 text-amber-600" />
                              <span>Organizer Announcements:</span>
                            </div>
                            {item.announcements.map((a) => (
                              <div key={a.id} className="text-amber-950 pl-5 border-l-2 border-amber-400 py-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{a.title}</span>
                                  {a.is_urgent && (
                                    <span className="text-[10px] bg-rose-600 text-white font-bold px-1.5 rounded uppercase">
                                      Urgent
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-amber-900 mt-0.5">{a.message}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                          <button
                            type="button"
                            onClick={() => setActivePassRegistration(item)}
                            className="py-1.5 px-3 bg-slate-900 text-white font-semibold rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            View Event Pass
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEvaluatingOrganizer({
                                organizerId: item.event.organizer_id,
                                organizerName: item.event.organizer_name,
                                eventId: item.event.id,
                                eventTitle: item.event.title,
                              })
                            }
                            className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                          >
                            Rate Organizer
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {/* TAB 2: CALENDAR */}
              {drawerTab === "CALENDAR" && (
                <div className="space-y-4">
                  {/* Calendar Month Navigation Header */}
                  <div className="flex items-center justify-between bg-slate-900 text-white p-3 rounded-lg">
                    <button
                      type="button"
                      onClick={() =>
                        setCalendarDate(
                          (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                        )
                      }
                      className="p-1 rounded hover:bg-slate-800 cursor-pointer text-slate-300 hover:text-white"
                      aria-label="Previous Month"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="font-display text-sm font-bold tracking-wide">
                      {calendarDate.toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCalendarDate(
                          (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                        )
                      }
                      className="p-1 rounded hover:bg-slate-800 cursor-pointer text-slate-300 hover:text-white"
                      aria-label="Next Month"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Day of week headers */}
                  <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500">
                    <span>Su</span>
                    <span>Mo</span>
                    <span>Tu</span>
                    <span>We</span>
                    <span>Th</span>
                    <span>Fr</span>
                    <span>Sa</span>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: calendarDays.firstDay }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="h-9" />
                    ))}
                    {calendarDays.days.map((item) => {
                      const isSelected = selectedCalendarDayStr === item.dateStr;
                      return (
                        <button
                          key={item.dateStr}
                          type="button"
                          onClick={() => setSelectedCalendarDayStr(item.dateStr)}
                          className={`h-9 rounded-md flex flex-col items-center justify-center text-xs font-semibold relative transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-rose-600 text-white"
                              : item.hasEvents
                              ? "bg-rose-50 text-rose-900 border border-rose-300 font-bold"
                              : "text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <span>{item.dayNumber}</span>
                          {item.hasEvents && (
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSelected ? "bg-white" : "bg-rose-600"
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Day Agenda */}
                  {selectedCalendarDayStr && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <p className="text-xs font-bold text-slate-700 mb-2">
                        Events on {formatDisplayDate(selectedCalendarDayStr)}:
                      </p>
                      {registeredDateMap.get(selectedCalendarDayStr)?.map((entry) => (
                        <div
                          key={entry.registration.id}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 mb-2"
                        >
                          <p className="font-bold text-slate-900">{entry.event.title}</p>
                          <p className="text-slate-600">
                            Time: {entry.event.event_time} · Venue: {entry.event.venue}
                          </p>
                          <button
                            type="button"
                            onClick={() => setActivePassRegistration(entry)}
                            className="mt-1 font-semibold text-rose-600 hover:underline cursor-pointer"
                          >
                            View Event Pass ({entry.registration.reference_code})
                          </button>
                        </div>
                      )) || (
                        <p className="text-xs text-slate-500 italic">
                          No registered events on this date.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: PAST EVENTS */}
              {drawerTab === "HISTORY" && (
                <>
                  {registrations.history.length === 0 ? (
                    <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center my-4">
                      <p className="text-sm font-semibold text-slate-800 mb-1">
                        No past events
                      </p>
                      <p className="text-xs text-slate-500">
                        Once an event date passes, it will appear here in your event history.
                      </p>
                    </div>
                  ) : (
                    registrations.history.map((item) => (
                      <div
                        key={item.registration.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-slate-500 tabular-nums">
                          <span className="font-mono">Pass: {item.registration.reference_code}</span>
                          <span className="text-slate-600 font-semibold">Completed</span>
                        </div>
                        <h3 className="font-display text-sm font-bold text-slate-800">
                          {item.event.title}
                        </h3>
                        <p className="text-slate-600">
                          Date: {formatDisplayDate(item.event.event_date)} · Venue: {item.event.venue}
                        </p>
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => setActivePassRegistration(item)}
                            className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline cursor-pointer"
                          >
                            View Pass
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEvaluatingOrganizer({
                                organizerId: item.event.organizer_id,
                                organizerName: item.event.organizer_name,
                                eventId: item.event.id,
                                eventTitle: item.event.title,
                              })
                            }
                            className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                          >
                            Rate Organizer
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {/* TAB 4: CHANGE PASSWORD */}
              {drawerTab === "SECURITY" && (
                <div className="space-y-4 py-2">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <KeyRound className="w-4 h-4 text-rose-600" />
                      <span>Change Account Password</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Re-enter your current password to verify your identity, then set your new password.
                    </p>
                  </div>

                  {passwordFeedback && (
                    <div
                      className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                        passwordFeedback.type === "success"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                          : "bg-rose-50 border-rose-200 text-rose-900"
                      }`}
                    >
                      {passwordFeedback.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <span>{passwordFeedback.message}</span>
                    </div>
                  )}

                  <form onSubmit={handleChangePassword} className="space-y-4 pt-1">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Current Password *
                      </label>
                      <div className="relative">
                        <input
                          type={showOldPassword ? "text" : "password"}
                          required
                          placeholder="Re-enter current password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full p-2.5 pr-12 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOldPassword(!showOldPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 text-[11px] font-medium cursor-pointer"
                        >
                          {showOldPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        New Password * (min 6 characters)
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          required
                          minLength={6}
                          placeholder="Enter new password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full p-2.5 pr-12 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 text-[11px] font-medium cursor-pointer"
                        >
                          {showNewPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Confirm New Password *
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="Re-enter new password to confirm"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={passwordSubmitting}
                        className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs"
                      >
                        {passwordSubmitting ? (
                          "Updating Password..."
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Update Password</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Footer Sign Out */}
            <div className="p-6 border-t border-slate-200">
              <button
                type="button"
                onClick={onLogout}
                className="w-full py-2.5 px-4 border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* DIGITAL EVENT PASS MODAL */}
      {activePassRegistration && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="bg-slate-950 text-white p-6 relative">
              <button
                type="button"
                onClick={() => setActivePassRegistration(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <p className="text-[11px] font-bold text-rose-500 uppercase tracking-widest">
                College Event Pass
              </p>
              <h2 className="font-display text-2xl font-black mt-1">
                {activePassRegistration.event.title}
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                {activePassRegistration.event.category} · Organized by{" "}
                {activePassRegistration.event.organizer_name}
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Pass ID Box */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Registration Pass ID
                  </span>
                  <span className="font-mono text-xl font-black text-slate-900 tracking-wider">
                    {activePassRegistration.registration.reference_code}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyPassCode(activePassRegistration.registration.reference_code)
                  }
                  className="py-1.5 px-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedPassCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy ID</span>
                    </>
                  )}
                </button>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between text-xs py-2 px-3 rounded-lg border border-slate-200">
                <span className="text-slate-600 font-medium">Attendance Status:</span>
                {activePassRegistration.registration.checked_in ? (
                  <span className="font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Checked In
                  </span>
                ) : (
                  <span className="font-bold text-rose-700 flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded">
                    <ShieldCheck className="w-3.5 h-3.5" /> Valid Pass (Not Checked In)
                  </span>
                )}
              </div>

              {/* Event Info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block">Date &amp; Time:</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">
                    {formatDisplayDate(activePassRegistration.event.event_date)} at{" "}
                    {activePassRegistration.event.event_time}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block">Venue:</span>
                  <span className="font-bold text-slate-900 mt-0.5 block truncate">
                    {activePassRegistration.event.venue}
                  </span>
                </div>
              </div>

              {/* Participant List */}
              <div>
                <p className="text-xs font-bold text-slate-800 mb-2">
                  Registered Participants ({activePassRegistration.registration.participant_count}):
                </p>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-44 overflow-y-auto">
                  {activePassRegistration.registration.participants.map((p, idx) => (
                    <div key={idx} className="p-2.5 text-xs flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">
                          #{idx + 1} {p.name}
                        </p>
                        <p className="text-slate-500 text-[11px]">{p.email} · {p.phone}</p>
                      </div>
                      {p.roll_no && (
                        <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          {p.roll_no}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-2.5 px-4 border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Pass</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePassRegistration(null)}
                  className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ANONYMOUS ORGANIZER REVIEW MODAL */}
      {evaluatingOrganizer && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div
            className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-2xl p-6 space-y-5"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">
                  Anonymous Feedback
                </p>
                <h3 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                  Review {evaluatingOrganizer.organizerName}
                </h3>
                {evaluatingOrganizer.eventTitle && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Event: {evaluatingOrganizer.eventTitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEvaluatingOrganizer(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Anonymity Notice */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>100% Anonymous:</strong> The organizer will see your star rating and feedback comment, but <strong>cannot</strong> see your name or username.
              </span>
            </div>

            <form onSubmit={handleSubmitAnonymousFeedback} className="space-y-4">
              {/* Star Rating */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Rating:
                </label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="p-1 text-amber-400 hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= reviewRating
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-300"
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-slate-700 ml-2">
                    {reviewRating} of 5
                  </span>
                </div>
              </div>

              {/* Feedback Commentary */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Your Feedback / Suggestions:
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Tell the organizer how the event went, what was good, or what could be improved..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="w-full p-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEvaluatingOrganizer(null)}
                  className="py-2 px-3.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submittingReview ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EVENT DETAILS, REGISTRATION & FAQ MODAL */}
      {selectedEventId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div
            className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
          >
            {modalLoading || !modalEvent ? (
              <div className="p-12 text-center text-sm text-slate-500">
                Loading event details...
              </div>
            ) : (
              <div>
                {/* Banner with Date Badge */}
                <div className="relative h-56 sm:h-64 bg-slate-900">
                  <EventImage
                    imageUrl={modalEvent.image_url}
                    category={modalEvent.category}
                    alt={modalEvent.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />

                  {/* Close button */}
                  <button
                    type="button"
                    onClick={closeEventDetails}
                    className="absolute top-4 right-4 p-2 rounded-lg bg-slate-950/70 text-white hover:bg-slate-950 transition-colors cursor-pointer"
                    aria-label="Close modal"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {/* Highlighted Date Badge */}
                  {(() => {
                    const shortDate = formatShortMonthDay(modalEvent.event_date);
                    return (
                      <div className="absolute top-4 left-6 bg-slate-950/90 border border-rose-500/60 backdrop-blur-md px-3.5 py-2 rounded-lg shadow-lg flex flex-col items-center leading-none">
                        <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                          {shortDate.month}
                        </span>
                        <span className="text-2xl font-black text-white mt-0.5 tracking-tight">
                          {shortDate.day}
                        </span>
                      </div>
                    );
                  })()}

                  <div className="absolute bottom-5 left-6 right-6 text-white">
                    <p className="text-xs text-slate-200 mb-1">
                      {modalEvent.category} · Organized by{" "}
                      <span className="font-semibold">{modalEvent.organizer_name}</span>
                    </p>
                    <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
                      {modalEvent.title}
                    </h2>
                  </div>
                </div>

                <div className="p-6 sm:p-8 space-y-8">
                  {/* Event Core Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-4 border-y border-slate-200 text-sm tabular-nums">
                    <div>
                      <span className="text-xs text-slate-500 flex items-center gap-1.5">
                        <CalendarIcon className="w-3.5 h-3.5 text-rose-600" /> Registration Deadline
                      </span>
                      <p className="font-semibold text-slate-900 mt-0.5">
                        {formatDisplayDate(modalEvent.registration_deadline)}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs text-slate-500 flex items-center gap-1.5">
                        <CalendarIcon className="w-3.5 h-3.5 text-rose-600" /> Event Date &amp; Time
                      </span>
                      <p className="font-semibold text-slate-900 mt-0.5">
                        {formatDisplayDate(modalEvent.event_date)} at {modalEvent.event_time}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs text-slate-500 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-rose-600" /> Venue
                      </span>
                      <p className="font-semibold text-slate-900 mt-0.5">
                        {modalEvent.venue}
                      </p>
                    </div>

                    {modalEvent.prizes && (
                      <div>
                        <span className="text-xs text-amber-700 font-bold flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5" /> Prize Pool
                        </span>
                        <p className="font-semibold text-slate-900 mt-0.5">
                          {modalEvent.prizes}
                        </p>
                      </div>
                    )}

                    {modalEvent.show_remaining_seats && modalEvent.max_capacity && (
                      <div>
                        <span className="text-xs text-slate-500 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-rose-600" /> Seats Left
                        </span>
                        <p className="font-semibold text-rose-600 mt-0.5">
                          {Math.max(0, modalEvent.max_capacity - modalEvent.participants_count)} available (of {modalEvent.max_capacity})
                        </p>
                      </div>
                    )}

                    <div>
                      <span className="text-xs text-slate-500">
                        Registration Fee
                      </span>
                      <p className="font-semibold text-slate-900 mt-0.5">
                        {formatEventCost(modalEvent.cost)}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-rose-600" /> Organizer Phone
                      </span>
                      <a
                        href={`tel:${modalEvent.organizer_phone}`}
                        className="font-semibold text-rose-600 hover:underline mt-0.5 inline-block"
                      >
                        {modalEvent.organizer_phone}
                      </a>
                    </div>
                  </div>

                  {/* Organizer Announcements */}
                  {modalAnnouncements.length > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                        <Bell className="w-4 h-4 text-amber-600" />
                        <span>Organizer Announcements ({modalAnnouncements.length})</span>
                      </div>
                      {modalAnnouncements.map((a) => (
                        <div key={a.id} className="text-xs text-amber-950 pl-3 border-l-2 border-amber-500 py-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{a.title}</span>
                            {a.is_urgent && (
                              <span className="text-[10px] bg-rose-600 text-white font-bold px-1.5 py-0.2 rounded uppercase">
                                Urgent
                              </span>
                            )}
                            <span className="text-slate-400 text-[10px]">
                              {formatDisplayDate(a.created_at.slice(0, 10))}
                            </span>
                          </div>
                          <p className="text-amber-900 mt-0.5 leading-relaxed">{a.message}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* About the Event */}
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 mb-2">
                      About This Event
                    </h3>
                    <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                      {modalEvent.description}
                    </p>
                  </div>

                  {/* Registration Feedback Notice */}
                  {regFeedback && (
                    <div
                      className={`p-4 rounded-lg border text-xs flex items-start gap-2.5 ${
                        regFeedback.type === "success"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                          : "bg-rose-50 border-rose-200 text-rose-900"
                      }`}
                    >
                      {regFeedback.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <span>{regFeedback.text}</span>
                    </div>
                  )}

                  {/* Registration Section */}
                  <div className="pt-2">
                    {currentRegistrationMatch ? (
                      <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>
                                Registered · Pass ID{" "}
                                <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-200">
                                  {currentRegistrationMatch.registration.reference_code}
                                </span>
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 tabular-nums">
                              {currentRegistrationMatch.registration.participant_count} registered participant(s)
                              {currentRegistrationMatch.registration.team_name
                                ? ` · Team "${currentRegistrationMatch.registration.team_name}"`
                                : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                closeEventDetails();
                                setActivePassRegistration(currentRegistrationMatch);
                              }}
                              className="py-2 px-3.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              Open Event Pass
                            </button>
                            {!isRegistrationClosed && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleCancelRegistration(modalEvent.id)
                                }
                                className="py-2 px-3.5 text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                              >
                                Cancel Registration
                              </button>
                            )}
                          </div>
                        </div>

                        {/* List all registered members */}
                        <div className="border-t border-slate-200 pt-3 space-y-2">
                          <p className="text-xs font-semibold text-slate-700">
                            Registered Participants:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {currentRegistrationMatch.registration.participants.map(
                              (p, idx) => (
                                <div
                                  key={idx}
                                  className="p-2.5 bg-white border border-slate-200 rounded-lg"
                                >
                                  <p className="font-semibold text-slate-900">
                                    #{idx + 1} {p.name}
                                  </p>
                                  <p className="text-slate-600">{p.email}</p>
                                  <p className="text-slate-600">{p.phone}</p>
                                  {p.roll_no && (
                                    <p className="text-slate-500 mt-0.5">
                                      Roll / Dept: {p.roll_no}
                                    </p>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    ) : isRegistrationClosed ? (
                      <div className="p-4 rounded-lg bg-slate-100 border border-slate-200 text-xs font-medium text-slate-600">
                        Registration for this event is closed.
                      </div>
                    ) : !showRegForm ? (
                      <button
                        type="button"
                        onClick={() => setShowRegForm(true)}
                        className="py-3 px-6 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-md hover:shadow-rose-600/30"
                      >
                        Register for This Event
                      </button>
                    ) : (
                      <form
                        onSubmit={handleConfirmRegistration}
                        className="p-5 sm:p-6 rounded-xl bg-slate-50 border border-slate-200 space-y-6"
                      >
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                          <div>
                            <h4 className="font-display text-base font-bold text-slate-900">
                              Participant Information
                            </h4>
                            <p className="text-xs text-slate-600 mt-0.5">
                              If registering a team, enter the details for each participant below. All details will be saved.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowRegForm(false)}
                            className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>

                        {/* Team Name */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Team Name (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. CyberKnights"
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                          />
                        </div>

                        {/* Dynamic Participant List */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">
                              Participants ({participantList.length} of {modalEvent.max_team_size || 10} max)
                            </span>
                            {participantList.length < (modalEvent.max_team_size || 10) && (
                              <button
                                type="button"
                                onClick={handleAddParticipant}
                                className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" /> Add Participant
                              </button>
                            )}
                          </div>

                          {participantList.map((p, idx) => (
                            <div
                              key={idx}
                              className="p-4 bg-white border border-slate-200 rounded-lg space-y-3 relative"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-800">
                                  Participant #{idx + 1}{idx === 0 ? " (You / Lead)" : ""}
                                </span>
                                {idx > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveParticipant(idx)}
                                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                                    aria-label="Remove participant"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div>
                                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                                    Full Name *
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="Full Name"
                                    value={p.name}
                                    onChange={(e) =>
                                      handleParticipantChange(idx, "name", e.target.value)
                                    }
                                    className="w-full p-2 text-xs bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-hidden focus:border-slate-900"
                                  />
                                </div>

                                <div>
                                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                                    Email Address *
                                  </label>
                                  <input
                                    type="email"
                                    required
                                    placeholder="student@college.edu"
                                    value={p.email}
                                    onChange={(e) =>
                                      handleParticipantChange(idx, "email", e.target.value)
                                    }
                                    className="w-full p-2 text-xs bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-hidden focus:border-slate-900"
                                  />
                                </div>

                                <div>
                                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                                    Phone Number *
                                  </label>
                                  <input
                                    type="tel"
                                    required
                                    placeholder="Phone number"
                                    value={p.phone}
                                    onChange={(e) =>
                                      handleParticipantChange(idx, "phone", e.target.value)
                                    }
                                    className="w-full p-2 text-xs bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-hidden focus:border-slate-900"
                                  />
                                </div>

                                <div>
                                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                                    Roll No / Department (Optional)
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="e.g. 21CS042"
                                    value={p.roll_no || ""}
                                    onChange={(e) =>
                                      handleParticipantChange(idx, "roll_no", e.target.value)
                                    }
                                    className="w-full p-2 text-xs bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-hidden focus:border-slate-900"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Notes */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Additional Notes (Optional)
                          </label>
                          <textarea
                            rows={2}
                            placeholder="Any questions or special requirements..."
                            value={regNotes}
                            onChange={(e) => setRegNotes(e.target.value)}
                            className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                          <button
                            type="button"
                            onClick={() => setShowRegForm(false)}
                            className="py-2.5 px-4 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={regSubmitting}
                            className="py-2.5 px-6 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-md"
                          >
                            {regSubmitting
                              ? "Registering..."
                              : `Confirm Registration (${participantList.length} ${
                                  participantList.length > 1 ? "Participants" : "Participant"
                                })`}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* FAQs */}
                  <div className="pt-6 border-t border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-rose-600" />
                        <span>Questions &amp; Answers ({modalFaqs.length})</span>
                      </h4>
                    </div>

                    <div className="space-y-3">
                      {modalFaqs.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">
                          No questions asked yet. Ask the organizer anything below.
                        </p>
                      ) : (
                        modalFaqs.map((faq) => (
                          <div
                            key={faq.id}
                            className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5"
                          >
                            <p className="font-semibold text-slate-900">
                              Q: {faq.question}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Asked by {faq.asked_by_name} · {formatDisplayDate(faq.created_at.slice(0, 10))}
                            </p>
                            {faq.answer ? (
                              <div className="mt-2 pl-3 border-l-2 border-rose-500 text-slate-800">
                                <span className="font-bold text-rose-600">Organizer Answer: </span>
                                <span>{faq.answer}</span>
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400 italic">
                                Waiting for organizer answer.
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Ask a Question Form */}
                    <form onSubmit={handleSubmitQuestion} className="flex gap-2 pt-2">
                      <input
                        type="text"
                        placeholder="Ask a question about the event..."
                        value={questionText}
                        onChange={(e) => setQuestionText(e.target.value)}
                        className="flex-1 p-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                      />
                      <button
                        type="submit"
                        disabled={faqSubmitting || !questionText.trim()}
                        className="py-2.5 px-4 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {faqSubmitting ? "Sending..." : "Ask Question"}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
