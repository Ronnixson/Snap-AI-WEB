import { useState, useEffect } from "react";
import { onSnapshot, collection, query, orderBy, limit } from "firebase/firestore";
import { auth, db } from "./firebase";
import { UserProfile, Project, EventPhoto } from "./types";
import { handleFirestoreError, OperationType } from "./utils/firebaseErrors";
import AuthBar from "./components/AuthBar";
import PromoSlider from "./components/PromoSlider";
import FindMyPhotos from "./components/FindMyPhotos";
import StaffPortal from "./components/StaffPortal";
import AdminPanel from "./components/AdminPanel";
import { ImageIcon, Sparkles, Camera, Shield, Eye, Lock, HelpCircle, Check, Info, BadgeDollarSign, Heart, AlertCircle } from "lucide-react";

export default function App() {
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  
  const [theme, setTheme] = useState<"light" | "dark" | "">("");

  // On mount, load initial state or default to dark
  useEffect(() => {
    const savedTheme = (localStorage.getItem("snap_theme") as "light" | "dark") || "dark";
    setTheme(savedTheme);
  }, []);

  useEffect(() => {
    if (!theme) return;
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
    localStorage.setItem("snap_theme", theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" || prev === "" ? "light" : "dark"));
  };
  
  // Real-time Firestore sync states
  const [projects, setProjects] = useState<Project[]>([]);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);

  // Selected sub-state
  const [activeTab, setActiveTab] = useState<"showcase" | "search" | "staff" | "admin">("showcase");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedShowcaseCategory, setSelectedShowcaseCategory] = useState<string>("all");
  const [showcaseEventQuery, setShowcaseEventQuery] = useState<string>("");

  // Securely reset activeTab if permissions change or user logs out
  useEffect(() => {
    if (!currentProfile) {
      if (activeTab === "staff" || activeTab === "admin") {
        setActiveTab("showcase");
      }
    } else {
      if (activeTab === "admin" && currentProfile.role !== "admin") {
        setActiveTab("showcase");
      }
      if (activeTab === "staff" && currentProfile.role !== "staff" && currentProfile.role !== "admin") {
        setActiveTab("showcase");
      }
    }
  }, [currentProfile, activeTab]);

  // Clean trigger to query standard Firebase data in real-time
  const refreshAllData = async () => {
    // This is optional if our live snapshot listeners are configured, but nice to expose.
    console.log("Re-fetching snapshot databases...");
  };

  // 1. Listen to Projects Real-time (Publicly readable)
  useEffect(() => {
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Project[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as Project);
        });
        setProjects(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "projects");
      }
    );

    return () => unsubscribe();
  }, []);

  // 2. Listen to Photos Real-time (Authenticated only)
  useEffect(() => {
    if (!currentProfile) {
      setPhotos([]);
      return;
    }

    const q = query(collection(db, "photos"), orderBy("createdAt", "desc"), limit(48));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: EventPhoto[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as EventPhoto);
        });
        setPhotos(list);
      },
      (error) => {
        console.warn("Photo permissions restricted or unauthorized.");
      }
    );

    return () => unsubscribe();
  }, [currentProfile]);

  // 3. Listen to User Credentials (Admins only)
  useEffect(() => {
    if (currentProfile?.role !== "admin") {
      setProfiles([]);
      return;
    }

    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: UserProfile[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as UserProfile);
        });
        setProfiles(list);
      },
      (error) => {
        console.warn("User listing permitted only for system administrators.");
      }
    );

    return () => unsubscribe();
  }, [currentProfile]);

  // Facilitates slider project redirects
  const handleSelectSpotlight = (id: string) => {
    setSelectedProjectId(id);
    setActiveTab("search");
    // Scroll to active matching block smoothly
    window.scrollTo({ top: 350, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text flex flex-col justify-between font-sans transition-colors duration-250">
      
      {/* 1. AUTHENTICATION & DEMO CONTROL TERMINAL */}
      <AuthBar 
        onProfileLoaded={setCurrentProfile} 
        currentProfile={currentProfile} 
        theme={theme || "dark"} 
        onToggleTheme={handleToggleTheme} 
      />

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        
        {/* Portal Horizontal Navigation menu links */}
        <div className="flex border-b border-theme-border pb-px mb-8 overflow-x-auto gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab("showcase")}
            className={`py-3 px-4 text-xs sm:text-sm font-bold tracking-tight rounded-t-xl transition-all shrink-0 cursor-pointer ${
              activeTab === "showcase"
                ? "bg-theme-card text-sky-500 dark:text-sky-400 border-t-2 border-sky-550 dark:border-sky-400 border-x border-theme-border"
                : "text-theme-muted hover:text-theme-text"
            }`}
          >
            Public Showcases
          </button>
          
          <button
            onClick={() => setActiveTab("search")}
            className={`py-3 px-4 text-xs sm:text-sm font-bold tracking-tight rounded-t-xl transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "search"
                ? "bg-theme-card text-sky-500 dark:text-sky-400 border-t-2 border-sky-550 dark:border-sky-400 border-x border-theme-border"
                : "text-theme-muted hover:text-theme-text"
            }`}
          >
            <Sparkles className="h-4 w-4 text-sky-500 dark:text-sky-400" />
            Find My Photos
          </button>
          
          {currentProfile && (currentProfile.role === "staff" || currentProfile.role === "admin") && (
            <button
              onClick={() => setActiveTab("staff")}
              className={`py-3 px-4 text-xs sm:text-sm font-bold tracking-tight rounded-t-xl transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTab === "staff"
                  ? "bg-theme-card text-sky-500 dark:text-sky-400 border-t-2 border-sky-550 dark:border-sky-400 border-x border-theme-border"
                  : "text-theme-muted hover:text-theme-text"
              }`}
            >
              <Camera className="h-4 w-4" /> Photographer Workspace
            </button>
          )}

          {currentProfile?.role === "admin" && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`py-3 px-4 text-xs sm:text-sm font-bold tracking-tight rounded-t-xl transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTab === "admin"
                  ? "bg-theme-card text-sky-600 dark:text-sky-500 border-t-2 border-sky-600 dark:border-sky-555 border-x border-theme-border"
                  : "text-theme-muted hover:text-theme-text"
              }`}
            >
              <Shield className="h-4 w-4" /> Admin Controls
            </button>
          )}
        </div>

        {/* 2. DYNAMIC CONTENT RENDERING PANEL */}
        <div>
          {activeTab === "showcase" && (
            <div className="space-y-12">
              {(() => {
                const previewPhotos = photos.filter((p) => !!p.isPreview);
                const displayedPhotos = previewPhotos
                  .filter(
                    (p) =>
                      selectedShowcaseCategory === "all" ||
                      String(p.category || "General").toLowerCase() === selectedShowcaseCategory.toLowerCase()
                  )
                  .filter((p) => {
                    if (!showcaseEventQuery || showcaseEventQuery.trim() === "") return true;
                    const proj = projects.find((proj) => proj.id === p.projectId);
                    const projName = p.projectId === "individual" ? "Individual Photo" : (proj ? proj.name : "Company Item");
                    return projName.toLowerCase().includes(showcaseEventQuery.toLowerCase());
                  });

                return (
                  <>
                    {/* Slider SPOTLIGHT preview */}
                    <PromoSlider
                      onSelectProject={handleSelectSpotlight}
                      projects={projects}
                      photos={previewPhotos}
                    />

                    {/* SMOOTH CATEGORIZED GALLERY EXPLORER */}
                    <div className="bg-theme-card border border-theme-border rounded-2xl p-6 sm:p-8 shadow-md dark:shadow-xl space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme-border pb-4">
                        <div>
                          <h3 className="text-xl font-bold tracking-tight text-theme-text flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-sky-500/15 text-sky-500">
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </span>
                            Public Showcase Gallery
                          </h3>
                          <p className="text-theme-muted text-xs mt-1">
                            Browse and filter admin-approved public showcase highlights. (Other uploads belong strictly to private face-search scan matching for privacy).
                          </p>
                        </div>

                        {/* Live status badge */}
                        <div className="flex items-center gap-1.5 self-start sm:self-center">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[10px] text-emerald-500 font-mono uppercase tracking-wider font-semibold">Snap AI Live Pipeline</span>
                        </div>
                      </div>

                      {/* Check authentication state */}
                      {!currentProfile ? (
                        <div className="bg-theme-bg/50 border border-theme-border rounded-xl p-8 text-center">
                          <p className="text-theme-text font-bold text-sm">Secure Private Photo Streaming</p>
                          <p className="text-theme-muted text-xs max-w-sm mx-auto mt-2 leading-relaxed">
                            Please sign in with Google to activate the live image stream and browse photos.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          
                          {/* Smooth Filter Bar */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end bg-theme-bg/40 p-4 rounded-xl border border-theme-border/60">
                            <div className="space-y-2">
                              <label className="text-[10px] text-theme-muted font-bold font-mono uppercase tracking-wider block">
                                Filter Event Categories:
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  onClick={() => setSelectedShowcaseCategory("all")}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold select-none cursor-pointer border transition ${
                                    selectedShowcaseCategory === "all"
                                      ? "bg-slate-900 border-slate-705 text-white dark:bg-white dark:border-white dark:text-slate-950 font-bold font-sans"
                                      : "bg-theme-bg/60 border-theme-border text-theme-muted hover:text-theme-text font-sans"
                                  }`}
                                >
                                  All Previews ({previewPhotos.length})
                                </button>
                                {Array.from(new Set(previewPhotos.map((photo) => String(photo.category || "General")))).map((catVal) => {
                                  const catName = catVal as string;
                                  const count = previewPhotos.filter((p) => String(p.category || "General").toLowerCase() === catName.toLowerCase()).length;
                                  return (
                                    <button
                                      key={catName}
                                      onClick={() => setSelectedShowcaseCategory(catName.toLowerCase())}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold select-none cursor-pointer border transition ${
                                        selectedShowcaseCategory === catName.toLowerCase()
                                          ? "bg-indigo-650 border-indigo-500 text-white dark:bg-indigo-500 dark:border-indigo-405 font-bold font-sans"
                                          : "bg-theme-bg/60 border-theme-border text-theme-muted hover:text-theme-text font-sans"
                                      }`}
                                    >
                                      {catName} ({count})
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Event Name Filter */}
                            <div className="space-y-2">
                              <label className="text-[10px] text-theme-muted font-bold font-mono uppercase tracking-wider block">
                                Search by Event Name / Venue:
                              </label>
                              <input
                                type="text"
                                placeholder="Type event name..."
                                value={showcaseEventQuery}
                                onChange={(e) => setShowcaseEventQuery(e.target.value)}
                                className="w-full bg-theme-bg border border-theme-border rounded-lg py-1.5 px-3 text-xs text-theme-text placeholder-theme-muted focus:outline-none focus:border-sky-505"
                              />
                            </div>
                          </div>

                          {/* Grid displays */}
                          {displayedPhotos.length === 0 ? (
                            <div className="bg-theme-bg/30 border border-dashed border-theme-border rounded-xl p-8 text-center">
                              <p className="text-theme-muted text-xs">No active preview photos match the specified tags or search query.</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                              {displayedPhotos
                                .slice(0, 16)
                                .map((photo) => {
                                  const proj = projects.find((p) => p.id === photo.projectId);
                                  const projName = photo.projectId === "individual" ? "Individual Photo" : (proj ? proj.name : "Company Item");
                                  return (
                                    <div
                                      key={photo.id}
                                      className="group relative bg-slate-950 aspect-square rounded-xl overflow-hidden border border-theme-border shadow-sm hover:border-sky-500/50 transition duration-300 flex flex-col justify-end"
                                    >
                                      <img
                                        src={photo.base64Data}
                                        alt={photo.fileName}
                                        referrerPolicy="no-referrer"
                                        className="absolute inset-0 w-full h-full object-cover transition duration-500 group-hover:scale-105"
                                      />
                                      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/90 to-transparent" />
                                      
                                      {/* Visual Label indicators */}
                                      <div className="relative z-10 p-2.5 flex flex-col gap-0.5 pointer-events-none">
                                        <span className="text-[9px] bg-sky-500 text-slate-950 font-sans tracking-wide px-1.5 py-0.5 rounded border border-sky-400 self-start truncate max-w-full font-bold">
                                          🎯 {projName}
                                        </span>
                                        <span className="text-[9px] text-slate-350 italic truncate font-mono">
                                          🏷️ {photo.category || "General"}
                                        </span>
                                        <span className="text-[10px] text-white font-medium font-mono truncate">
                                          {photo.fileName}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* COMMERCIAL LAUNCH & BILLING INFORMATION BOX */}
              <div className="bg-theme-card border border-theme-border rounded-2xl p-6 sm:p-8 shadow-md dark:shadow-xl">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div>
                    <span className="text-xs uppercase font-mono tracking-widest text-sky-500 dark:text-sky-400 font-bold bg-sky-450/10 px-3 py-1 rounded-full">Commercial Release Strategy</span>
                    <h3 className="text-2xl font-black text-theme-text tracking-tight mt-3">Charging Model & Trial Rules</h3>
                    <p className="text-theme-muted text-sm mt-2 max-w-3xl leading-relaxed">
                      Snap AI operates on an <strong>Event-driven Premium Delivery Service</strong>. Event attendees can browse previews and run infinite face-matching queries under trial at zero cost! Instantly discover the exact high-definition photos where your face is found. Once identified:
                    </p>
                  </div>
                  <div className="shrink-0 bg-theme-bg/60 p-4 rounded-xl border border-theme-border text-center w-full md:w-auto">
                    <p className="text-[10px] text-theme-muted uppercase font-mono">STANDALONE original HD FILE</p>
                    <p className="text-3xl font-black text-amber-500 dark:text-yellow-400 font-mono mt-1">UGX 7,500 <span className="text-xs text-theme-muted">/ photo</span></p>
                    <p className="text-[10px] text-theme-muted font-mono mt-0.5">OR FULL COMPILATION UNLOCK FOR UGX 30,000</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8 pt-6 border-t border-theme-border">
                  <div className="bg-theme-bg/40 p-4 rounded-xl border border-theme-border space-y-2">
                    <div className="h-8 w-8 rounded-lg bg-sky-550/10 flex items-center justify-center text-sky-500">
                      <Eye className="h-4.5 w-4.5" />
                    </div>
                    <h5 className="font-bold text-theme-text text-xs">Unbounded Free Trial previews</h5>
                    <p className="text-xs text-theme-muted leading-normal">
                      Scan all pictures across all spotlight events using AI, inspect matched thumbnails, and download free previews layered with safety watermarks.
                    </p>
                  </div>

                  <div className="bg-theme-bg/40 p-4 rounded-xl border border-theme-border space-y-2">
                    <div className="h-8 w-8 rounded-lg bg-indigo-550/10 flex items-center justify-center text-indigo-500">
                      <BadgeDollarSign className="h-4.5 w-4.5" />
                    </div>
                    <h5 className="font-bold text-theme-text text-xs">A-La-Carte Secure Unlocks</h5>
                    <p className="text-xs text-theme-muted leading-normal">
                      Unlock unwatermarked HD files individually for single downloads, or purchase the entire matching pack to lock in maximum savings.
                    </p>
                  </div>

                  <div className="bg-theme-bg/40 p-4 rounded-xl border border-theme-border space-y-2">
                    <div className="h-8 w-8 rounded-lg bg-emerald-550/10 flex items-center justify-center text-emerald-555">
                      <Check className="h-4.5 w-4.5" />
                    </div>
                    <h5 className="font-bold text-theme-text text-xs">Pristine original HD Preservation</h5>
                    <p className="text-xs text-theme-muted leading-normal">
                      High definition photos retain absolute original resolution, camera profiles, and colors. Ready for sharing, printing, or social posts.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeTab === "search" && (
            <div>
              {currentProfile ? (
                <FindMyPhotos
                  projects={projects}
                  photos={photos}
                  selectedProjectId={selectedProjectId}
                  onSelectProjectId={setSelectedProjectId}
                  currentUserProfile={currentProfile}
                />
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-xl mx-auto my-6 shadow-2xl">
                  <AlertCircle className="h-12 w-12 text-sky-400 mx-auto mb-4 opacity-85" />
                  <h3 className="text-xl font-bold text-white font-sans">Sign In to Locate Personal Matches</h3>
                  <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                    Authentication is required to synchronize and compare facial-landmark points against event photography. Please **Sign In using Google** to begin.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "staff" && currentProfile && (currentProfile.role === "staff" || currentProfile.role === "admin") ? (
            <StaffPortal
              projects={projects}
              photos={photos}
              currentProfile={currentProfile}
              onRefreshData={refreshAllData}
              onSelectProjectId={setSelectedProjectId}
            />
          ) : activeTab === "staff" ? (
            <div className="bg-theme-bg/50 border border-theme-border rounded-xl p-8 text-center max-w-lg mx-auto">
              <Lock className="h-10 w-10 text-rose-500 mx-auto mb-3" />
              <p className="text-theme-text font-bold text-sm">Access Denied</p>
              <p className="text-theme-muted text-xs mt-2">Only registered Photographers can access this portal workspace.</p>
            </div>
          ) : null}

          {activeTab === "admin" && currentProfile?.role === "admin" ? (
            <AdminPanel
              projects={projects}
              photos={photos}
              profiles={profiles}
              currentProfile={currentProfile}
              onRefreshData={refreshAllData}
            />
          ) : activeTab === "admin" ? (
            <div className="bg-theme-bg/50 border border-theme-border rounded-xl p-8 text-center max-w-lg mx-auto">
              <Lock className="h-10 w-10 text-rose-500 mx-auto mb-3" />
              <p className="text-theme-text font-bold text-sm">Access Denied</p>
              <p className="text-theme-muted text-xs mt-2">Only registered System Administrators can access this portal.</p>
            </div>
          ) : null}
        </div>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-theme-border bg-theme-bg/80 py-8 px-4 text-center mt-12 text-xs text-theme-muted font-sans transition-colors duration-250">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Snap AI Delivery Systems.</p>
          <p className="flex items-center gap-1 justify-center text-theme-muted">
            Made with <Heart className="h-3 w-3 text-rose-500 fill-rose-500" /> by ITpath
          </p>
        </div>
      </footer>

    </div>
  );
}
