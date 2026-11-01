/**
 * EVENT MANAGER — Frontend Client (Vanilla JavaScript)
 * Supports multi-participant team registrations and Excel (.xlsx) exports.
 */
const API_BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://127.0.0"
    : "https://college-event-management-platform.onrender.com/";


const state = {
  token: localStorage.getItem("em_token") || null,
  user: JSON.parse(localStorage.getItem("em_user") || "null"),
  authRole: "STUDENT",
  authMode: "LOGIN",
  events: [],
  topEvents: [],
  activeHeroIndex: 0,
  selectedCategory: "All",
  searchQuery: "",
  studentRegistrations: { current: [], history: [] },
  drawerTab: "CURRENT",
  orgTab: "MANAGE",
  selectedOrgEventId: null,
};

function showToast(message) {
  const el = document.getElementById("toastBanner");
  el.textContent = message;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3500);
}

async function apiFetch(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) {
    headers["Authorization"] = `Bearer ${state.token}`;
  }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(
      typeof data.detail === "string"
        ? data.detail
        : data.detail?.message || data.error || "Request failed"
    );
    err.detail = data.detail;
    err.status = response.status;
    throw err;
  }
  return data;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCost(cost) {
  return Number(cost) > 0 ? `₹${Number(cost).toLocaleString()}` : "Free Entry";
}

/* ---------------- AUTHENTICATION ---------------- */
function updateAuthUI() {
  document.getElementById("roleStudentBtn").classList.toggle("active", state.authRole === "STUDENT");
  document.getElementById("roleOrganizerBtn").classList.toggle("active", state.authRole === "ORGANIZER");
  document.getElementById("modeLoginBtn").classList.toggle("active", state.authMode === "LOGIN");
  document.getElementById("modeRegisterBtn").classList.toggle("active", state.authMode === "REGISTER");

  const extra = document.getElementById("registerExtraFields");
  extra.classList.toggle("hidden", state.authMode !== "REGISTER");
  document.getElementById("authDeptLabel").textContent =
    state.authRole === "ORGANIZER" ? "Club / Department Name" : "Department & Year";

  const roleLabel = state.authRole === "STUDENT" ? "Student" : "Organizer";
  document.getElementById("authSubmitBtn").textContent =
    state.authMode === "LOGIN" ? `Sign In as ${roleLabel}` : `Create ${roleLabel} Account`;
}

document.getElementById("roleStudentBtn").addEventListener("click", () => {
  state.authRole = "STUDENT";
  updateAuthUI();
});

document.getElementById("roleOrganizerBtn").addEventListener("click", () => {
  state.authRole = "ORGANIZER";
  updateAuthUI();
});

document.getElementById("modeLoginBtn").addEventListener("click", () => {
  state.authMode = "LOGIN";
  document.getElementById("accountExistsBanner").classList.add("hidden");
  document.getElementById("authErrorBox").classList.add("hidden");
  updateAuthUI();
});

document.getElementById("modeRegisterBtn").addEventListener("click", () => {
  state.authMode = "REGISTER";
  document.getElementById("authErrorBox").classList.add("hidden");
  updateAuthUI();
});

document.getElementById("authUsername").addEventListener("blur", async (e) => {
  const val = e.target.value.trim();
  if (state.authMode !== "REGISTER" || val.length < 3) return;
  try {
    const check = await apiFetch(`/auth/check-username?username=${encodeURIComponent(val)}`);
    const banner = document.getElementById("accountExistsBanner");
    if (check.exists) {
      document.getElementById("accountExistsText").textContent =
        "Account already exists for this username. Switch to existing account Sign In.";
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }
  } catch (_) {}
});

document.getElementById("switchToExistingBtn").addEventListener("click", () => {
  state.authMode = "LOGIN";
  document.getElementById("accountExistsBanner").classList.add("hidden");
  updateAuthUI();
  showToast("Switched to existing account Sign In. Enter your password.");
});

