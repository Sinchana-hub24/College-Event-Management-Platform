import { useState, useEffect } from "react";
import { LayoutDashboard } from "lucide-react";
import { apiRequest, getStoredToken, setStoredToken } from "./api";
import { User } from "./types";
import { AuthPortal } from "./components/AuthPortal";
import { StudentDashboard } from "./components/StudentDashboard";
import {
  OrganizerDashboard,
  OrganizerTab,
} from "./components/OrganizerDashboard";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState<boolean>(true);
  const [studentDrawerOpen, setStudentDrawerOpen] = useState<boolean>(false);
  const [organizerTab, setOrganizerTab] = useState<OrganizerTab>("MANAGE");

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setInitializing(false);
      return;
    }
    apiRequest<{ user: User }>("/api/auth/me")
      .then((res) => {
        setUser(res.user);
      })
      .catch(() => {
        setStoredToken(null);
        setUser(null);
      })
      .finally(() => {
        setInitializing(false);
      });
  }, []);

  const handleLogout = () => {
    setStoredToken(null);
    setUser(null);
    setStudentDrawerOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* STRICT 3-ZONE TOP BAR CONTRACT WITH THIN RED BORDER */}
      <header className="sticky top-0 z-30 bg-white border-b-2 border-rose-600 px-6 py-4">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            EVENT MANAGER
          </a>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {user?.role === "STUDENT" && (
              <>
                <a
                  href="#popular-showcase"
                  className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
                >
                  Top 5 Events
                </a>
                <a
                  href="#explore-events"
                  className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
                >
                  Explore Events
                </a>
              </>
            )}

            {user?.role === "ORGANIZER" && (
              <>
                <button
                  type="button"
                  onClick={() => setOrganizerTab("MANAGE")}
                  className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    organizerTab === "MANAGE" ? "text-slate-900 font-semibold underline underline-offset-4" : ""
                  }`}
                >
                  Manage Events
                </button>
                <button
                  type="button"
                  onClick={() => setOrganizerTab("CREATE")}
                  className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    organizerTab === "CREATE" ? "text-slate-900 font-semibold underline underline-offset-4" : ""
                  }`}
                >
                  Create Event
                </button>
                <button
                  type="button"
                  onClick={() => setOrganizerTab("PROFILE")}
                  className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    organizerTab === "PROFILE" ? "text-slate-900 font-semibold underline underline-offset-4" : ""
                  }`}
                >
                  Organizer Profile
                </button>
              </>
            )}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            {!user ? (
              <span className="text-xs text-slate-500 font-medium">
                Campus Portal
              </span>
            ) : user.role === "STUDENT" ? (
              <button
                type="button"
                onClick={() => setStudentDrawerOpen(true)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 text-xs font-semibold text-slate-800 border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN VIEWPORT */}
      <div className="flex-1">
        {initializing ? (
          <div className="max-w-[1200px] mx-auto px-6 py-20 text-center text-sm text-slate-500">
            Loading EVENT MANAGER...
          </div>
        ) : !user ? (
          <AuthPortal
            onAuthenticated={(authedUser) => setUser(authedUser)}
          />
        ) : user.role === "STUDENT" ? (
          <StudentDashboard
            user={user}
            isDrawerOpen={studentDrawerOpen}
            onOpenDrawer={() => setStudentDrawerOpen(true)}
            onCloseDrawer={() => setStudentDrawerOpen(false)}
            onLogout={handleLogout}
          />
        ) : (
          <OrganizerDashboard
            user={user}
            activeTab={organizerTab}
            onChangeTab={setOrganizerTab}
          />
        )}
      </div>

      {/* QUIET FOOTER */}
      <footer className="border-t border-slate-200 bg-white py-6 px-6 mt-12">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>EVENT MANAGER — College Event Management Platform</span>
          <span>Students &amp; Organizers Unified System</span>
        </div>
      </footer>
    </div>
  );
}
