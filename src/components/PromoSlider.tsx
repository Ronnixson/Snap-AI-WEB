import { useState, useEffect } from "react";
import { Project, EventPhoto } from "../types";
import { collection, getDocs, query, limit, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { handleFirestoreError, OperationType } from "../utils/firebaseErrors";
import { Calendar, MapPin, ChevronLeft, ChevronRight, Image as ImageIcon, CheckCircle, Flame } from "lucide-react";

interface PromoSliderProps {
  onSelectProject: (projectId: string) => void;
  projects: Project[];
  photos: EventPhoto[];
}

export default function PromoSlider({ onSelectProject, projects, photos }: PromoSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-slide every 6 seconds
  useEffect(() => {
    if (projects.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % projects.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [projects.length]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? projects.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % projects.length);
  };

  if (projects.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 font-sans my-6 shadow-xl">
        <ImageIcon className="h-10 w-10 text-sky-400 mx-auto mb-3 opacity-60" />
        <h3 className="text-lg font-bold text-white mb-1">Welcome to Snap AI</h3>
        <p className="text-sm max-w-md mx-auto">
          Start by going to the **Staff Uploads** or **Admin** panel (using the top simulation bar) to pre-populate dummy projects and photos instantly to test the sliders!
        </p>
      </div>
    );
  }

  const currentProject = projects[currentIndex];
  // Filter photos corresponding to current project
  const currentProjectPhotos = photos.filter(p => p.projectId === currentProject.id).slice(0, 6);

  return (
    <div className="relative group overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-8 flex flex-col lg:flex-row gap-8 shadow-2xl transition duration-300 hover:border-slate-700/80 my-6">
      
      {/* Absolute Badges */}
      <div className="absolute top-4 right-4 bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[10px] uppercase font-mono tracking-widest px-3 py-1 rounded-full z-10 flex items-center gap-1.5 font-bold shadow-md animate-pulse">
        <Flame className="h-3 w-3 stroke-[3]" /> Accomplished Project
      </div>

      {/* Left Column: Details */}
      <div className="w-full lg:w-2/5 flex flex-col justify-between py-2 z-10">
        <div>
          <span className="text-xs font-semibold text-sky-400 tracking-wider font-mono uppercase">Featured Event Spotlight</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight mt-1 transition duration-300">
            {currentProject.name}
          </h2>
          <p className="text-slate-400 text-sm mt-3 leading-relaxed">
            {currentProject.description || "An absolute celebration documented in HD details by Snap AI's professional photography staff."}
          </p>

          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-2.5 text-slate-300 text-xs">
              <Calendar className="h-4 w-4 text-sky-400 shrink-0" />
              <span>Event Date: <strong className="text-white">{currentProject.date}</strong></span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-300 text-xs">
              <MapPin className="h-4 w-4 text-sky-400 shrink-0" />
              <span>Venue Location: <strong className="text-white">{currentProject.location}</strong></span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-300 text-xs">
              <ImageIcon className="h-4 w-4 text-sky-400 shrink-0" />
              <span>Total Uploads: <strong className="text-white">{photos.filter(p => p.projectId === currentProject.id).length} photos</strong></span>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between">
          <button
            onClick={() => onSelectProject(currentProject.id)}
            className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-lg shadow-sky-500/10 hover:shadow-sky-500/25 active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            Find Your Face Matched Copy
          </button>

          {/* Slider Controllers */}
          <div className="flex gap-2">
            <button
              onClick={handlePrev}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-lg border border-slate-700/50 transition cursor-pointer"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleNext}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-lg border border-slate-700/50 transition cursor-pointer"
              aria-label="Next slide"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Sliding Grid Preview of Taken Photos */}
      <div className="w-full lg:w-3/5">
        <p className="text-[10px] text-slate-400 uppercase font-mono tracking-widest mb-2.5">
          Slideshow preview (Retaining perfect HD detail)
        </p>

        {currentProjectPhotos.length === 0 ? (
          <div className="h-64 rounded-xl bg-slate-950/40 border border-slate-800/80 flex flex-col items-center justify-center text-center p-4">
            <ImageIcon className="h-8 w-8 text-slate-600 mb-2" />
            <p className="text-slate-500 text-xs">No photos uploaded for this spotlight yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 h-64 overflow-hidden relative">
            {currentProjectPhotos.map((photo, i) => (
              <div
                key={photo.id}
                className="group/item relative h-28 sm:h-30 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-md transform hover:scale-105 duration-300 cursor-pointer"
                onClick={() => onSelectProject(currentProject.id)}
              >
                {/* Image preserving high definition quality */}
                <img
                  src={photo.base64Data}
                  alt={photo.fileName || "HD Snap AI"}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover/item:opacity-90 transition"
                />
                
                {/* Watermark in preview */}
                <div className="absolute inset-0 bg-black/10 flex items-center justify-center pointer-events-none">
                  <span className="text-[7px] tracking-[4px] font-mono text-white/40 uppercase font-bold select-none p-1 border border-white/20 bg-black/25 rounded">
                    SNAP AI PREVIEW
                  </span>
                </div>
              </div>
            ))}
            
            {/* Fade effect at the bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none" />
          </div>
        )}
      </div>
    </div>
  );
}