document.getElementById("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById("authErrorBox");
  errorBox.classList.add("hidden");

  const username = document.getElementById("authUsername").value.trim();
  const password = document.getElementById("authPassword").value;

  try {
    let result;
    if (state.authMode === "REGISTER") {
      const full_name = document.getElementById("authFullName").value.trim();
      const email = document.getElementById("authEmail").value.trim();
      const phone = document.getElementById("authPhone").value.trim();
      const department = document.getElementById("authDept").value.trim();
      result = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
          full_name,
          email,
          phone,
          department,
          role: state.authRole,
        }),
      });
    } else {
      result = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password, role: state.authRole }),
      });
    }

    state.token = result.token;
    state.user = result.user;
    localStorage.setItem("em_token", state.token);
    localStorage.setItem("em_user", JSON.stringify(state.user));
    renderApp();
  } catch (err) {
    if (err.status === 409) {
      if (err.detail?.role) state.authRole = err.detail.role;
      document.getElementById("accountExistsText").textContent =
        err.message || "Account already exists.";
      document.getElementById("accountExistsBanner").classList.remove("hidden");
      updateAuthUI();
    } else {
      errorBox.textContent = err.message;
      errorBox.classList.remove("hidden");
    }
  }
});

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("em_token");
  localStorage.removeItem("em_user");
  closeDrawer();
  renderApp();
}

/* ---------------- STUDENT DASHBOARD ---------------- */
async function loadStudentDashboard() {
  const [eventsRes, topRes, regsRes] = await Promise.all([
    apiFetch(`/events?search=${encodeURIComponent(state.searchQuery)}&category=${encodeURIComponent(state.selectedCategory)}`),
    apiFetch("/events/top"),
    apiFetch("/student/registrations"),
  ]);
  state.events = eventsRes.events || [];
  state.topEvents = topRes.events || [];
  state.studentRegistrations = regsRes;
  renderHeroShowcase();
  renderCategoryFilters();
  renderEventsGrid();
  renderStudentDrawerContent();
}

function renderHeroShowcase() {
  const container = document.getElementById("heroContent");
  if (!state.topEvents.length) {
    container.innerHTML = `
      <div class="top5-feature">
        <div class="top5-overlay">
          <p class="top5-rank-label">Top 5 Popular College Events</p>
          <h1 class="top5-title">No Active College Events Currently Scheduled</h1>
          <p class="top5-meta">As soon as campus organizers publish events, the top 5 most-registered events will rank here automatically. Completed events are automatically removed.</p>
        </div>
      </div>
    `;
    return;
  }

  if (state.activeHeroIndex >= state.topEvents.length) state.activeHeroIndex = 0;
  const featured = state.topEvents[state.activeHeroIndex];

  container.innerHTML = `
    <div class="top5-feature">
      ${featured.image_url ? `<img src="${escapeHtml(featured.image_url)}" alt="${escapeHtml(featured.title)}" class="top5-bg-img" referrerpolicy="no-referrer" />` : ""}
      <div class="top5-scrim"></div>
      <div class="top5-overlay">
        <p class="top5-rank-label">Top #${state.activeHeroIndex + 1} Most Registered · ${escapeHtml(featured.category)}</p>
        <h1 class="top5-title">${escapeHtml(featured.title)}</h1>
        <p class="top5-meta">
          ${escapeHtml(featured.event_date)} · ${escapeHtml(featured.venue)} · ${featured.participants_count} Registered · ${formatCost(featured.cost)}
        </p>
        <button type="button" class="btn-primary" onclick="openEventModal('${featured.id}')">
          View Details &amp; Register
        </button>
      </div>
    </div>
    <div class="top5-strip">
      ${state.topEvents
        .map(
          (ev, idx) => `
        <button type="button" class="top5-thumb ${idx === state.activeHeroIndex ? "active" : ""}" onclick="selectHeroSlide(${idx})">
          <span class="rank-num">0${idx + 1}</span>
          <div>
            <div style="font-weight:600;font-size:0.85rem;">${escapeHtml(ev.title)}</div>
            <div style="font-size:0.75rem;color:#cbd5e1;">${ev.participants_count} registered</div>
          </div>
        </button>
      `
        )
        .join("")}
    </div>
  `;
}

window.selectHeroSlide = (idx) => {
  state.activeHeroIndex = idx;
  renderHeroShowcase();
};

function renderCategoryFilters() {
  const defaultCats = ["All", "Hackathon", "Sports", "Music", "Dance", "Art", "Technical", "Cultural", "Workshop"];
  state.events.forEach((ev) => {
    if (ev.category && !defaultCats.includes(ev.category)) defaultCats.push(ev.category);
  });
  const bar = document.getElementById("categoryFilterBar");
  bar.innerHTML = defaultCats
    .map(
      (cat) => `
      <button type="button" class="cat-btn ${state.selectedCategory === cat ? "active" : ""}" onclick="selectCategory('${escapeHtml(cat)}')">
        ${escapeHtml(cat)}
      </button>
    `
    )
    .join("");
}

