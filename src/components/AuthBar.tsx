import { useState, useEffect } from "react";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { UserProfile, UserRole } from "../types";
import { Shield, Camera, Users, LogOut, LogIn, Sparkles, Sun, Moon } from "lucide-react";

interface AuthBarProps {
  onProfileLoaded: (profile: UserProfile | null) => void;
  currentProfile: UserProfile | null;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export default function AuthBar({ onProfileLoaded, currentProfile, theme, onToggleTheme }: AuthBarProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync Firebase Auth status with Firestore profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        try {
          // Check if profile exists in Firestore
          const userRef = doc(db, "users", firebaseUser.uid);
          const snap = await getDoc(userRef);

          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            if (firebaseUser.email === "ronniemutalya36@gmail.com" && data.role !== "admin") {
              const updatedProfile: UserProfile = {
                ...data,
                role: "admin"
              };
              await setDoc(userRef, updatedProfile);
              onProfileLoaded(updatedProfile);
            } else {
              onProfileLoaded(data);
            }
          } else {
            // Initiate standard new client registration
            const isBootstrappedAdmin = firebaseUser.email === "ronniemutalya36@gmail.com";
            const newProfile: UserProfile = {
              id: firebaseUser.uid,
              email: firebaseUser.email || "no-email@snapai.app",
              name: firebaseUser.displayName || "Anonymous Attendee",
              role: isBootstrappedAdmin ? "admin" : "client",
              createdAt: new Date().toISOString(),
            };
            await setDoc(userRef, newProfile);
            onProfileLoaded(newProfile);
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
          setError("Failed to fetch user permissions.");
        }
      } else {
        onProfileLoaded(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [onProfileLoaded]);

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Google sign in failed:", err);
      if (err?.code === "auth/popup-closed-by-user" || err?.message?.includes("closed-by-user")) {
        setError("Google Sign-In popup was closed or blocked. Popups are often blocked in restricted iframe environments. Please allow popups or open the application in a new tab.");
      } else {
        setError(err?.message || "Google Authentication failed.");
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      onProfileLoaded(null);
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  return (
    <div className="bg-theme-card border-b border-theme-border text-theme-text py-3 px-4 sm:px-6 transition-colors duration-250">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Branding Logo */}
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 bg-gradient-to-tr from-sky-400 to-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-sky-500/10">
            <Camera className="h-5 w-5 text-slate-900 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-theme-text flex items-center gap-1.5 font-sans">
              Snap <span className="text-sky-450">AI</span>
            </h1>
            <p className="text-[10px] text-theme-muted font-mono tracking-wider">SMART PHOTO INSIGHTS</p>
          </div>
        </div>

        {/* Action Panel / Theme Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-3 ml-auto">
          {/* Light/Dark Mode Switcher */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg bg-theme-bg hover:bg-theme-bg/80 text-theme-text border border-theme-border hover:opacity-90 transition active:scale-95 cursor-pointer flex items-center justify-center mr-1"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle Theme"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-sky-500 fill-sky-300/40" />
            )}
          </button>

          {/* Social Sign In or Account controls */}
          {currentProfile ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block font-sans">
                <p className="text-xs font-medium text-theme-text">
                  {currentProfile.name && currentProfile.name !== "Anonymous Attendee" 
                    ? currentProfile.name 
                    : currentProfile.email.split("@")[0]}
                </p>
                <p className="text-[9px] text-sky-500 dark:text-sky-400 font-mono flex items-center gap-1 justify-end uppercase">
                  {currentProfile.role === "admin" && <Shield className="h-2 w-2" />}
                  {currentProfile.role === "staff" && <Camera className="h-2 w-2" />}
                  {currentProfile.role}
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="bg-theme-bg hover:bg-theme-bg/80 text-theme-text border border-theme-border px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <LogOut className="h-3 w-3" />
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleLogin}
              className="bg-sky-500 hover:bg-sky-400 text-slate-900 px-4 py-1.5 rounded-md text-xs font-bold font-sans flex items-center gap-1.5 shadow-lg shadow-sky-500/20 hover:shadow-sky-500/35 transition active:scale-95 cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign In with Google
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto mt-2 bg-red-500/10 border border-red-500/20 text-red-300 px-3 py-1.5 rounded-md text-xs">
          {error}
        </div>
      )}
    </div>
  );
}
