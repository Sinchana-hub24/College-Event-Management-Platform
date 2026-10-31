import React, { useState, useRef } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { apiRequest, ApiError, setStoredToken } from "../api";
import { User, UserRole } from "../types";

interface AuthPortalProps {
  onAuthenticated: (user: User) => void;
}

export const AuthPortal: React.FC<AuthPortalProps> = ({ onAuthenticated }) => {
  const [role, setRole] = useState<UserRole>("STUDENT");
  const [mode, setMode] = useState<"LOGIN" | "REGISTER">("LOGIN");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [roleMismatchTarget, setRoleMismatchTarget] = useState<UserRole | null>(null);
  const [existingAccountNotice, setExistingAccountNotice] = useState<{
    message: string;
    detectedRole?: UserRole;
    detectedUsername?: string;
  } | null>(null);
  const [switchedInfoMessage, setSwitchedInfoMessage] = useState<string | null>(null);

  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const handleUsernameBlur = async () => {
    const trimmed = username.trim().toLowerCase();
    if (mode !== "REGISTER" || trimmed.length < 3) return;
    try {
      const check = await apiRequest<{
        exists: boolean;
        role?: UserRole;
        message?: string;
      }>(`/api/auth/check-username?username=${encodeURIComponent(trimmed)}`);

      if (check.exists) {
        setExistingAccountNotice({
          message:
            check.message ||
            `Account "${trimmed}" already exists in the database.`,
          detectedRole: check.role,
          detectedUsername: trimmed,
        });
      } else {
        setExistingAccountNotice(null);
      }
    } catch {
      // Ignore background check transient errors
    }
  };

  const handleSwitchToExistingAccount = () => {
    if (existingAccountNotice?.detectedRole) {
      setRole(existingAccountNotice.detectedRole);
    }
    if (existingAccountNotice?.detectedUsername) {
      setUsername(existingAccountNotice.detectedUsername);
    }
    setMode("LOGIN");
    setExistingAccountNotice(null);
    setErrorMessage(null);
    setSwitchedInfoMessage(
      "Account already exists — switched to existing account Sign In. Enter your password below."
    );
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setRoleMismatchTarget(null);
    setSwitchedInfoMessage(null);
    setLoading(true);

    try {
      if (mode === "REGISTER") {
        const res = await apiRequest<{ token: string; user: User }>(
          "/api/auth/register",
          {
            method: "POST",
            body: JSON.stringify({
              username,
              password,
              full_name: fullName,
              email,
              phone,
              department,
              role,
            }),
          }
        );
        setStoredToken(res.token);
        onAuthenticated(res.user);
      } else {
        const res = await apiRequest<{ token: string; user: User }>(
          "/api/auth/login",
          {
            method: "POST",
            body: JSON.stringify({
              username,
              password,
              role,
            }),
          }
        );
        setStoredToken(res.token);
        onAuthenticated(res.user);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          const detailObj = err.detail as {
            role?: UserRole;
            username?: string;
            message?: string;
          } | null;
          setExistingAccountNotice({
            message:
              detailObj?.message ||
              err.message ||
              "An account with these details already exists.",
            detectedRole: detailObj?.role,
            detectedUsername: detailObj?.username,
          });
        } else if (err.status === 403 && err.expectedRole) {
          setErrorMessage(err.message);
          setRoleMismatchTarget(err.expectedRole);
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage("Unable to reach server. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-[1200px] mx-auto px-6 py-12 lg:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
        {/* Left Column */}
        <section className="lg:col-span-7 flex flex-col justify-between py-2">
          <div>
            <p className="text-xs font-semibold text-rose-600 tracking-wide mb-3">
              College Event Management Platform
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.1] balance-text mb-5">
              Discover, host, and manage every campus event in one unified place.
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-[62ch] mb-10">
              Sign in or create an account as a{" "}
              <strong className="font-semibold text-slate-900">Student</strong>{" "}
              to discover active events, register individual or team participants, and ask organizers questions—or sign in as an{" "}
              <strong className="font-semibold text-slate-900">Organizer</strong>{" "}
              to host events, manage participant rosters, export Excel spreadsheets, and answer FAQs.
            </p>

            <div className="border-t border-slate-200 pt-8 space-y-6">
              <div className="grid grid-cols-[36px_1fr] gap-3 items-start">
                <span className="font-mono text-xs font-semibold text-rose-600 pt-1 tabular-nums">
                  01.
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Top 5 Event
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Student registrations automatically rank the top 5 most popular college events in the hero spotlight.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-[36px_1fr] gap-3 items-start">
                <span className="font-mono text-xs font-semibold text-rose-600 pt-1 tabular-nums">
                  02.
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Automated Event Lifecycle &amp; History
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Completed events are cleanly removed from the public website listing, while remaining available in student history and organizer management.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-[36px_1fr] gap-3 items-start">
                <span className="font-mono text-xs font-semibold text-rose-600 pt-1 tabular-nums">
                  03.
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Multi-Participant Registration &amp; Excel Export
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Register X team or group participants with individual details collected per member, and export all registrations directly to Excel (.xlsx).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Role Selection + Auth Form */}
        <section className="lg:col-span-5">
          <div className="bg-white border border-slate-200 rounded-xl p-7 sm:p-8 h-full flex flex-col justify-between">
            <div>
              <div className="mb-6">
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Select User Role
                </label>
                <div
                  className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg"
                  role="tablist"
                  aria-label="Account Role"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setRole("STUDENT");
                      setErrorMessage(null);
                      setRoleMismatchTarget(null);
                    }}
                    className={`py-2 px-4 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      role === "STUDENT"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    STUDENT
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRole("ORGANIZER");
                      setErrorMessage(null);
                      setRoleMismatchTarget(null);
                    }}
                    className={`py-2 px-4 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      role === "ORGANIZER"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    ORGANIZER
                  </button>
                </div>
              </div>

              {/* Mode Tabs */}
              <div className="flex items-center gap-6 border-b border-slate-200 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setMode("LOGIN");
                    setExistingAccountNotice(null);
                    setErrorMessage(null);
                  }}
                  className={`pb-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    mode === "LOGIN"
                      ? "border-rose-600 text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("REGISTER");
                    setErrorMessage(null);
                    setSwitchedInfoMessage(null);
                  }}
                  className={`pb-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    mode === "REGISTER"
                      ? "border-rose-600 text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Create New Account
                </button>
              </div>

              {switchedInfoMessage && (
                <div className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{switchedInfoMessage}</span>
                </div>
              )}

              {existingAccountNotice && mode === "REGISTER" && (
                <div className="mb-5 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-2.5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <p className="font-medium leading-relaxed">
                      {existingAccountNotice.message}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSwitchToExistingAccount}
                    className="w-full py-2 px-3 bg-slate-900 text-white font-semibold rounded-md hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Switch to Existing Account Sign In
                  </button>
                </div>
              )}

              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                  {roleMismatchTarget && (
                    <button
                      type="button"
                      onClick={() => {
                        setRole(roleMismatchTarget);
                        setErrorMessage(null);
                        setRoleMismatchTarget(null);
                      }}
                      className="py-1.5 px-3 bg-white border border-rose-300 text-rose-900 font-semibold rounded-md hover:bg-rose-100 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Switch Role to {roleMismatchTarget}
                    </button>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="auth-username"
                    className="block text-xs font-semibold text-slate-800 mb-1.5"
                  >
                    Username
                  </label>
                  <input
                    id="auth-username"
                    type="text"
                    required
                    minLength={3}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onBlur={handleUsernameBlur}
                    placeholder={
                      role === "ORGANIZER"
                        ? "e.g. robotics_club"
                        : "e.g. rahul_cs26"
                    }
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:border-transparent"
                  />
                </div>

                {mode === "REGISTER" && (
                  <>
                    <div>
                      <label
                        htmlFor="auth-fullname"
                        className="block text-xs font-semibold text-slate-800 mb-1.5"
                      >
                        {role === "ORGANIZER"
                          ? "Organizer / Club Lead Name"
                          : "Student Full Name"}
                      </label>
                      <input
                        id="auth-fullname"
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={
                          role === "ORGANIZER"
                            ? "e.g. IEEE Student Branch"
                            : "e.g. Rahul Sharma"
                        }
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:border-transparent"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label
                          htmlFor="auth-email"
                          className="block text-xs font-semibold text-slate-800 mb-1.5"
                        >
                          Email ID
                        </label>
                        <input
                          id="auth-email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@college.edu"
                          className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="auth-phone"
                          className="block text-xs font-semibold text-slate-800 mb-1.5"
                        >
                          Phone Number
                        </label>
                        <input
                          id="auth-phone"
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="auth-dept"
                        className="block text-xs font-semibold text-slate-800 mb-1.5"
                      >
                        {role === "ORGANIZER"
                          ? "Department / Organizing Committee"
                          : "Department & Year"}
                      </label>
                      <input
                        id="auth-dept"
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder={
                          role === "ORGANIZER"
                            ? "e.g. Department of Computer Science"
                            : "e.g. Information Technology · 3rd Year"
                        }
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:border-transparent"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-semibold text-slate-800 mb-1.5"
                  >
                    Password
                  </label>
                  <input
                    ref={passwordInputRef}
                    id="auth-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:border-transparent"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap mt-2"
                >
                  {loading
                    ? "Verifying..."
                    : mode === "LOGIN"
                    ? `Sign In as ${role === "STUDENT" ? "Student" : "Organizer"}`
                    : `Create ${role === "STUDENT" ? "Student" : "Organizer"} Account`}
                </button>
              </form>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between gap-2">
              <span>
                {mode === "REGISTER"
                  ? "Already have an account?"
                  : "New to EVENT MANAGER?"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "REGISTER" ? "LOGIN" : "REGISTER");
                  setExistingAccountNotice(null);
                  setErrorMessage(null);
                }}
                className="font-semibold text-slate-900 hover:text-rose-600 underline underline-offset-4 cursor-pointer whitespace-nowrap"
              >
                {mode === "REGISTER"
                  ? "Sign in with existing account"
                  : "Create a new account"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};