window.selectCategory = async (cat) => {
  state.selectedCategory = cat;
  const res = await apiFetch(
    `/events?search=${encodeURIComponent(state.searchQuery)}&category=${encodeURIComponent(state.selectedCategory)}`
  );
  state.events = res.events || [];
  renderCategoryFilters();
  renderEventsGrid();
};

document.getElementById("eventSearchInput").addEventListener("input", async (e) => {
  state.searchQuery = e.target.value;
  const res = await apiFetch(
    `/events?search=${encodeURIComponent(state.searchQuery)}&category=${encodeURIComponent(state.selectedCategory)}`
  );
  state.events = res.events || [];
  renderEventsGrid();
});

function renderEventsGrid() {
  const grid = document.getElementById("eventsGrid");
  if (!state.events.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">No active upcoming events match your selection.</div>`;
    return;
  }
  grid.innerHTML = state.events
    .map(
      (ev) => `
      <article class="event-card" onclick="openEventModal('${ev.id}')">
        <div class="card-banner">
          ${
            ev.image_url
              ? `<img src="${escapeHtml(ev.image_url)}" alt="${escapeHtml(ev.title)}" referrerpolicy="no-referrer" />`
              : `<div class="card-fallback">${escapeHtml(ev.category)}</div>`
          }
        </div>
        <div class="card-body">
          <p class="inline-meta">${escapeHtml(ev.category)} · Register by ${escapeHtml(ev.registration_deadline)}</p>
          <h3 class="card-title">${escapeHtml(ev.title)}</h3>
          <p class="card-desc">${escapeHtml(ev.description)}</p>
          <div class="card-footer">
            <span>${escapeHtml(ev.venue)}</span>
            <span>${ev.participants_count} joined · ${formatCost(ev.cost)}</span>
          </div>
        </div>
      </article>
    `
    )
    .join("");
}

/* ---------------- EVENT MODAL (DETAILS, MULTI-PARTICIPANT REGISTRATION, FAQ) ---------------- */
let modalParticipantCount = 1;

