import React, { useState, useEffect, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  Plus,
  FileSpreadsheet,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Search,
  Users,
  CheckCheck,
  Trophy,
  Bell,
  Star,
  ShieldCheck,
  Eye,
  EyeOff,
  Calendar,
  Clock,
  MapPin,
  Phone,
  KeyRound,
  Check,
} from "lucide-react";
import { apiRequest, ApiError } from "../api";
import {
  User,
  CampusEvent,
  RegistrationRecord,
  FAQItem,
  EventAnnouncement,
  OrganizerFeedback,
  OrganizerProfileStats,
  PRESET_GALLERY_OPTIONS,
  resolveEventBanner,
  formatEventCost,
  formatDisplayDate,
  formatShortMonthDay,
} from "../types";
import { EventImage } from "./EventImage";

export type OrganizerTab = "MANAGE" | "CREATE" | "PROFILE";

interface OrganizerDashboardProps {
  user: User;
  activeTab: OrganizerTab;
  onChangeTab: (tab: OrganizerTab) => void;
}

export const OrganizerDashboard: React.FC<OrganizerDashboardProps> = ({
  user,
  activeTab,
  onChangeTab,
}) => {
  const [hostedEvents, setHostedEvents] = useState<CampusEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [manageSubTab, setManageSubTab] = useState<
    "PARTICIPANTS" | "PASS_TRACKER" | "ANNOUNCEMENTS" | "FAQS" | "EDIT"
  >("PARTICIPANTS");

  const [activeEvent, setActiveEvent] = useState<CampusEvent | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
  const [eventFaqs, setEventFaqs] = useState<FAQItem[]>([]);
  const [eventAnnouncements, setEventAnnouncements] = useState<EventAnnouncement[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Notice Toast
  const [bannerMessage, setBannerMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Pass Tracker State
  const [passSearchQuery, setPassSearchQuery] = useState("");
  const [passCheckingIn, setPassCheckingIn] = useState<string | null>(null);

  // Announcement State
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMsg, setAnnouncementMsg] = useState("");
  const [announcementUrgent, setAnnouncementUrgent] = useState(false);
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  // Create Event Form State
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Hackathon");
  const [newDesc, setNewDesc] = useState("");
  const [newVenue, setNewVenue] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("10:00");
  const [newDeadline, setNewDeadline] = useState("");
  const [newCost, setNewCost] = useState("0");
  const [newPrizes, setNewPrizes] = useState("");
  const [newCapacity, setNewCapacity] = useState("");
  const [newShowRemainingSeats, setNewShowRemainingSeats] = useState(false);
  const [newMinTeam, setNewMinTeam] = useState("1");
  const [newMaxTeam, setNewMaxTeam] = useState("4");
  const [newPhone, setNewPhone] = useState(user.phone || "");
  const [newImageUrl, setNewImageUrl] = useState(PRESET_GALLERY_OPTIONS[0].url);
  const [initialFaqs, setInitialFaqs] = useState<Array<{ question: string; answer: string }>>([
    { question: "", answer: "" },
  ]);
  const [creating, setCreating] = useState(false);

  // Edit Event State
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editVenue, setEditVenue] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editCost, setEditCost] = useState("0");
  const [editPrizes, setEditPrizes] = useState("");
  const [editCapacity, setEditCapacity] = useState("");
  const [editShowRemainingSeats, setEditShowRemainingSeats] = useState(false);
  const [editMinTeam, setEditMinTeam] = useState("1");
  const [editMaxTeam, setEditMaxTeam] = useState("4");
  const [editPhone, setEditPhone] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // FAQ State
  const [faqDrafts, setFaqDrafts] = useState<Record<string, string>>({});
  const [newOrgFaqQ, setNewOrgFaqQ] = useState("");
  const [newOrgFaqA, setNewOrgFaqA] = useState("");

  // Profile State
  const [profileData, setProfileData] = useState<OrganizerProfileStats | null>(null);

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
        message: res.message || "Password updated successfully!",
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

  const showNotice = (type: "success" | "error", text: string) => {
    setBannerMessage({ type, text });
    setTimeout(() => {
      setBannerMessage((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const loadHostedEvents = useCallback(
    async (preferredId?: string | null) => {
      setLoadingEvents(true);
      try {
        const res = await apiRequest<{ events: CampusEvent[] }>("/api/organizer/events");
        const list = res.events || [];
        setHostedEvents(list);
        const targetId =
          preferredId && list.some((e) => e.id === preferredId)
            ? preferredId
            : selectedEventId && list.some((e) => e.id === selectedEventId)
            ? selectedEventId
            : list[0]?.id || null;

        setSelectedEventId(targetId);
      } finally {
        setLoadingEvents(false);
      }
    },
    [selectedEventId]
  );

  const loadSelectedEventDetail = useCallback(async (eventId: string) => {
    const res = await apiRequest<{
      event: CampusEvent;
      registrations: RegistrationRecord[];
      faqs: FAQItem[];
      announcements?: EventAnnouncement[];
    }>(`/api/organizer/events/${eventId}/participants`);

    const ev = res.event;
    setActiveEvent(ev);
    setRegistrations(res.registrations || []);
    setEventFaqs(res.faqs || []);
    setEventAnnouncements(res.announcements || []);
    setConfirmDelete(false);

    // Populate edit fields
    setEditTitle(ev.title);
    setEditCategory(ev.category);
    setEditDesc(ev.description);
    setEditVenue(ev.venue);
    setEditDate(ev.event_date);
    setEditTime(ev.event_time);
    setEditDeadline(ev.registration_deadline);
    setEditCost(String(ev.cost));
    setEditPrizes(ev.prizes || "");
    setEditCapacity(ev.max_capacity ? String(ev.max_capacity) : "");
    setEditShowRemainingSeats(Boolean(ev.show_remaining_seats));
    setEditMinTeam(String(ev.min_team_size || 1));
    setEditMaxTeam(String(ev.max_team_size || 4));
    setEditPhone(ev.organizer_phone);
    setEditImageUrl(ev.image_url);

    const drafts: Record<string, string> = {};
    for (const f of res.faqs || []) {
      drafts[f.id] = f.answer || "";
    }
    setFaqDrafts(drafts);
  }, []);

  const loadProfile = useCallback(async () => {
    const res = await apiRequest<OrganizerProfileStats>("/api/organizer/profile");
    setProfileData(res);
  }, []);

  useEffect(() => {
    if (activeTab === "MANAGE") {
      loadHostedEvents();
    } else if (activeTab === "PROFILE") {
      loadProfile();
    }
  }, [activeTab, loadHostedEvents, loadProfile]);

  useEffect(() => {
    if (selectedEventId && activeTab === "MANAGE") {
      loadSelectedEventDetail(selectedEventId);
    }
  }, [selectedEventId, activeTab, loadSelectedEventDetail]);

  // Create Event Form Handler
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const cleanFaqs = initialFaqs
        .filter((f) => f.question.trim().length > 0)
        .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }));

      const res = await apiRequest<{ event: CampusEvent }>("/api/events", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle.trim(),
          category: newCategory.trim(),
          description: newDesc.trim(),
          venue: newVenue.trim(),
          event_date: newDate.trim(),
          event_time: newTime.trim(),
          registration_deadline: newDeadline.trim(),
          cost: Number(newCost || 0),
          prizes: newPrizes.trim() || undefined,
          max_capacity: newCapacity ? Number(newCapacity) : null,
          show_remaining_seats: newShowRemainingSeats,
          min_team_size: Number(newMinTeam || 1),
          max_team_size: Number(newMaxTeam || 4),
          organizer_phone: newPhone.trim(),
          image_url: newImageUrl.trim(),
          initial_faqs: cleanFaqs,
        }),
      });

      showNotice("success", `Event "${res.event.title}" created successfully!`);
      // Reset form
      setNewTitle("");
      setNewDesc("");
      setNewVenue("");
      setNewDate("");
      setNewDeadline("");
      setNewCost("0");
      setNewPrizes("");
      setNewCapacity("");
      setNewShowRemainingSeats(false);
      setInitialFaqs([{ question: "", answer: "" }]);

      onChangeTab("MANAGE");
      await loadHostedEvents(res.event.id);
    } catch (err) {
      showNotice(
        "error",
        err instanceof ApiError ? err.message : "Failed to create event."
      );
    } finally {
      setCreating(false);
    }
  };

  // Edit Event Form Handler
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent) return;
    setSavingEdit(true);
    try {
      const res = await apiRequest<{ event: CampusEvent }>(
        `/api/events/${activeEvent.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            title: editTitle.trim(),
            category: editCategory.trim(),
            description: editDesc.trim(),
            venue: editVenue.trim(),
            event_date: editDate.trim(),
            event_time: editTime.trim(),
            registration_deadline: editDeadline.trim(),
            cost: Number(editCost || 0),
            prizes: editPrizes.trim() || undefined,
            max_capacity: editCapacity ? Number(editCapacity) : null,
            show_remaining_seats: editShowRemainingSeats,
            min_team_size: Number(editMinTeam || 1),
            max_team_size: Number(editMaxTeam || 4),
            organizer_phone: editPhone.trim(),
            image_url: editImageUrl.trim(),
          }),
        }
      );
      setActiveEvent(res.event);
      showNotice("success", "Event details updated successfully.");
      await loadHostedEvents(res.event.id);
    } catch (err) {
      showNotice(
        "error",
        err instanceof ApiError ? err.message : "Failed to update event."
      );
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Event
  const handleDeleteEvent = async () => {
    if (!activeEvent) return;
    try {
      await apiRequest(`/api/events/${activeEvent.id}`, { method: "DELETE" });
      showNotice("success", `Event "${activeEvent.title}" deleted.`);
      setActiveEvent(null);
      setSelectedEventId(null);
      await loadHostedEvents();
    } catch (err) {
      showNotice(
        "error",
        err instanceof ApiError ? err.message : "Failed to delete event."
      );
    }
  };

  // Check-In Pass Toggle (Pass Tracker)
  const handleToggleCheckin = async (reg: RegistrationRecord) => {
    if (!activeEvent) return;
    setPassCheckingIn(reg.id);
    try {
      const res = await apiRequest<{
        registration: RegistrationRecord;
        event: CampusEvent;
      }>(`/api/organizer/events/${activeEvent.id}/checkin`, {
        method: "PUT",
        body: JSON.stringify({
          registration_id: reg.id,
          toggle: true,
        }),
      });
      setRegistrations((prev) =>
        prev.map((r) => (r.id === res.registration.id ? res.registration : r))
      );
      showNotice(
        "success",
        res.registration.checked_in
          ? `Pass ${res.registration.reference_code} marked as checked in!`
          : `Pass ${res.registration.reference_code} marked as not checked in.`
      );
    } catch (err) {
      showNotice(
        "error",
        err instanceof ApiError ? err.message : "Could not update check-in status."
      );
    } finally {
      setPassCheckingIn(null);
    }
  };

  // Post Announcement
  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent || !announcementTitle.trim() || !announcementMsg.trim()) return;
    setPostingAnnouncement(true);
    try {
      const res = await apiRequest<{ announcement: EventAnnouncement }>(
        `/api/events/${activeEvent.id}/announcements`,
        {
          method: "POST",
          body: JSON.stringify({
            title: announcementTitle.trim(),
            message: announcementMsg.trim(),
            is_urgent: announcementUrgent,
          }),
        }
      );
      setEventAnnouncements((prev) => [res.announcement, ...prev]);
      setAnnouncementTitle("");
      setAnnouncementMsg("");
      setAnnouncementUrgent(false);
      showNotice("success", "Announcement sent to all registered participants.");
    } catch (err) {
      showNotice(
        "error",
        err instanceof ApiError ? err.message : "Failed to post announcement."
      );
    } finally {
      setPostingAnnouncement(false);
    }
  };

  // Delete Announcement
  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!activeEvent) return;
    try {
      await apiRequest(
        `/api/events/${activeEvent.id}/announcements/${announcementId}`,
        { method: "DELETE" }
      );
      setEventAnnouncements((prev) => prev.filter((a) => a.id !== announcementId));
      showNotice("success", "Announcement deleted.");
    } catch (err) {
      showNotice(
        "error",
        err instanceof ApiError ? err.message : "Failed to delete announcement."
      );
    }
  };

  // Save FAQ Answer
  const handleSaveFaqAnswer = async (faqId: string) => {
    if (!activeEvent) return;
    const answer = faqDrafts[faqId] || "";
    try {
      const res = await apiRequest<{ faq: FAQItem }>(
        `/api/events/${activeEvent.id}/faqs/${faqId}`,
        {
          method: "PUT",
          body: JSON.stringify({ answer }),
        }
      );
      setEventFaqs((prev) => prev.map((f) => (f.id === faqId ? res.faq : f)));
      showNotice("success", "Answer posted.");
    } catch (err) {
      showNotice(
        "error",
        err instanceof ApiError ? err.message : "Failed to post answer."
      );
    }
  };

  // Add Organizer FAQ
  const handleAddConvenorFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent || !newOrgFaqQ.trim() || !newOrgFaqA.trim()) return;
    try {
      const res = await apiRequest<{ faq: FAQItem }>(
        `/api/events/${activeEvent.id}/faqs`,
        {
          method: "POST",
          body: JSON.stringify({
            question: newOrgFaqQ.trim(),
            answer: newOrgFaqA.trim(),
          }),
        }
      );
      setEventFaqs((prev) => [...prev, res.faq]);
      setFaqDrafts((prev) => ({ ...prev, [res.faq.id]: res.faq.answer || "" }));
      setNewOrgFaqQ("");
      setNewOrgFaqA("");
      showNotice("success", "FAQ added to event page.");
    } catch (err) {
      showNotice(
        "error",
        err instanceof ApiError ? err.message : "Failed to add FAQ."
      );
    }
  };

  // EXCEL SPREADSHEET EXPORT
  const handleExportExcel = () => {
    if (!activeEvent || registrations.length === 0) {
      showNotice("error", "No participant registrations to export.");
      return;
    }

    const rows: Array<Record<string, string | number>> = [];
    let serial = 1;

    for (const reg of registrations) {
      for (let i = 0; i < reg.participants.length; i++) {
        const p = reg.participants[i];
        rows.push({
          "S.No": serial++,
          "Pass ID": reg.reference_code,
          "Attendance Status": reg.checked_in ? "CHECKED IN" : "NOT CHECKED IN",
          "Check-In Time": reg.checked_in_at
            ? new Date(reg.checked_in_at).toLocaleString()
            : "—",
          "Team Name": reg.team_name || "Individual",
          "Role": i === 0 ? "Lead Participant" : `Participant #${i + 1}`,
          "Name": p.name,
          "Email": p.email,
          "Phone": p.phone,
          "Roll No / Dept": p.roll_no || p.department || "—",
          "Registered Username": reg.student_username,
          "Registration Date": new Date(reg.registered_at).toLocaleString(),
          "Notes": reg.notes || "None",
          "Event": activeEvent.title,
          "Category": activeEvent.category,
          "Date": activeEvent.event_date,
          "Venue": activeEvent.venue,
        });
      }
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Participants");

    const safeTitle = activeEvent.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    const filename = `${safeTitle}_Participants.xlsx`;
    XLSX.writeFile(wb, filename);

    showNotice("success", `Spreadsheet "${filename}" downloaded!`);
  };

  // Filtered registrations in Participants tab
  const filteredRegistrations = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return registrations;
    return registrations.filter((r) => {
      const matchLead =
        r.reference_code.toLowerCase().includes(q) ||
        r.student_name.toLowerCase().includes(q) ||
        r.student_username.toLowerCase().includes(q) ||
        (r.team_name && r.team_name.toLowerCase().includes(q));
      if (matchLead) return true;
      return r.participants.some(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          (p.roll_no && p.roll_no.toLowerCase().includes(q))
      );
    });
  }, [registrations, searchFilter]);

  // Filtered registrations in Pass Tracker tab
  const trackedPassRegistrations = useMemo(() => {
    const q = passSearchQuery.trim().toLowerCase();
    if (!q) return registrations;
    return registrations.filter((r) => {
      return (
        r.reference_code.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.student_name.toLowerCase().includes(q) ||
        r.student_username.toLowerCase().includes(q) ||
        (r.team_name && r.team_name.toLowerCase().includes(q)) ||
        r.participants.some(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.email.toLowerCase().includes(q) ||
            p.phone.includes(q) ||
            (p.roll_no && p.roll_no.toLowerCase().includes(q))
        )
      );
    });
  }, [registrations, passSearchQuery]);

  return (
    <div className="max-w-[1240px] mx-auto px-6 py-8">
      {/* Toast Alert */}
      {bannerMessage && (
        <div
          className={`mb-6 p-4 rounded-xl border text-xs flex items-center justify-between gap-3 shadow-md ${
            bannerMessage.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-950"
              : "bg-rose-50 border-rose-300 text-rose-950"
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{bannerMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* TAB 1: MANAGE EVENTS */}
      {activeTab === "MANAGE" && (
        <div>
          {loadingEvents ? (
            <div className="h-64 rounded-xl bg-white border border-slate-200 animate-pulse" />
          ) : hostedEvents.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-xl mx-auto space-y-4">
              <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">
                Organizer Dashboard
              </p>
              <h2 className="font-display text-2xl font-bold text-slate-900">
                You haven&apos;t created any events yet.
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Create your first college event with custom categories, venue, seat limits, prizes, and registration settings.
              </p>
              <button
                type="button"
                onClick={() => onChangeTab("CREATE")}
                className="py-2.5 px-6 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Event</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Hosted Events List */}
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Your Events
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Select an event to manage
                    </p>
                  </div>
                  <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                    {hostedEvents.length} Active
                  </span>
                </div>

                <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100">
                  {hostedEvents.map((ev) => {
                    const isSelected = ev.id === selectedEventId;
                    const shortDate = formatShortMonthDay(ev.event_date);
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => setSelectedEventId(ev.id)}
                        className={`w-full text-left p-4 transition-colors cursor-pointer flex items-start gap-3 ${
                          isSelected
                            ? "bg-rose-50/70 border-l-4 border-rose-600"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        {/* Highlighted Date Tile */}
                        <div className="bg-slate-900 text-white px-2 py-1.5 rounded flex flex-col items-center shrink-0 leading-none">
                          <span className="text-[9px] font-bold text-rose-400 uppercase">
                            {shortDate.month}
                          </span>
                          <span className="text-sm font-black mt-0.5">
                            {shortDate.day}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 tabular-nums">
                            <span>{ev.category}</span>
                            <span className="font-bold text-slate-900">
                              {ev.participants_count} participants
                            </span>
                          </div>
                          <p className="font-display text-sm font-bold text-slate-900 truncate mt-0.5">
                            {ev.title}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {ev.venue}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                            {ev.is_completed ? (
                              <span className="text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-medium">
                                Completed
                              </span>
                            ) : (
                              <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-semibold">
                                Active
                              </span>
                            )}
                            {ev.unanswered_faqs ? (
                              <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-semibold">
                                {ev.unanswered_faqs} question pending
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Selected Event Workspace */}
              {activeEvent && (
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
                  {/* Event Top Header */}
                  <div className="p-6 border-b border-slate-200 bg-slate-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-rose-400 font-semibold mb-1">
                        <span>{activeEvent.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDisplayDate(activeEvent.event_date)} at {activeEvent.event_time}</span>
                      </div>
                      <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight">
                        {activeEvent.title}
                      </h2>
                      <p className="text-xs text-slate-300 mt-1">
                        Venue: {activeEvent.venue} · Contact: {activeEvent.organizer_phone}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleExportExcel}
                        className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Download Participants as Excel (.xlsx)"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Export Excel</span>
                      </button>
                    </div>
                  </div>

                  {/* Sub-Tabs Navigation */}
                  <div className="flex items-center border-b border-slate-200 px-6 overflow-x-auto text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setManageSubTab("PARTICIPANTS")}
                      className={`py-3.5 px-3 border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                        manageSubTab === "PARTICIPANTS"
                          ? "border-rose-600 text-rose-600"
                          : "border-transparent text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Participants ({registrations.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setManageSubTab("PASS_TRACKER")}
                      className={`py-3.5 px-3 border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                        manageSubTab === "PASS_TRACKER"
                          ? "border-rose-600 text-rose-600"
                          : "border-transparent text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Pass Check-In</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setManageSubTab("ANNOUNCEMENTS")}
                      className={`py-3.5 px-3 border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                        manageSubTab === "ANNOUNCEMENTS"
                          ? "border-rose-600 text-rose-600"
                          : "border-transparent text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Announcements ({eventAnnouncements.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setManageSubTab("FAQS")}
                      className={`py-3.5 px-3 border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                        manageSubTab === "FAQS"
                          ? "border-rose-600 text-rose-600"
                          : "border-transparent text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Questions ({eventFaqs.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setManageSubTab("EDIT")}
                      className={`py-3.5 px-3 border-b-2 whitespace-nowrap cursor-pointer ${
                        manageSubTab === "EDIT"
                          ? "border-rose-600 text-rose-600"
                          : "border-transparent text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Edit Event
                    </button>
                  </div>

                  {/* SUB-TAB CONTENT */}
                  <div className="p-6">
                    {/* 1. PARTICIPANTS LIST & EXCEL */}
                    {manageSubTab === "PARTICIPANTS" && (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <h4 className="font-display text-sm font-bold text-slate-900">
                              Registered Participants &amp; Teams
                            </h4>
                            <p className="text-xs text-slate-500">
                              Total Headcount: {activeEvent.participants_count}
                              {activeEvent.max_capacity
                                ? ` / ${activeEvent.max_capacity} Seats Capacity`
                                : " registered participants"}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                type="text"
                                placeholder="Search by name, pass ID, team..."
                                value={searchFilter}
                                onChange={(e) => setSearchFilter(e.target.value)}
                                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:border-slate-900"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleExportExcel}
                              className="py-1.5 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Excel</span>
                            </button>
                          </div>
                        </div>

                        {filteredRegistrations.length === 0 ? (
                          <div className="p-10 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
                            {registrations.length === 0
                              ? "No registrations yet. When students register, their details will appear here."
                              : "No registrations match your search filter."}
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[500px] overflow-y-auto">
                            {filteredRegistrations.map((reg) => (
                              <div
                                key={reg.id}
                                className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                  <div>
                                    <span className="font-mono font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded">
                                      {reg.reference_code}
                                    </span>
                                    {reg.team_name && (
                                      <span className="font-semibold text-rose-700 ml-2">
                                        Team: &quot;{reg.team_name}&quot;
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-slate-500 tabular-nums">
                                    <span>
                                      {reg.participant_count} Participant{reg.participant_count > 1 ? "s" : ""}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span>
                                      {new Date(reg.registered_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>

                                {/* Participant Details Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                  {reg.participants.map((p, idx) => (
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
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                          ID: {p.roll_no}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>

                                {reg.notes && (
                                  <p className="text-[11px] text-slate-600 italic bg-white p-2 rounded border border-slate-100">
                                    Note: &quot;{reg.notes}&quot;
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2. PASS TRACKER & CHECK-IN */}
                    {manageSubTab === "PASS_TRACKER" && (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <h4 className="font-display text-sm font-bold text-slate-900">
                              Pass Check-In &amp; Attendance
                            </h4>
                            <p className="text-xs text-slate-500">
                              Search Pass IDs or participant names to mark attendance
                            </p>
                          </div>

                          <div className="relative w-full sm:w-64">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              placeholder="Enter Pass ID (e.g. EM-XXXX)..."
                              value={passSearchQuery}
                              onChange={(e) => setPassSearchQuery(e.target.value)}
                              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:border-slate-900"
                            />
                          </div>
                        </div>

                        {trackedPassRegistrations.length === 0 ? (
                          <div className="p-10 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
                            No passes found matching &quot;{passSearchQuery}&quot;.
                          </div>
                        ) : (
                          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                            {trackedPassRegistrations.map((reg) => (
                              <div
                                key={reg.id}
                                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white hover:bg-slate-50/70 transition-colors"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                                      {reg.reference_code}
                                    </span>
                                    {reg.team_name && (
                                      <span className="text-xs font-semibold text-rose-700">
                                        Team {reg.team_name}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-700 font-semibold">
                                    Lead: {reg.student_name} ({reg.participant_count} participants)
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    {reg.participants.map((p) => p.name).join(", ")}
                                  </p>
                                </div>

                                <div className="flex items-center gap-3">
                                  {reg.checked_in ? (
                                    <div className="text-right">
                                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Checked In
                                      </span>
                                      {reg.checked_in_at && (
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                          {new Date(reg.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded">
                                      Not Checked In
                                    </span>
                                  )}

                                  <button
                                    type="button"
                                    disabled={passCheckingIn === reg.id}
                                    onClick={() => handleToggleCheckin(reg)}
                                    className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                                      reg.checked_in
                                        ? "border border-slate-300 text-slate-700 hover:bg-slate-100"
                                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                    }`}
                                  >
                                    {passCheckingIn === reg.id
                                      ? "Updating..."
                                      : reg.checked_in
                                      ? "Undo Check-In"
                                      : "Check In Attendee"}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. ANNOUNCEMENTS */}
                    {manageSubTab === "ANNOUNCEMENTS" && (
                      <div className="space-y-6">
                        {/* Compose Announcement */}
                        <form
                          onSubmit={handlePostAnnouncement}
                          className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4"
                        >
                          <div>
                            <h4 className="font-display text-sm font-bold text-slate-900">
                              Post Announcement to Registered Participants
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              This announcement will be shown only to students who have registered for this event.
                            </p>
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">
                              Announcement Title *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Venue Change / Schedule Update"
                              value={announcementTitle}
                              onChange={(e) => setAnnouncementTitle(e.target.value)}
                              className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">
                              Message *
                            </label>
                            <textarea
                              rows={3}
                              required
                              placeholder="Type your announcement or instructions here..."
                              value={announcementMsg}
                              onChange={(e) => setAnnouncementMsg(e.target.value)}
                              className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={announcementUrgent}
                                onChange={(e) => setAnnouncementUrgent(e.target.checked)}
                                className="rounded text-rose-600 focus:ring-0 cursor-pointer"
                              />
                              <span className="font-semibold text-rose-600">
                                Mark as Urgent
                              </span>
                            </label>

                            <button
                              type="submit"
                              disabled={postingAnnouncement}
                              className="py-2 px-5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {postingAnnouncement ? "Posting..." : "Post Announcement"}
                            </button>
                          </div>
                        </form>

                        {/* List of Previous Announcements */}
                        <div className="space-y-3">
                          <h4 className="font-display text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Posted Announcements ({eventAnnouncements.length})
                          </h4>
                          {eventAnnouncements.length === 0 ? (
                            <p className="text-xs text-slate-500 italic">
                              No announcements posted yet. Use the form above to send updates to attendees.
                            </p>
                          ) : (
                            eventAnnouncements.map((a) => (
                              <div
                                key={a.id}
                                className="p-4 bg-white border border-slate-200 rounded-xl space-y-1.5 relative group"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-900">
                                      {a.title}
                                    </span>
                                    {a.is_urgent && (
                                      <span className="text-[10px] font-bold bg-rose-600 text-white px-1.5 py-0.2 rounded uppercase">
                                        Urgent
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-slate-400">
                                      {formatDisplayDate(a.created_at.slice(0, 10))}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAnnouncement(a.id)}
                                      className="text-slate-400 hover:text-rose-600 cursor-pointer p-1"
                                      title="Delete announcement"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed">{a.message}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* 4. FAQS */}
                    {manageSubTab === "FAQS" && (
                      <div className="space-y-6">
                        {/* Add FAQ Form */}
                        <form
                          onSubmit={handleAddConvenorFaq}
                          className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
                        >
                          <h4 className="font-display text-sm font-bold text-slate-900">
                            Add a FAQ for Students
                          </h4>
                          <div>
                            <input
                              type="text"
                              required
                              placeholder="Question (e.g. Do we need to bring laptops?)"
                              value={newOrgFaqQ}
                              onChange={(e) => setNewOrgFaqQ(e.target.value)}
                              className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                            />
                          </div>
                          <div>
                            <textarea
                              rows={2}
                              required
                              placeholder="Answer..."
                              value={newOrgFaqA}
                              onChange={(e) => setNewOrgFaqA(e.target.value)}
                              className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                            />
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="submit"
                              className="py-2 px-4 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              Add FAQ
                            </button>
                          </div>
                        </form>

                        {/* Existing Questions */}
                        <div className="space-y-4">
                          <h4 className="font-display text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Student Questions ({eventFaqs.length})
                          </h4>
                          {eventFaqs.length === 0 ? (
                            <p className="text-xs text-slate-500 italic">
                              No questions asked for this event yet.
                            </p>
                          ) : (
                            eventFaqs.map((faq) => (
                              <div
                                key={faq.id}
                                className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 text-xs"
                              >
                                <div className="flex items-center justify-between text-slate-500">
                                  <span className="font-bold text-slate-900">Q: {faq.question}</span>
                                  <span>Asked by {faq.asked_by_name}</span>
                                </div>
                                <div>
                                  <textarea
                                    rows={2}
                                    placeholder="Write your answer..."
                                    value={faqDrafts[faq.id] ?? ""}
                                    onChange={(e) =>
                                      setFaqDrafts({ ...faqDrafts, [faq.id]: e.target.value })
                                    }
                                    className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:border-slate-900"
                                  />
                                </div>
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveFaqAnswer(faq.id)}
                                    className="py-1.5 px-3 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-md cursor-pointer transition-colors"
                                  >
                                    Save Answer
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* 5. EDIT EVENT */}
                    {manageSubTab === "EDIT" && (
                      <form onSubmit={handleSaveEdit} className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div className="sm:col-span-2">
                            <label className="font-semibold text-slate-700 block mb-1">
                              Event Title *
                            </label>
                            <input
                              type="text"
                              required
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">
                              Category *
                            </label>
                            <input
                              type="text"
                              required
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">
                              Venue *
                            </label>
                            <input
                              type="text"
                              required
                              value={editVenue}
                              onChange={(e) => setEditVenue(e.target.value)}
                              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">
                              Event Date *
                            </label>
                            <input
                              type="date"
                              required
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">
                              Event Time *
                            </label>
                            <input
                              type="text"
                              required
                              value={editTime}
                              onChange={(e) => setEditTime(e.target.value)}
                              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">
                              Registration Deadline *
                            </label>
                            <input
                              type="date"
                              required
                              value={editDeadline}
                              onChange={(e) => setEditDeadline(e.target.value)}
                              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">
                              Registration Fee (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={editCost}
                              onChange={(e) => setEditCost(e.target.value)}
                              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                            />
                          </div>

                          {/* Prize Pool Field */}
                          <div className="sm:col-span-2">
                            <label className="font-semibold text-slate-700 block mb-1 flex items-center gap-1.5">
                              <Trophy className="w-3.5 h-3.5 text-amber-600" />
                              <span>Prize Pool &amp; Awards (Optional)</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. 1st: ₹50,000 | 2nd: ₹25,000 + Certificates"
                              value={editPrizes}
                              onChange={(e) => setEditPrizes(e.target.value)}
                              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                            />
                          </div>

                          {/* Total Seats Capacity */}
                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">
                              Total Seating Capacity (Optional)
                            </label>
                            <input
                              type="number"
                              min="1"
                              placeholder="Leave blank for unlimited"
                              value={editCapacity}
                              onChange={(e) => setEditCapacity(e.target.value)}
                              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                            />
                          </div>

                          {/* Show Remaining Seats Toggle */}
                          <div className="flex items-center pt-5">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editShowRemainingSeats}
                                onChange={(e) => setEditShowRemainingSeats(e.target.checked)}
                                className="rounded text-rose-600 focus:ring-0 cursor-pointer"
                              />
                              <span>Show remaining seats available to students on event page</span>
                            </label>
                          </div>

                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">
                              Min Team Size
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={editMinTeam}
                              onChange={(e) => setEditMinTeam(e.target.value)}
                              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">
                              Max Team Size
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={editMaxTeam}
                              onChange={(e) => setEditMaxTeam(e.target.value)}
                              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">
                              Organizer Phone Number *
                            </label>
                            <input
                              type="tel"
                              required
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">
                              Banner Image URL
                            </label>
                            <input
                              type="text"
                              value={editImageUrl}
                              onChange={(e) => setEditImageUrl(e.target.value)}
                              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="font-semibold text-slate-700 block mb-1">
                              Description &amp; Details *
                            </label>
                            <textarea
                              rows={4}
                              required
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                          {confirmDelete ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-rose-600 font-semibold">
                                Confirm delete?
                              </span>
                              <button
                                type="button"
                                onClick={handleDeleteEvent}
                                className="py-2 px-3 text-xs font-bold bg-rose-600 text-white rounded-md hover:bg-rose-700 cursor-pointer"
                              >
                                Yes, Delete Event
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(false)}
                                className="py-2 px-3 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(true)}
                              className="py-2 px-3.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Event</span>
                            </button>
                          )}

                          <button
                            type="submit"
                            disabled={savingEdit}
                            className="py-2.5 px-6 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {savingEdit ? "Updating..." : "Save Changes"}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CREATE EVENT */}
      {activeTab === "CREATE" && (
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
          <div className="mb-6 pb-4 border-b border-slate-200">
            <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">
              New Event
            </p>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Create College Event
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Set up your event details, venue, seat limits, prize pool, and registration dates
            </p>
          </div>

          <form onSubmit={handleCreateEvent} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annual College Hackathon 2026"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Category *
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900 cursor-pointer"
                >
                  <option value="Hackathon">Hackathon</option>
                  <option value="Technical">Technical</option>
                  <option value="Workshop">Workshop</option>
                  <option value="Sports">Sports</option>
                  <option value="Cultural">Cultural</option>
                  <option value="Music">Music</option>
                  <option value="Dance">Dance</option>
                  <option value="Art">Art</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Venue *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main Auditorium / Lab 3"
                  value={newVenue}
                  onChange={(e) => setNewVenue(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Event Date *
                </label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Start Time *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 10:00 AM"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Registration Deadline *
                </label>
                <input
                  type="date"
                  required
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Registration Fee (₹) — Enter 0 for Free
                </label>
                <input
                  type="number"
                  min="0"
                  value={newCost}
                  onChange={(e) => setNewCost(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                />
              </div>

              {/* Prize Pool Field */}
              <div className="sm:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-600" />
                  <span>Prize Pool &amp; Awards (Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1st: ₹50,000 | 2nd: ₹25,000 + Certificates"
                  value={newPrizes}
                  onChange={(e) => setNewPrizes(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                />
              </div>

              {/* Total Seats Capacity */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Total Seat Limit (Optional)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 100 (leave blank for unlimited)"
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                />
              </div>

              {/* Show Remaining Seats Toggle */}
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newShowRemainingSeats}
                    onChange={(e) => setNewShowRemainingSeats(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-0 cursor-pointer"
                  />
                  <span>Show remaining seats available to students on event page</span>
                </label>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Min Team Size
                </label>
                <input
                  type="number"
                  min="1"
                  value={newMinTeam}
                  onChange={(e) => setNewMinTeam(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Max Team Size
                </label>
                <input
                  type="number"
                  min="1"
                  value={newMaxTeam}
                  onChange={(e) => setNewMaxTeam(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1">
                  Organizer Contact Phone *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Contact phone number for student queries"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1">
                  Event Description *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe the event, rules, schedule, prizes, and instructions..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => onChangeTab("MANAGE")}
                className="py-2.5 px-4 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="py-2.5 px-6 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {creating ? "Creating Event..." : "Create Event"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: ORGANIZER PROFILE & STUDENT REVIEWS */}
      {activeTab === "PROFILE" && (
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Profile Overview Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
              <div>
                <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">
                  Organizer Profile
                </p>
                <h2 className="font-display text-2xl font-bold text-slate-900">
                  {user.full_name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  @{user.username} · {user.email} · {user.phone}
                </p>
                {user.department && (
                  <p className="text-xs font-semibold text-slate-700 mt-1">
                    Department: {user.department}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                <div>
                  <span className="text-base font-black text-slate-900 leading-none">
                    {profileData?.stats.average_rating ?? "5.0"}
                  </span>
                  <span className="text-xs text-slate-500 block">
                    {profileData?.stats.total_reviews ?? 0} Student Reviews
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 text-center">
              <div className="p-4 bg-slate-50 rounded-lg">
                <span className="text-2xl font-bold text-slate-900">
                  {profileData?.stats.events_hosted ?? 0}
                </span>
                <span className="text-xs text-slate-500 block mt-1">
                  Events Hosted
                </span>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <span className="text-2xl font-bold text-rose-600">
                  {profileData?.stats.total_participants ?? 0}
                </span>
                <span className="text-xs text-slate-500 block mt-1">
                  Total Participants
                </span>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <span className="text-2xl font-bold text-emerald-600">
                  {profileData?.stats.answered_faqs ?? 0}
                </span>
                <span className="text-xs text-slate-500 block mt-1">
                  Questions Answered
                </span>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <span className="text-2xl font-bold text-slate-900">
                  {profileData?.stats.total_reviews ?? 0}
                </span>
                <span className="text-xs text-slate-500 block mt-1">
                  Student Reviews
                </span>
              </div>
            </div>
          </div>

          {/* ANONYMOUS STUDENT REVIEWS SECTION */}
          <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">
                  Student Feedback
                </p>
                <h3 className="font-display text-xl font-bold text-slate-900">
                  Anonymous Ratings &amp; Reviews
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Feedback from students who registered for your events
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>100% Student Anonymity</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                To ensure honest and helpful feedback, student names and usernames are never shared with the organizer.
              </span>
            </div>

            {/* Reviews List */}
            {(!profileData?.feedbacks || profileData.feedbacks.length === 0) ? (
              <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
                No reviews received yet. Students can rate and review your events after registering.
              </div>
            ) : (
              <div className="space-y-4">
                {profileData.feedbacks.map((fb) => (
                  <div
                    key={fb.id}
                    className="p-5 border border-slate-200 rounded-xl bg-white space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= fb.rating
                                ? "text-amber-400 fill-amber-400"
                                : "text-slate-200"
                            }`}
                          />
                        ))}
                        <span className="font-bold text-slate-800 ml-1.5">
                          {fb.rating}.0 / 5.0
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {formatDisplayDate(fb.created_at.slice(0, 10))}
                      </span>
                    </div>

                    <p className="text-xs text-slate-800 italic leading-relaxed">
                      &quot;{fb.comment}&quot;
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                      <span>Author: <strong className="text-slate-700">Anonymous Student</strong></span>
                      {fb.event_title && (
                        <span>Event: <strong className="text-slate-700">{fb.event_title}</strong></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Organizer Security & Change Password Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm space-y-5">
            <div className="pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-rose-600" />
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Account Security &amp; Password
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Re-enter your old password to verify your identity, then update your password.
              </p>
            </div>

            {passwordFeedback && (
              <div
                className={`p-4 rounded-lg border text-xs flex items-start gap-2.5 ${
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

            <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Current Password *
                </label>
                <div className="relative">
                  <input
                    type={showOldPassword ? "text" : "password"}
                    required
                    placeholder="Enter current password"
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
                  className="py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-2 shadow-xs"
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
        </div>
      )}
    </div>
  );
};
