import { useState, useEffect } from "react";
import { onSnapshot, collection, query, orderBy, limit, doc, where } from "firebase/firestore";
import { auth, db } from "./firebase";
import { UserProfile, Project, EventPhoto, SystemSetting } from "./types";
import { handleFirestoreError, OperationType } from "./utils/firebaseErrors";
import AuthBar from "./components/AuthBar";
import PromoSlider from "./components/PromoSlider";
import FindMyPhotos from "./components/FindMyPhotos";
import StaffPortal from "./components/StaffPortal";
import AdminPanel from "./components/AdminPanel";
import { ImageIcon, Sparkles, Camera, Shield, Eye, Lock, HelpCircle, Check, Info, BadgeDollarSign, Heart, AlertCircle, Download, Share2, X, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { OFFICIAL_LOGO_BASE64 } from "./utils/logo";

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
  const [watermarkSetting, setWatermarkSetting] = useState<SystemSetting | null>(null);

  // Listen to Watermark Settings Real-Time
  useEffect(() => {
    const watermarkDocRef = doc(db, "settings", "watermark");
    const unsubscribe = onSnapshot(
      watermarkDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setWatermarkSetting(docSnap.data() as SystemSetting);
        } else {
          // Default fallbacks with text SNAP-AI
          setWatermarkSetting({
            id: "watermark",
            text: "SNAP-AI",
            type: "text",
            opacity: 0.4,
            updatedAt: new Date().toISOString()
          });
        }
      },
      (error) => {
        console.warn("Watermark settings fetch failed or permissions restricted:", error);
      }
    );
    return () => unsubscribe();
  }, []);

  // Selected sub-state
  const [activeTab, setActiveTab] = useState<"showcase" | "search" | "staff" | "admin">("showcase");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedShowcaseCategory, setSelectedShowcaseCategory] = useState<string>("all");
  const [showcaseEventQuery, setShowcaseEventQuery] = useState<string>("");
  const [showcaseCategoryTagQuery, setShowcaseCategoryTagQuery] = useState<string>("");

  // Favorites (Saved to Local Storage)
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("snap_favorite_photos");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);

  // Direct Social Share & Lightbox controls
  const [activeSharedPhoto, setActiveSharedPhoto] = useState<EventPhoto | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);

  useEffect(() => {
    if (photos.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const sharedPhotoId = params.get("photoId");
      if (sharedPhotoId) {
        const found = photos.find((p) => p.id === sharedPhotoId);
        if (found) {
          setActiveSharedPhoto(found);
        }
      }
    }
  }, [photos]);

  const handleCloseSharedPhoto = () => {
    setActiveSharedPhoto(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("photoId");
      window.history.replaceState({}, "", url.pathname + url.search);
    } catch (e) {
      console.warn("Failed to clean up URL: ", e);
    }
  };

  const handleSharePhoto = (photo: EventPhoto) => {
    try {
      const shareUrl = `${window.location.origin}${window.location.pathname}?photoId=${photo.id}`;
      navigator.clipboard.writeText(shareUrl);
      setShareToast("Direct photo sharing URL copied to clipboard! 📋");
      setTimeout(() => {
        setShareToast(null);
      }, 3500);
    } catch (e) {
      console.error("Clipboard copy failed: ", e);
    }
  };

  const toggleFavorite = (photoId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(photoId)
        ? prev.filter((id) => id !== photoId)
        : [...prev, photoId];
      localStorage.setItem("snap_favorite_photos", JSON.stringify(next));
      return next;
    });
  };

  const handleDownloadPreview = (photo: EventPhoto) => {
    const link = document.createElement("a");
    link.download = `snap_ai_preview_${photo.fileName || "highres.jpg"}`;
    
    // Create canvas and apply preview watermark before download
    const canvas = document.createElement("canvas");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        
        const watermarkOpacity = watermarkSetting?.opacity !== undefined ? watermarkSetting.opacity : 0.45;
        const logoData = watermarkSetting?.logoBase64 || OFFICIAL_LOGO_BASE64;

        // Render official gold logo watermark overlay at bottom right
        const logoImg = new Image();
        logoImg.crossOrigin = "anonymous";
        logoImg.onload = () => {
          ctx.globalAlpha = watermarkOpacity;
          const size = Math.min(canvas.width, canvas.height) * 0.24;
          const margin = Math.min(canvas.width, canvas.height) * 0.04;
          const x = canvas.width - size - margin;
          const y = canvas.height - size - margin;
          ctx.drawImage(logoImg, x, y, size, size);
          ctx.globalAlpha = 1.0;
          
          try {
            link.href = canvas.toDataURL("image/jpeg", 0.95);
            link.click();
          } catch (e) {
            console.error("Canvas export failed, doing direct download", e);
            link.href = photo.base64Data;
            link.click();
          }
        };
        logoImg.onerror = () => {
          try {
            link.href = canvas.toDataURL("image/jpeg", 0.95);
            link.click();
          } catch {
            link.href = photo.base64Data;
            link.click();
          }
        };
        logoImg.src = logoData;
      }
    };
    img.onerror = () => {
      link.href = photo.base64Data;
      link.click();
    };
    img.src = photo.base64Data;
  };

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

  // 2. Listen to Photos Real-time (Authenticated see latest, Guests see previews only)
  useEffect(() => {
    let q;
    if (currentProfile) {
      q = query(collection(db, "photos"), orderBy("createdAt", "desc"), limit(48));
    } else {
      // Query only flagged and admin-approved preview photos when not authenticated.
      // Avoid composite ordering constraints by sorting in memory for unauthenticated guests.
      q = query(collection(db, "photos"), where("isPreview", "==", true), where("isAdminApproved", "==", true), limit(48));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: EventPhoto[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as EventPhoto);
        });

        if (!currentProfile) {
          // Sort in memory by createdAt descending
          list.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          });
        }
        setPhotos(list);
      },
      (error) => {
        console.warn("Photo views or previews restricted:", error.message);
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

  // Greeting name resolver (Name or Email username)
  const getGreetingName = (profile: UserProfile | null) => {
    if (!profile) return "";
    if (profile.name && profile.name.trim() !== "" && profile.name !== "Anonymous Attendee") {
      return profile.name;
    }
    if (profile.email) {
      return profile.email.split("@")[0];
    }
    return "User";
  };

  // Precompute showcase elements globally for card clicking, lightbox details & navigation
  const previewPhotos = photos.filter((p) => {
    const isSubmitted = !!p.isPreview;
    if (!isSubmitted) return false;
    // If logged in as staff or admin, we can preview pending ones too
    if (currentProfile?.role === "admin" || currentProfile?.role === "staff") {
      return true;
    }
    return !!p.isAdminApproved;
  });

  const displayedPhotos = previewPhotos
    .filter(
      (p) =>
        selectedShowcaseCategory === "all" ||
        String(p.category || "General").toLowerCase() === selectedShowcaseCategory.toLowerCase()
    )
    .filter((p) => {
      if (!showFavoritesOnly) return true;
      return favorites.includes(p.id);
    })
    .filter((p) => {
      if (!showcaseEventQuery || showcaseEventQuery.trim() === "") return true;
      const proj = projects.find((proj) => proj.id === p.projectId);
      const projName = p.projectId === "individual" ? "Individual Photo" : (proj ? proj.name : "Company Item");
      return projName.toLowerCase().includes(showcaseEventQuery.toLowerCase());
    })
    .filter((p) => {
      if (!showcaseCategoryTagQuery || showcaseCategoryTagQuery.trim() === "") return true;
      const q = showcaseCategoryTagQuery.toLowerCase().trim();
      const cat = String(p.category || "General").toLowerCase();
      const alt = String(p.altText || "").toLowerCase();
      const filename = String(p.fileName || "").toLowerCase();
      return cat.includes(q) || alt.includes(q) || filename.includes(q);
    });

  // Keyboard layout next/prev and escape shortcuts inside Lightbox modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeSharedPhoto) return;
      
      const listToUse = displayedPhotos.length > 0 ? displayedPhotos : photos;
      const index = listToUse.findIndex((p) => p.id === activeSharedPhoto.id);
      
      if (e.key === "Escape") {
        handleCloseSharedPhoto();
      } else if (e.key === "ArrowRight") {
        if (index >= 0 && index < listToUse.length - 1) {
          setActiveSharedPhoto(listToUse[index + 1]);
        }
      } else if (e.key === "ArrowLeft") {
        if (index > 0) {
          setActiveSharedPhoto(listToUse[index - 1]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSharedPhoto, displayedPhotos, photos]);

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

        {/* Dynamic Personal Greeting Header */}
        {currentProfile && (
          <div className="mb-6 bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-transparent border border-theme-border rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-theme-text font-sans">
                Welcome back, <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent font-extrabold">{getGreetingName(currentProfile)}</span>! 👋
              </h2>
              <p className="text-xs text-theme-muted">
                Signed in securely as <strong className="text-theme-text font-mono font-normal">{currentProfile.email}</strong> • Role level: <span className="text-sky-500 font-mono text-[10px] uppercase font-bold">{currentProfile.role}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-theme-muted font-mono uppercase tracking-wider font-semibold">Active Session</span>
            </div>
          </div>
        )}
        
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

                      {/* Check authentication state & provide helpful guest reminder */}
                      <div className="space-y-6">
                        {!currentProfile && (
                          <div className="bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-transparent border border-sky-500/20 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <h4 className="text-sm font-bold text-sky-450 flex items-center gap-1.5 uppercase tracking-wider font-mono">
                                <Sparkles className="h-4 w-4 text-sky-400 shrink-0" /> Public Previews Enabled
                              </h4>
                              <p className="text-xs text-theme-muted max-w-2xl leading-relaxed">
                                You are currently browsing approved public showcase spotlights as a guest. Want to find the exact high-definition photographs where your own face is detected? Sign in above with Google to unleash Snap AI's instant face-matching engine!
                              </p>
                            </div>
                            <div className="shrink-0 bg-sky-500/10 px-3.5 py-1.5 rounded-lg border border-sky-500/30 text-[10px] text-sky-400 font-mono font-bold uppercase tracking-wider">
                              ⚡ AI Matching Offline
                            </div>
                          </div>
                        )}
                        
                        {/* Smooth Filter Bar */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end bg-theme-bg/40 p-4 rounded-xl border border-theme-border/60">
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
                                <button
                                  type="button"
                                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold select-none cursor-pointer border transition flex items-center gap-1.5 active:scale-95 duration-150 ${
                                    showFavoritesOnly
                                      ? "bg-rose-500/10 border-rose-500/30 text-rose-500 font-bold"
                                      : "bg-theme-bg/60 border-theme-border text-theme-muted hover:text-rose-450 hover:border-rose-500/25"
                                  }`}
                                  title="Filter list to show only favorited items saved to your browser"
                                >
                                  <Heart
                                    className={`h-3.5 w-3.5 ${showFavoritesOnly ? "fill-rose-500 text-rose-500 animate-pulse" : "text-theme-muted"}`}
                                  />
                                  Favorites ({favorites.length})
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
                              <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-theme-muted" />
                                <input
                                  type="text"
                                  placeholder="Type event name..."
                                  value={showcaseEventQuery}
                                  onChange={(e) => setShowcaseEventQuery(e.target.value)}
                                  className="w-full bg-theme-bg border border-theme-border rounded-lg py-1.5 pl-9 pr-3 text-xs text-theme-text placeholder-theme-muted focus:outline-none focus:border-sky-505"
                                />
                                {showcaseEventQuery && (
                                  <button
                                    onClick={() => setShowcaseEventQuery("")}
                                    className="absolute right-2.5 top-2.5 text-theme-muted hover:text-theme-text"
                                    title="Clear event search"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Real-time Category/Tag Filter */}
                            <div className="space-y-2">
                              <label className="text-[10px] text-theme-muted font-bold font-mono uppercase tracking-wider block">
                                Search Photo Categories / Tags:
                              </label>
                              <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-theme-muted" />
                                <input
                                  type="text"
                                  placeholder="Search categories (e.g., Candid, Cap Throw, Ceremony)..."
                                  value={showcaseCategoryTagQuery}
                                  onChange={(e) => setShowcaseCategoryTagQuery(e.target.value)}
                                  className="w-full bg-theme-bg border border-theme-border rounded-lg py-1.5 pl-9 pr-3 text-xs text-theme-text placeholder-theme-muted focus:outline-none focus:border-sky-505"
                                />
                                {showcaseCategoryTagQuery && (
                                  <button
                                    onClick={() => setShowcaseCategoryTagQuery("")}
                                    className="absolute right-2.5 top-2.5 text-theme-muted hover:text-theme-text"
                                    title="Clear category/tag search"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
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
                                      onClick={() => setActiveSharedPhoto(photo)}
                                      className="group relative bg-slate-950 aspect-square rounded-xl overflow-hidden border border-theme-border shadow-sm hover:border-sky-500/50 transition duration-300 flex flex-col justify-end cursor-pointer select-none hover:shadow-xl hover:shadow-sky-500/5"
                                      title="Click to expand high-res lightbox inspection"
                                    >
                                      <img
                                        src={photo.base64Data}
                                        alt={photo.fileName}
                                        referrerPolicy="no-referrer"
                                        className="absolute inset-0 w-full h-full object-cover transition duration-500 group-hover:scale-105"
                                      />

                                      {/* Interactive Heart Favorite Button Overlay */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleFavorite(photo.id);
                                        }}
                                        className="absolute top-2 left-2 z-15 p-1.5 rounded-lg bg-slate-950/75 hover:bg-slate-950/95 border border-slate-800/80 hover:border-rose-500/35 text-slate-350 hover:text-rose-550 transition duration-150 cursor-pointer shadow-lg active:scale-90"
                                        title={favorites.includes(photo.id) ? "Remove from Saved Favorites" : "Save to Favorites"}
                                      >
                                        <Heart
                                          className={`h-3.5 w-3.5 transition-all duration-150 ${
                                            favorites.includes(photo.id)
                                              ? "fill-rose-500 text-rose-500 scale-110"
                                              : "text-slate-400 group-hover:text-rose-450"
                                          }`}
                                        />
                                      </button>

                                      {/* Download Watermarked Preview Button Overlay */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadPreview(photo);
                                        }}
                                        className="absolute top-2 left-10 z-15 p-1.5 rounded-lg bg-slate-950/75 hover:bg-slate-950/95 border border-slate-800/80 hover:border-sky-500/35 text-slate-350 hover:text-sky-400 transition duration-150 cursor-pointer shadow-lg active:scale-90"
                                        title="Download Preview with Watermark"
                                      >
                                        <Download className="h-3.5 w-3.5 text-slate-450 group-hover:text-sky-400 transition-colors duration-150" />
                                      </button>

                                      {/* Share Photo Direct Link Overlay */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSharePhoto(photo);
                                        }}
                                        className="absolute top-2 left-[4.5rem] z-15 p-1.5 rounded-lg bg-slate-950/75 hover:bg-slate-950/95 border border-slate-800/80 hover:border-emerald-500/35 text-slate-350 hover:text-emerald-400 transition duration-150 cursor-pointer shadow-lg active:scale-90"
                                        title="Copy Direct Share Link"
                                      >
                                        <Share2 className="h-3.5 w-3.5 text-slate-450 group-hover:text-emerald-400 transition-colors duration-150" />
                                      </button>

                                      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/90 to-transparent" />
                                      
                                      {/* Approval tag indicators for admin/staff */}
                                      {(!photo.isAdminApproved) && (currentProfile?.role === "admin" || currentProfile?.role === "staff") && (
                                        <div className="absolute top-2 right-2 z-10">
                                          <span className="text-[8px] bg-red-650 text-white font-bold p-1 rounded border border-red-500 uppercase tracking-widest font-mono shadow-md">
                                            ⏳ Pending Approval
                                          </span>
                                        </div>
                                      )}
                                      {(!!photo.isAdminApproved) && (currentProfile?.role === "admin" || currentProfile?.role === "staff") && (
                                        <div className="absolute top-2 right-2 z-10">
                                          <span className="text-[8px] bg-emerald-600 text-white font-bold p-1 rounded border border-emerald-500 uppercase tracking-widest font-mono shadow-md">
                                            ✅ Approved Preview
                                          </span>
                                        </div>
                                      )}

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
                  watermarkSetting={watermarkSetting}
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
              watermarkSetting={watermarkSetting}
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
            Powered <Heart className="h-3 w-3 text-rose-500 fill-rose-500" /> by ITpath
          </p>
        </div>
      </footer>

      {/* 4. PREMIUM SOCIAL SHARE LIGHTBOX MODAL */}
      {activeSharedPhoto && (() => {
        const listToUseForNav = displayedPhotos.length > 0 ? displayedPhotos : photos;
        const currentNavIndex = listToUseForNav.findIndex(p => p.id === activeSharedPhoto.id);
        const hasPrevPhoto = currentNavIndex > 0;
        const hasNextPhoto = currentNavIndex >= 0 && currentNavIndex < listToUseForNav.length - 1;

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md transition-all duration-300">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl relative overflow-hidden flex flex-col md:flex-row gap-6">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500" />
              
              {/* Close button */}
              <button
                onClick={handleCloseSharedPhoto}
                className="absolute top-4 right-4 p-2 rounded-full bg-slate-950/65 hover:bg-slate-950/95 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition cursor-pointer z-50 animate-pulse"
                title="Close direct preview"
              >
                <X className="h-4.5 w-4.5" />
              </button>

              {/* Photo Column */}
              <div className="w-full md:w-3/5 bg-slate-950 rounded-2xl aspect-square relative overflow-hidden border border-slate-800 flex items-center justify-center group/nav">
                <img
                  src={activeSharedPhoto.base64Data}
                  alt={activeSharedPhoto.fileName}
                  referrerPolicy="no-referrer"
                  className="max-h-full max-w-full object-contain transition-all duration-300 hover:scale-105"
                />

                {/* Left navigation arrow */}
                {hasPrevPhoto && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSharedPhoto(listToUseForNav[currentNavIndex - 1]);
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white border border-white/10 hover:border-white/30 hover:scale-110 active:scale-90 transition shadow-xl cursor-pointer z-20"
                    title="Previous Photo (Left Arrow Key)"
                  >
                    <ChevronLeft className="h-4.5 w-4.5" />
                  </button>
                )}

                {/* Right navigation arrow */}
                {hasNextPhoto && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSharedPhoto(listToUseForNav[currentNavIndex + 1]);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white border border-white/10 hover:border-white/30 hover:scale-110 active:scale-90 transition shadow-xl cursor-pointer z-20"
                    title="Next Photo (Right Arrow Key)"
                  >
                    <ChevronRight className="h-4.5 w-4.5" />
                  </button>
                )}

                <div className="absolute bottom-3 left-3 bg-slate-950/70 backdrop-blur-sm px-2.5 py-1 rounded-md text-[10px] font-mono text-slate-450 border border-slate-800 flex items-center gap-1 select-none">
                  <span>Photo Index:</span>
                  <span className="text-sky-400 font-bold">{currentNavIndex + 1}</span>
                  <span className="text-slate-600">/</span>
                  <span className="text-slate-400">{listToUseForNav.length}</span>
                </div>
              </div>

              {/* Meta and Details Column */}
              <div className="w-full md:w-2/5 flex flex-col justify-between py-1 gap-4 text-left">
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/30 font-bold uppercase tracking-wider block w-fit mb-2">
                      Lightbox Spotlight
                    </span>
                    <h4 className="text-lg font-black text-white leading-tight font-sans tracking-tight">
                      {activeSharedPhoto.fileName || "Event Spotlight Photo"}
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed font-sans mt-1">
                      Event: <strong className="text-sky-350">{
                        activeSharedPhoto.projectId === "individual" 
                          ? "Individual Spotlight Portrait" 
                          : (projects.find((p) => p.id === activeSharedPhoto.projectId)?.name || "Corporate Event Compilation")
                      }</strong>
                    </p>
                  </div>

                  <div className="space-y-1 bg-slate-950/60 p-3 rounded-xl border border-slate-850">
                    <p className="text-[10px] uppercase text-slate-450 font-mono tracking-wider font-semibold">Category Label</p>
                    <p className="text-xs text-white font-mono font-medium flex items-center gap-1.5">
                      🏷️ {activeSharedPhoto.category || "General"}
                    </p>
                  </div>
                </div>

                {/* Action Buttons list */}
                <div className="space-y-2 mt-auto">
                  <button
                    type="button"
                    onClick={() => handleSharePhoto(activeSharedPhoto)}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-xl transition duration-150 transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-700/10"
                  >
                    <Share2 className="h-4 w-4" />
                    Copy Shareable Url Link
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadPreview(activeSharedPhoto)}
                    className="w-full bg-slate-950 hover:bg-slate-900 text-sky-400 hover:text-sky-300 font-bold text-xs py-3 rounded-xl border border-slate-800 hover:border-sky-500/30 transition duration-150 transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    Download Watermarked Preview
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleFavorite(activeSharedPhoto.id)}
                    className={`w-full font-bold text-xs py-3 rounded-xl transition duration-150 transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer border ${
                      favorites.includes(activeSharedPhoto.id)
                        ? "bg-rose-500/15 text-rose-500 border-rose-500/35 hover:bg-rose-500/25"
                        : "bg-slate-950 hover:bg-slate-900 text-slate-300 border-slate-800 hover:border-rose-500/25 hover:text-rose-400"
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${favorites.includes(activeSharedPhoto.id) ? "fill-rose-500 text-rose-500 animate-pulse" : ""}`} />
                    {favorites.includes(activeSharedPhoto.id) ? "Saved in Your Favorites" : "Save to Favorites"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 5. GENTLE FLOATING NOTIFICATION TOAST */}
      {shareToast && (
        <div className="fixed bottom-6 right-6 z-[120] animate-bounce bg-emerald-600 border border-emerald-500/30 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 max-w-sm">
          <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm shrink-0">
            ✓
          </div>
          <p className="text-xs font-bold leading-normal tracking-tight font-sans">
            {shareToast}
          </p>
        </div>
      )}

    </div>
  );
}