window.openEventModal = async (eventId) => {
  const data = await apiFetch(`/events/${eventId}`);
  const ev = data.event;
  const faqs = data.faqs || [];
  const existingReg =
    state.studentRegistrations.current.find((r) => r.event.id === ev.id) ||
    state.studentRegistrations.history.find((r) => r.event.id === ev.id);

  modalParticipantCount = 1;

  const modal = document.getElementById("eventModalContent");
  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px;">
      <div>
        <p class="inline-meta">${escapeHtml(ev.category)} · Hosted by ${escapeHtml(ev.organizer_name)}</p>
        <h2 style="font-family:var(--font-display);font-size:1.65rem;">${escapeHtml(ev.title)}</h2>
      </div>
      <button type="button" class="btn-ghost" onclick="closeEventModal()">Close</button>
    </div>
    <p style="margin-bottom:20px;color:var(--ink-muted);">${escapeHtml(ev.description)}</p>

    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:16px;border:1px solid var(--border);border-radius:8px;margin-bottom:20px;font-size:0.875rem;">
      <div><strong>Event Date &amp; Time:</strong> ${escapeHtml(ev.event_date)} at ${escapeHtml(ev.event_time)}</div>
      <div><strong>Final Registration Date:</strong> ${escapeHtml(ev.registration_deadline)}</div>
      <div><strong>Venue:</strong> ${escapeHtml(ev.venue)}</div>
      <div><strong>Cost:</strong> ${formatCost(ev.cost)}</div>
      <div><strong>Registered Participants:</strong> ${ev.participants_count}${ev.max_capacity ? ` / ${ev.max_capacity}` : ""}</div>
      <div><strong>Organizer Contact:</strong> <a href="tel:${escapeHtml(ev.organizer_phone)}">${escapeHtml(ev.organizer_phone)}</a></div>
    </div>

    ${
      state.user?.role === "STUDENT"
        ? existingReg
          ? `
            <div style="padding:14px;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;border-radius:8px;margin-bottom:24px;">
              <strong>Registration Confirmed (Pass ${escapeHtml(existingReg.registration.reference_code)})</strong>
              <div style="margin-top:4px;font-size:0.85rem;">Registered ${existingReg.registration.participant_count} participant(s).</div>
            </div>
          `
          : `
            <form id="multiRegForm" class="form-stack" style="padding:18px;border:1px solid var(--border);border-radius:8px;margin-bottom:24px;">
              <h4>Register Participants for This Event</h4>
              <p class="muted-meta">Collect details for all participating members:</p>

              <div class="field">
                <label>Team / Group Name (Optional)</label>
                <input type="text" id="regTeamName" placeholder="e.g. Innovators Duo" />
              </div>

              <div id="participantRowsContainer" class="form-stack"></div>

              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
                <button type="button" class="btn-secondary" id="addMemberBtn">+ Add Another Participant</button>
              </div>

              <button type="submit" class="btn-primary" style="margin-top:12px;">Confirm Registration</button>
            </form>
          `
        : ""
    }

    <div style="border-top:1px solid var(--border);padding-top:20px;">
      <h3 style="margin-bottom:12px;">Event FAQs &amp; Student Questions</h3>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
        ${
          faqs.length
            ? faqs
                .map(
                  (f) => `
              <div style="padding:12px;border:1px solid var(--border);border-radius:8px;">
                <div style="font-weight:600;font-size:0.9rem;">Q: ${escapeHtml(f.question)}</div>
                <div style="font-size:0.85rem;color:var(--ink-muted);margin-top:4px;">
                  ${f.answer ? `A: ${escapeHtml(f.answer)}` : "<em>Awaiting organizer reply...</em>"}
                </div>
              </div>
            `
                )
                .join("")
            : `<p class="muted-text">No questions asked yet. Ask the organizer below.</p>`
        }
      </div>

      <form id="askFaqForm" style="display:flex;gap:10px;">
        <input type="text" id="faqQuestionInput" required placeholder="Raise a question for the organizer..." style="flex:1;padding:10px 12px;border:1px solid var(--border);border-radius:8px;" />
        <button type="submit" class="btn-secondary">Submit Question</button>
      </form>
    </div>
  `;

  document.getElementById("eventModalBackdrop").classList.remove("hidden");

  // Render initial participant input fields
  renderParticipantFields();

  const addBtn = document.getElementById("addMemberBtn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      modalParticipantCount += 1;
      renderParticipantFields();
    });
  }

  const regForm = document.getElementById("multiRegForm");
  if (regForm) {
    regForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const participants = [];
      for (let i = 1; i <= modalParticipantCount; i++) {
        const nameEl = document.getElementById(`p_name_${i}`);
        const emailEl = document.getElementById(`p_email_${i}`);
        const phoneEl = document.getElementById(`p_phone_${i}`);
        const rollEl = document.getElementById(`p_roll_${i}`);
        if (nameEl && emailEl && phoneEl) {
          participants.push({
            name: nameEl.value.trim(),
            email: emailEl.value.trim(),
            phone: phoneEl.value.trim(),
            roll_no: rollEl ? rollEl.value.trim() : "",
          });
        }
      }

      try {
        await apiFetch(`/events/${ev.id}/register`, {
          method: "POST",
          body: JSON.stringify({
            team_name: document.getElementById("regTeamName").value,
            participants,
          }),
        });
        showToast("Registration confirmed for all participants!");
        await loadStudentDashboard();
        openEventModal(ev.id);
      } catch (err) {
        showToast(err.message);
      }
    });
  }

  document.getElementById("askFaqForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = document.getElementById("faqQuestionInput").value.trim();
    if (!q) return;
    await apiFetch(`/events/${ev.id}/faqs`, {
      method: "POST",
      body: JSON.stringify({ question: q }),
    });
    showToast("Question submitted to organizer.");
    openEventModal(ev.id);
  });
};

function renderParticipantFields() {
  const container = document.getElementById("participantRowsContainer");
  if (!container) return;

  let html = "";
  for (let i = 1; i <= modalParticipantCount; i++) {
    const isLead = i === 1;
    const defName = isLead ? state.user?.full_name || "" : "";
    const defEmail = isLead ? state.user?.email || "" : "";
    const defPhone = isLead ? state.user?.phone || "" : "";
    const defRoll = isLead ? state.user?.department || "" : "";

    html += `
      <div style="padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
        <div style="font-weight:600;font-size:0.8rem;margin-bottom:8px;">Participant #${i} ${isLead ? "(Lead)" : ""}</div>
        <div class="field-row">
          <div class="field">
            <label>Full Name *</label>
            <input type="text" id="p_name_${i}" required value="${escapeHtml(defName)}" placeholder="Full Name" />
          </div>
          <div class="field">
            <label>Roll No / Dept</label>
            <input type="text" id="p_roll_${i}" value="${escapeHtml(defRoll)}" placeholder="Roll Number" />
          </div>
        </div>
        <div class="field-row" style="margin-top:8px;">
          <div class="field">
            <label>Email ID *</label>
            <input type="email" id="p_email_${i}" required value="${escapeHtml(defEmail)}" placeholder="name@college.edu" />
          </div>
          <div class="field">
            <label>Phone Number *</label>
            <input type="tel" id="p_phone_${i}" required value="${escapeHtml(defPhone)}" placeholder="+91 98765 43210" />
          </div>
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
}

window.closeEventModal = () => {
  document.getElementById("eventModalBackdrop").classList.add("hidden");
};

/* ---------------- STUDENT DASHBOARD DRAWER (RENAMED TO DASHBOARD) ---------------- */
function openDrawer() {
  document.getElementById("studentDrawerBackdrop").classList.remove("hidden");
  document.getElementById("studentDrawer").classList.remove("hidden");
  renderStudentDrawerContent();
}

function closeDrawer() {
  document.getElementById("studentDrawerBackdrop").classList.add("hidden");
  document.getElementById("studentDrawer").classList.add("hidden");
}

document.getElementById("closeDrawerBtn").addEventListener("click", closeDrawer);
document.getElementById("studentDrawerBackdrop").addEventListener("click", closeDrawer);
document.getElementById("studentLogoutBtn").addEventListener("click", logout);

document.getElementById("tabCurrentRegs").addEventListener("click", () => {
  state.drawerTab = "CURRENT";
  document.getElementById("tabCurrentRegs").classList.add("active");
  document.getElementById("tabHistoryRegs").classList.remove("active");
  renderStudentDrawerContent();
});

document.getElementById("tabHistoryRegs").addEventListener("click", () => {
  state.drawerTab = "HISTORY";
  document.getElementById("tabHistoryRegs").classList.add("active");
  document.getElementById("tabCurrentRegs").classList.remove("active");
  renderStudentDrawerContent();
});

function renderStudentDrawerContent() {
  if (!state.user) return;
  document.getElementById("drawerStudentName").textContent = state.user.full_name;
  document.getElementById("drawerStudentMeta").textContent = `${state.user.username} · ${state.user.email}`;

  const list =
    state.drawerTab === "CURRENT"
      ? state.studentRegistrations.current
      : state.studentRegistrations.history;
  const container = document.getElementById("drawerRegistrationsList");

  if (!list.length) {
    container.innerHTML = `<div class="empty-state">${
      state.drawerTab === "CURRENT"
        ? "No upcoming registered events yet."
        : "Completed events automatically move to History."
    }</div>`;
    return;
  }

  container.innerHTML = list
    .map(
      (item) => `
      <div class="reg-item">
        <div class="inline-meta">${escapeHtml(item.event.category)} · Pass ${escapeHtml(item.registration.reference_code)}</div>
        <div style="font-weight:700;margin:4px 0;">${escapeHtml(item.event.title)}</div>
        <div class="muted-meta">${escapeHtml(item.event.event_date)} at ${escapeHtml(item.event.event_time)} · ${escapeHtml(item.event.venue)}</div>
        <div class="muted-meta" style="margin-top:4px;">${item.registration.participant_count} registered participant(s)</div>
      </div>
    `
    )
    .join("");
}

/* ---------------- ORGANIZER DASHBOARD & EXCEL EXPORT ---------------- */
function switchOrgTab(tab) {
  state.orgTab = tab;
  document.getElementById("orgTabManage").classList.toggle("active", tab === "MANAGE");
  document.getElementById("orgTabCreate").classList.toggle("active", tab === "CREATE");
  document.getElementById("orgTabProfile").classList.toggle("active", tab === "PROFILE");

  document.getElementById("orgManageSection").classList.toggle("hidden", tab !== "MANAGE");
  document.getElementById("orgCreateSection").classList.toggle("hidden", tab !== "CREATE");
  document.getElementById("orgProfileSection").classList.toggle("hidden", tab !== "PROFILE");

  if (tab === "MANAGE") loadOrganizerEvents();
  if (tab === "PROFILE") loadOrganizerProfile();
}

document.getElementById("orgTabManage").addEventListener("click", () => switchOrgTab("MANAGE"));
document.getElementById("orgTabCreate").addEventListener("click", () => switchOrgTab("CREATE"));
document.getElementById("orgTabProfile").addEventListener("click", () => switchOrgTab("PROFILE"));

document.getElementById("createEventForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const initial_faqs = [];
  const q = document.getElementById("evFaqQ").value.trim();
  const a = document.getElementById("evFaqA").value.trim();
  if (q && a) initial_faqs.push({ question: q, answer: a });

  const capVal = document.getElementById("evCapacity").value;
  try {
    await apiFetch("/events", {
      method: "POST",
      body: JSON.stringify({
        title: document.getElementById("evTitle").value,
        category: document.getElementById("evCategory").value,
        description: document.getElementById("evDescription").value,
        venue: document.getElementById("evVenue").value,
        organizer_phone: document.getElementById("evPhone").value,
        event_date: document.getElementById("evDate").value,
        event_time: document.getElementById("evTime").value,
        registration_deadline: document.getElementById("evDeadline").value,
        cost: Number(document.getElementById("evCost").value || 0),
        min_team_size: Number(document.getElementById("evMinTeam").value || 1),
        max_team_size: Number(document.getElementById("evMaxTeam").value || 4),
        max_capacity: capVal ? Number(capVal) : null,
        image_url: document.getElementById("evImageUrl").value,
        initial_faqs,
      }),
    });
    e.target.reset();
    showToast("Event published and active!");
    switchOrgTab("MANAGE");
  } catch (err) {
    showToast(err.message);
  }
});

let currentOrganizerEventData = null;

async function loadOrganizerEvents() {
  const res = await apiFetch("/organizer/events");
  const events = res.events || [];
  const container = document.getElementById("orgEventsList");

  if (!events.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p style="margin-bottom:12px;">You have not hosted any events yet.</p>
        <button type="button" class="btn-primary" onclick="document.getElementById('orgTabCreate').click()">Create Your First Event</button>
      </div>
    `;
    return;
  }

  if (!state.selectedOrgEventId || !events.some((e) => e.id === state.selectedOrgEventId)) {
    state.selectedOrgEventId = events[0].id;
  }

  const detail = await apiFetch(`/organizer/events/${state.selectedOrgEventId}/participants`);
  currentOrganizerEventData = detail;
  const ev = detail.event;
  const registrations = detail.registrations || [];
  const faqs = detail.faqs || [];

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:280px 1fr;gap:24px;align-items:start;">
      <div class="panel-card" style="padding:16px;display:flex;flex-direction:column;gap:8px;">
        <p class="muted-label" style="margin-bottom:4px;">Your Hosted Events (${events.length})</p>
        ${events
          .map(
            (item) => `
            <button type="button" onclick="selectOrgEvent('${item.id}')" style="text-align:left;padding:10px 12px;border-radius:8px;border:1px solid ${
              item.id === ev.id ? "var(--accent)" : "var(--border)"
            };background:${item.id === ev.id ? "#fff1f2" : "var(--surface)"};cursor:pointer;">
              <div style="font-weight:600;font-size:0.9rem;">${escapeHtml(item.title)}</div>
              <div class="inline-meta">${item.participants_count} participants · ${escapeHtml(item.event_date)}</div>
            </button>
          `
          )
          .join("")}
      </div>

      <div style="display:flex;flex-direction:column;gap:24px;">
        <div class="panel-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
            <div>
              <h3>${escapeHtml(ev.title)} — Participant Registrations (${registrations.length} teams/entries)</h3>
              <p class="muted-meta">Final Date: ${escapeHtml(ev.registration_deadline)} · Venue: ${escapeHtml(ev.venue)}</p>
            </div>
            <div style="display:flex;gap:8px;">
              <button type="button" class="btn-success" onclick="exportParticipantsToExcel()">
                Export to Excel (.xlsx)
              </button>
              <button type="button" class="btn-danger" onclick="deleteOrgEvent('${ev.id}')">Delete Event</button>
            </div>
          </div>

          ${
            registrations.length
              ? `
              <div style="display:flex;flex-direction:column;gap:12px;">
                ${registrations
                  .map(
                    (reg) => `
                  <div style="padding:12px;border:1px solid var(--border);border-radius:8px;background:#f8fafc;">
                    <div style="display:flex;justify-content:space-between;font-weight:600;font-size:0.85rem;">
                      <span>Pass: ${escapeHtml(reg.reference_code)} ${reg.team_name ? `· Team: ${escapeHtml(reg.team_name)}` : ""}</span>
                      <span class="inline-meta">${reg.participant_count} member(s)</span>
                    </div>
                    <table class="data-table" style="background:#fff;margin-top:8px;">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Participant Name</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Roll No</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${(reg.participants || [])
                          .map(
                            (m, idx) => `
                          <tr>
                            <td>${idx + 1}</td>
                            <td>${escapeHtml(m.name)}</td>
                            <td>${escapeHtml(m.email)}</td>
                            <td>${escapeHtml(m.phone)}</td>
                            <td>${escapeHtml(m.roll_no || "—")}</td>
                          </tr>
                        `
                          )
                          .join("")}
                      </tbody>
                    </table>
                  </div>
                `
                  )
                  .join("")}
              </div>
            `
              : `<p class="muted-text">No student registrations yet for this event.</p>`
          }
        </div>

        <div class="panel-card">
          <h3 style="margin-bottom:12px;">Update Event Details</h3>
          <form id="updateEventForm" class="form-stack">
            <div class="field-row">
              <div class="field">
                <label>Event Title</label>
                <input type="text" id="upTitle" value="${escapeHtml(ev.title)}" required />
              </div>
              <div class="field">
                <label>Category</label>
                <input type="text" id="upCategory" value="${escapeHtml(ev.category)}" required />
              </div>
            </div>
            <div class="field">
              <label>Description</label>
              <textarea id="upDesc" rows="3" required>${escapeHtml(ev.description)}</textarea>
            </div>
            <div class="field-row three-cols">
              <div class="field">
                <label>Venue</label>
                <input type="text" id="upVenue" value="${escapeHtml(ev.venue)}" required />
              </div>
              <div class="field">
                <label>Event Date</label>
                <input type="date" id="upDate" value="${escapeHtml(ev.event_date)}" required />
              </div>
              <div class="field">
                <label>Final Registration Date</label>
                <input type="date" id="upDeadline" value="${escapeHtml(ev.registration_deadline)}" required />
              </div>
            </div>
            <div class="field-row three-cols">
              <div class="field">
                <label>Time</label>
                <input type="time" id="upTime" value="${escapeHtml(ev.event_time)}" required />
              </div>
              <div class="field">
                <label>Cost</label>
                <input type="number" id="upCost" value="${ev.cost}" min="0" required />
              </div>
              <div class="field">
                <label>Contact Phone</label>
                <input type="tel" id="upPhone" value="${escapeHtml(ev.organizer_phone)}" required />
              </div>
            </div>
            <button type="submit" class="btn-primary" style="align-self:flex-start;">Save Changes</button>
          </form>
        </div>

        <div class="panel-card">
          <h3 style="margin-bottom:12px;">Student Questions &amp; FAQs (${faqs.length})</h3>
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${
              faqs.length
                ? faqs
                    .map(
                      (f) => `
                  <div style="padding:12px;border:1px solid var(--border);border-radius:8px;">
                    <div style="font-weight:600;">Q: ${escapeHtml(f.question)} <span class="inline-meta">by ${escapeHtml(f.asked_by_name)}</span></div>
                    <div style="display:flex;gap:8px;margin-top:8px;">
                      <input type="text" id="ans_${f.id}" value="${escapeHtml(f.answer || "")}" placeholder="Write official answer..." style="flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:6px;" />
                      <button type="button" class="btn-secondary" onclick="saveFaqAnswer('${ev.id}', '${f.id}')">Publish Answer</button>
                    </div>
                  </div>
                `
                    )
                    .join("")
                : `<p class="muted-text">No student questions submitted yet.</p>`
            }
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("updateEventForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await apiFetch(`/events/${ev.id}`, {
      method: "PUT",
      body: JSON.stringify({
        title: document.getElementById("upTitle").value,
        category: document.getElementById("upCategory").value,
        description: document.getElementById("upDesc").value,
        venue: document.getElementById("upVenue").value,
        event_date: document.getElementById("upDate").value,
        registration_deadline: document.getElementById("upDeadline").value,
        event_time: document.getElementById("upTime").value,
        cost: Number(document.getElementById("upCost").value),
        organizer_phone: document.getElementById("upPhone").value,
      }),
    });
    showToast("Event updated!");
    loadOrganizerEvents();
  });
}

window.selectOrgEvent = (id) => {
  state.selectedOrgEventId = id;
  loadOrganizerEvents();
};

window.deleteOrgEvent = async (id) => {
  await apiFetch(`/events/${id}`, { method: "DELETE" });
  state.selectedOrgEventId = null;
  showToast("Event removed.");
  loadOrganizerEvents();
};

window.saveFaqAnswer = async (eventId, faqId) => {
  const answer = document.getElementById(`ans_${faqId}`).value.trim();
  if (!answer) return;
  await apiFetch(`/events/${eventId}/faqs/${faqId}`, {
    method: "PUT",
    body: JSON.stringify({ answer }),
  });
  showToast("FAQ answer published!");
  loadOrganizerEvents();
};

// Export to Excel sheet function (.xlsx)
window.exportParticipantsToExcel = () => {
  if (!currentOrganizerEventData || !currentOrganizerEventData.registrations.length) {
    showToast("No participant data to export.");
    return;
  }
  const ev = currentOrganizerEventData.event;
  const rows = [];
  currentOrganizerEventData.registrations.forEach((reg) => {
    (reg.participants || []).forEach((m, idx) => {
      rows.push({
        "Pass Code": reg.reference_code,
        "Team Name": reg.team_name || "Individual",
        "Member Role": idx === 0 ? "Team Lead / Primary" : `Member #${idx + 1}`,
        "Participant Name": m.name,
        "Email ID": m.email,
        "Phone Number": m.phone,
        "Roll No / Dept": m.roll_no || "",
        "Registered By": reg.student_name,
        "Registered At": reg.registered_at,
        "Event Title": ev.title,
        "Venue": ev.venue,
        "Event Date": ev.event_date,
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Participants");
  XLSX.writeFile(wb, `${ev.title.replace(/[^a-z0-9]/gi, "_")}_participants.xlsx`);
  showToast("Excel spreadsheet downloaded!");
};

async function loadOrganizerProfile() {
  const res = await apiFetch("/organizer/profile");
  const org = res.organizer;
  const stats = res.stats;
  document.getElementById("orgProfileContainer").innerHTML = `
    <h2 style="margin-bottom:6px;">${escapeHtml(org.full_name)}</h2>
    <p class="muted-meta" style="margin-bottom:24px;">@${escapeHtml(org.username)} · ${escapeHtml(org.email)} · ${escapeHtml(org.department || "Host Organizer")}</p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;border-top:1px solid var(--border);padding-top:20px;">
      <div>
        <div class="muted-label">Total Events Hosted</div>
        <div style="font-family:var(--font-display);font-size:2rem;font-weight:700;">${stats.events_hosted}</div>
      </div>
      <div>
        <div class="muted-label">Total Registered Participants</div>
        <div style="font-family:var(--font-display);font-size:2rem;font-weight:700;">${stats.total_participants}</div>
      </div>
      <div>
        <div class="muted-label">Pending Student Questions</div>
        <div style="font-family:var(--font-display);font-size:2rem;font-weight:700;">${stats.pending_faqs}</div>
      </div>
    </div>
  `;
}

/* ---------------- ROOT ROUTER ---------------- */
function renderApp() {
  const authView = document.getElementById("authView");
  const studentView = document.getElementById("studentView");
  const organizerView = document.getElementById("organizerView");
  const navLinks = document.getElementById("navLinks");
  const navAction = document.getElementById("navAction");

  if (!state.token || !state.user) {
    authView.classList.remove("hidden");
    studentView.classList.add("hidden");
    organizerView.classList.add("hidden");
    navLinks.innerHTML = "";
    navAction.innerHTML = `<span class="muted-meta">Sign In Required</span>`;
    updateAuthUI();
    return;
  }

  authView.classList.add("hidden");

  if (state.user.role === "STUDENT") {
    studentView.classList.remove("hidden");
    organizerView.classList.add("hidden");
    navLinks.innerHTML = `
      <a href="#studentHeroSection">Top 5 Events</a>
      <a href="#browseSection">Explore Events</a>
    `;
    navAction.innerHTML = `<button type="button" class="btn-secondary" id="studentLogoutBtn">Sign Out</button>`;
    document.getElementById("studentLogoutBtn").addEventListener("click", logout);
    loadStudentDashboard();
  } else {
    studentView.classList.add("hidden");
    organizerView.classList.remove("hidden");
    navLinks.innerHTML = `
      <button type="button" onclick="document.getElementById('orgTabManage').click()">Manage Events</button>
      <button type="button" onclick="document.getElementById('orgTabCreate').click()">Create Event</button>
      <button type="button" onclick="document.getElementById('orgTabProfile').click()">Profile</button>
    `;
    navAction.innerHTML = `<button type="button" class="btn-secondary" id="orgLogoutBtn">Sign Out</button>`;
    document.getElementById("orgLogoutBtn").addEventListener("click", logout);
    switchOrgTab("MANAGE");
  }
}

renderApp();
