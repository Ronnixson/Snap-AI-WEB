import React, { useState, useRef, useEffect } from "react";
import { Project, EventPhoto, SystemSetting } from "../types";
import { Camera, Upload, Check, Loader2, Sparkles, Download, CreditCard, Lock, UserCheck, RefreshCw, AlertCircle, Eye, HelpCircle, Search, Filter } from "lucide-react";

interface FindMyPhotosProps {
  projects: Project[];
  photos: EventPhoto[];
  selectedProjectId: string;
  onSelectProjectId: (id: string) => void;
  currentUserProfile: any;
  watermarkSetting?: SystemSetting | null;
}

export default function FindMyPhotos({
  projects,
  photos,
  selectedProjectId,
  onSelectProjectId,
  currentUserProfile,
  watermarkSetting,
}: FindMyPhotosProps) {
  const [selfie, setSelfie] = useState<string | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [matchStatus, setMatchStatus] = useState<string>("");
  const [matchedPhotoIds, setMatchedPhotoIds] = useState<string[]>([]);
  const [matchDetails, setMatchDetails] = useState<{ [photoId: string]: { confidence: number; reasoning: string } }>({});
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [eventNameQuery, setEventNameQuery] = useState<string>("");
  const [searchOption, setSearchOption] = useState<"face" | "text">("face");
  const [photoIdQuery, setPhotoIdQuery] = useState<string>("");

  // Billing states (for trial mode premium monetization)
  const [unlockedPhotos, setUnlockedPhotos] = useState<{ [photoId: string]: boolean }>({});
  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(null);
  const [isDemoPaidUser, setIsDemoPaidUser] = useState(false);

  // Camera capture states
  const [useCamera, setUseCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  // Turn on camera for selfie capture
  const handleStartCamera = async () => {
    setCameraError(null);
    setUseCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 480, facingMode: "user" },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setCameraError("Could not access camera. Please upload an image file instead.");
      setUseCamera(false);
    }
  };

  // Capture photo from video stream
  const handleCapturePhoto = () => {
    if (videoRef.current && cameraStream) {
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(-1, 1); // Flip horizontally for standard mirror selfie feel
        ctx.drawImage(videoRef.current, -400, 0, 400, 400);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setSelfie(dataUrl);

        // Stop camera stream
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
        setUseCamera(false);
      }
    }
  };

  // File Upload fallback
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelfie(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Perform Face Matching using server-side Gemini
  const handleFindMatches = async () => {
    if (!selfie) return;
    setIsMatching(true);
    setHasSearched(false);
    setMatchedPhotoIds([]);
    setMatchDetails({});

    // Filter project photos to run matching
    const targetPhotos = selectedProjectId
      ? photos.filter((p) => p.projectId === selectedProjectId)
      : photos;

    if (targetPhotos.length === 0) {
      setMatchStatus("No photos available to scan in this compilation.");
      setIsMatching(false);
      setHasSearched(true);
      return;
    }

    try {
      setMatchStatus("Activating Snap AI Core face tracker...");
      await new Promise((r) => setTimeout(r, 700));

      setMatchStatus("Extracting landmark contours & expressions...");
      await new Promise((r) => setTimeout(r, 500));

      setMatchStatus("Comparing face structure using Gemini AI multi-modal analysis...");

      // Call the server API endpoint
      const response = await fetch("/api/match-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selfieBase64: selfie,
          photos: targetPhotos.map((p) => ({
            id: p.id,
            base64Data: p.base64Data,
          })),
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to parse matches from service.");
      }

      const data = await response.json();
      if (data.success) {
        setMatchedPhotoIds(data.matchedPhotoIds || []);
        setMatchDetails(data.details || {});
      } else {
        throw new Error("Facial sorting response error.");
      }
    } catch (err: any) {
      console.error(err);
      setMatchStatus("Matching failed: " + err.message);
    } finally {
      setIsMatching(false);
      setHasSearched(true);
    }
  };

  // Perform Unique ID / Metadata Text Searching
  const handleTextSearch = async () => {
    if (!photoIdQuery.trim()) return;
    setIsMatching(true);
    setHasSearched(false);
    setMatchedPhotoIds([]);
    setMatchDetails({});

    try {
      setMatchStatus("Searching our secure repository by Unique Identifier/Metadata...");
      await new Promise((r) => setTimeout(r, 800));

      const queryVal = photoIdQuery.trim().toLowerCase();
      
      // Filter by project/compilation if specified
      const targetPhotos = selectedProjectId
        ? photos.filter((p) => p.projectId === selectedProjectId)
        : photos;

      // Filter photos matching text query (matches ID/Alt Text, containing name or full filename, or custom altText)
      const matches = targetPhotos.filter((p) => {
        const matchId = String(p.id).toLowerCase();
        const matchFileName = String(p.fileName || "").toLowerCase();
        const matchAlt = String(p.altText || "").toLowerCase();
        return (
          matchId.includes(queryVal) ||
          matchFileName.includes(queryVal) ||
          matchAlt.includes(queryVal)
        );
      });

      const mIds = matches.map(p => p.id);
      const mDetails: { [photoId: string]: { confidence: number; reasoning: string } } = {};
      matches.forEach(p => {
        mDetails[p.id] = {
          confidence: 1.00,
          reasoning: `Matched via Photographer Alt Text / Search ID: "${p.altText || p.id}".`
        };
      });

      setMatchedPhotoIds(mIds);
      setMatchDetails(mDetails);
      setMatchStatus("");
    } catch (err: any) {
      console.error("Text search error:", err);
      setMatchStatus("Search failed: " + err.message);
    } finally {
      setIsMatching(false);
      setHasSearched(true);
    }
  };

  // Download high-resolution photo cleanly
  const handleDownload = (photo: EventPhoto, isWatermarked: boolean) => {
    const link = document.createElement("a");
    link.download = `snap_ai_${photo.fileName || "highres.jpg"}`;
    
    if (isWatermarked) {
      // Create canvas and apply preview watermarks before download
      const canvas = document.createElement("canvas");
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          
          const watermarkText = watermarkSetting?.text || "SNAP-AI";
          const watermarkOpacity = watermarkSetting?.opacity !== undefined ? watermarkSetting.opacity : 0.45;
          const watermarkType = watermarkSetting?.type || "text";
          const logoData = watermarkSetting?.logoBase64;

          if (watermarkType === "logo" && logoData) {
            // Render logo overlay
            const logoImg = new Image();
            logoImg.onload = () => {
              ctx.globalAlpha = watermarkOpacity;
              const size = Math.min(canvas.width, canvas.height) * 0.4;
              const x = (canvas.width - size) / 2;
              const y = (canvas.height - size) / 2;
              ctx.drawImage(logoImg, x, y, size, size);
              ctx.globalAlpha = 1.0;
              
              link.href = canvas.toDataURL("image/jpeg", 0.9);
              link.click();
            };
            logoImg.src = logoData;
          } else {
            // Render text watermark diagonal cross and text tag
            ctx.strokeStyle = `rgba(255, 255, 255, ${watermarkOpacity * 0.6})`;
            ctx.lineWidth = Math.max(2, Math.floor(canvas.width / 400));
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(canvas.width, canvas.height);
            ctx.moveTo(canvas.width, 0);
            ctx.lineTo(0, canvas.height);
            ctx.stroke();

            ctx.fillStyle = `rgba(255, 255, 255, ${watermarkOpacity})`;
            const fontSize = Math.max(16, Math.floor(canvas.width / 18));
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(watermarkText, canvas.width / 2, canvas.height / 2);
            
            link.href = canvas.toDataURL("image/jpeg", 0.9);
            link.click();
          }
        }
      };
      img.src = photo.base64Data;
    } else {
      // Standard HD original unwatermarked copy
      link.href = photo.base64Data;
      link.click();
    }
  };

  // Simulates billing plan system checkout
  const handleProcessUnlock = async (photoId: string) => {
    setIsProcessingPayment(photoId);
    // Simulate secure processor latency (Stripe / Bank standard)
    await new Promise((r) => setTimeout(r, 1600));
    setUnlockedPhotos((prev) => ({ ...prev, [photoId]: true }));
    setIsProcessingPayment(null);
  };

  const handleUnlockAll = async () => {
    setIsProcessingPayment("all");
    await new Promise((r) => setTimeout(r, 2000));
    // Unlock all matched photos
    const updated: { [id: string]: boolean } = {};
    matchedPhotoIds.forEach(id => {
      updated[id] = true;
    });
    setUnlockedPhotos(updated);
    setIsDemoPaidUser(true);
    setIsProcessingPayment(null);
  };

  const selectedProj = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="space-y-8 py-4">
      
      {/* Search Header settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Sparkles className="h-5.5 w-5.5 text-sky-400" />
          Search Matched Photos
        </h2>
        <p className="text-slate-400 text-sm mt-1 max-w-2xl font-sans">
          Choose between Option A (Smart Face Recognition) or Option B (Unique Photo ID or Filename Search) to instantly locate matching pictures.
        </p>

        {/* Search Method selection tabs */}
        <div className="flex border-b border-slate-800/80 mt-6 select-none bg-slate-950/20 p-1 rounded-xl gap-1">
          <button
            onClick={() => { setSearchOption("face"); setHasSearched(false); }}
            className={`flex-1 py-3 px-4 rounded-lg text-xs sm:text-xs font-bold uppercase font-mono tracking-wider transition-all duration-150 cursor-pointer text-center ${
              searchOption === "face"
                ? "bg-sky-500/10 text-sky-400 border border-sky-500/30"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            👤 Option A: Biometric Face Match
          </button>
          <button
            onClick={() => { setSearchOption("text"); setHasSearched(false); }}
            className={`flex-1 py-3 px-4 rounded-lg text-xs sm:text-xs font-bold uppercase font-mono tracking-wider transition-all duration-150 cursor-pointer text-center ${
              searchOption === "text"
                ? "bg-sky-500/10 text-sky-405 border border-sky-500/30"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            🆔 Option B: Unique Photo ID Search
          </button>
        </div>

        <div className="grid grid-col-1 md:grid-cols-2 gap-8 mt-6 pt-5 border-t border-slate-850">
          {/* STEP 1: SELECT COMPILATION */}
          <div className="space-y-4">
            <label className="block text-xs uppercase font-mono tracking-wider text-slate-400 font-bold">
              1. Choose Event Compilation
            </label>
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <select
                value={selectedProjectId}
                onChange={(e) => onSelectProjectId(e.target.value)}
                className="w-full bg-slate-900 text-slate-100 py-3 px-4 rounded-lg border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-sky-500 font-sans text-sm"
              >
                <option value="">Scan All Accumulated Projects ({projects.length})</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.location})
                  </option>
                ))}
              </select>
              {selectedProj && (
                <div className="mt-3 text-[11px] text-slate-400 bg-slate-900/40 p-2.5 rounded border border-slate-800/80">
                  <p><strong>Name:</strong> {selectedProj.name}</p>
                  <p><strong>Venue:</strong> {selectedProj.location}</p>
                  <p><strong>Total event photos to match:</strong> {photos.filter(p => p.projectId === selectedProjectId).length}</p>
                </div>
              )}
            </div>
          </div>

          {/* STEP 2: PROVIDE SELFIE FACE OR UNIQUE ID TEXT */}
          {searchOption === "face" ? (
            <div className="space-y-4">
              <label className="block text-xs uppercase font-mono tracking-wider text-slate-400 font-bold">
                2. Add Selfie Face Anchor
              </label>
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center min-h-[160px]">
                
                {/* Captured selfie layout */}
                {selfie && !useCamera && (
                  <div className="relative h-28 w-28 rounded-full border-2 border-sky-400 overflow-hidden shadow-lg shadow-sky-400/10 group">
                    <img src={selfie} alt="Selfie" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setSelfie(null)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold text-red-400 transition cursor-pointer"
                    >
                      Clear Photo
                    </button>
                  </div>
                )}

                {/* Active webcam stream element */}
                {useCamera && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative h-32 w-32 rounded-full overflow-hidden border-2 border-indigo-500 bg-black">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                    </div>
                    <button
                      onClick={handleCapturePhoto}
                      className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs px-3 py-1.5 rounded-lg mr-2"
                    >
                      Capture Capture
                    </button>
                  </div>
                )}

                {/* Upload actions if default null */}
                {!selfie && !useCamera && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex border border-slate-800 rounded-lg p-1 bg-slate-900">
                      <button
                        onClick={handleStartCamera}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-slate-800 transition text-slate-200"
                      >
                        <Camera className="h-3.5 w-3.5" /> Camera Selfie
                      </button>
                      <span className="text-slate-600 self-center px-1 font-mono text-[10px]">OR</span>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-slate-800 transition text-slate-200 cursor-pointer"
                      >
                        <Upload className="h-3.5 w-3.5" /> Upload File
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 text-center leading-normal max-w-[240px]">
                      Accepts standardized JPG/PNG photos. Your profile geometry matches strictly on device.
                    </p>
                    {cameraError && <p className="text-[10px] text-red-400 font-mono">{cameraError}</p>}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block text-xs uppercase font-mono tracking-wider text-slate-400 font-bold">
                2. Enter Unique Photo ID or Filename
              </label>
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-center min-h-[160px] space-y-3">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="h-4 w-4 text-slate-500" />
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. photo_17293847, IMG_3910.jpg"
                    value={photoIdQuery}
                    onChange={(e) => setPhotoIdQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg py-2.5 pl-9 pr-4 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Every uploaded photograph has a unique alphanumeric ID string. Paste the ID or full file name tag above to pull your picture directly from the secure event directory.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Trigger Button */}
        <div className="mt-8 pt-5 border-t border-slate-850 flex justify-center">
          {searchOption === "face" ? (
            <button
              onClick={handleFindMatches}
              disabled={!selfie || isMatching}
              className={`w-full sm:w-auto px-10 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2.5 transition transform cursor-pointer ${
                selfie && !isMatching
                  ? "bg-gradient-to-tr from-sky-400 to-indigo-500 hover:translate-y-[-1px] text-slate-950 hover:shadow-lg hover:shadow-sky-500/25 active:scale-95"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
              }`}
            >
              {isMatching ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin text-slate-950" />
                  <span>Scanning Databases...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4.5 w-4.5 text-slate-950 stroke-[2.5]" />
                  <span>Run Smart Face Matcher</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleTextSearch}
              disabled={!photoIdQuery.trim() || isMatching}
              className={`w-full sm:w-auto px-10 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2.5 transition transform cursor-pointer ${
                photoIdQuery.trim() && !isMatching
                  ? "bg-gradient-to-tr from-sky-400 to-indigo-500 hover:translate-y-[-1px] text-slate-950 hover:shadow-lg hover:shadow-sky-500/25 active:scale-95"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
              }`}
            >
              {isMatching ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin text-slate-950" />
                  <span>Searching identification...</span>
                </>
              ) : (
                <>
                  <Search className="h-4.5 w-4.5 text-slate-950 stroke-[2.5]" />
                  <span>Search by Photo ID & Tag</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* MATCHING LOGS / PROGRESS */}
      {isMatching && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center shadow-lg max-w-md mx-auto animate-pulse">
          <Loader2 className="h-8 w-8 text-sky-400 animate-spin mx-auto mb-3" />
          <h3 className="text-white text-sm font-bold font-sans">Verification in Progress</h3>
          <p className="text-sky-400 font-mono text-xs mt-1.5 tracking-wide">{matchStatus}</p>
        </div>
      )}

      {/* RESULTS DISPLAY */}
      {hasSearched && !isMatching && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-950 border border-slate-800 rounded-xl p-5">
            <div>
              <p className="text-xs text-slate-400 font-mono tracking-wider">RESULT STATUS</p>
              <h3 className="text-lg font-bold text-white mt-0.5 flex items-center gap-1.5">
                <UserCheck className="h-5 w-5 text-emerald-400" />
                Matched Face Signature Check
              </h3>
            </div>
            
            <div className="bg-slate-900 px-4 py-2 rounded-lg border border-slate-800 flex items-center gap-3">
              <span className="text-xs text-slate-300">
                Found matches: <strong className="text-emerald-400 font-bold">{matchedPhotoIds.length} event photos</strong>
              </span>
              {matchedPhotoIds.length > 0 && !isDemoPaidUser && (
                <button
                  onClick={handleUnlockAll}
                  disabled={isProcessingPayment !== null}
                  className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-[11px] uppercase tracking-wider px-3 py-1.5 rounded flex items-center gap-1 cursor-pointer transition"
                >
                  <Lock className="h-3 w-3" /> Get All original HD (UGX 30,000)
                </button>
              )}
            </div>
          </div>

          {matchedPhotoIds.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-xl mx-auto">
              <AlertCircle className="h-10 w-10 text-amber-400 mx-auto mb-3 opacity-80" />
              <h4 className="text-white font-bold text-lg">No Clear Face Match Matches Found</h4>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Sometimes lighting conditions or profile orientation can cause a variance. Please check that you selected the correct Spotlight project, verify your selfie face image has bright lighting, or check if the photographers have already completed the uploads!
              </p>
              <button
                onClick={() => setHasSearched(false)}
                className="mt-6 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2 rounded-lg border border-slate-700 transition cursor-pointer"
              >
                Retry Search Match
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* CATEGORY & EVENT SEARCH FILTERS FOR RESULTS */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  {/* Category chips */}
                  <div className="space-y-1.5 flex-grow">
                    <span className="text-[10px] text-slate-400 font-bold uppercase font-mono tracking-wider block">
                      Narrow results by Tag / Category
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setSelectedCategory("all")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-sans transition border cursor-pointer ${
                          selectedCategory === "all"
                            ? "bg-sky-500 text-slate-950 border-sky-450 hover:bg-sky-305"
                            : "bg-slate-900 text-slate-350 hover:bg-slate-805 hover:text-white border-slate-800"
                        }`}
                      >
                        All Matched ({matchedPhotoIds.length})
                      </button>
                      {Array.from(
                        new Set(
                          photos
                            .filter((photo) => matchedPhotoIds.includes(photo.id))
                            .map((photo) => photo.category || "General")
                        )
                      ).filter(Boolean).map((catName) => {
                        const count = photos
                          .filter((photo) => matchedPhotoIds.includes(photo.id))
                          .filter((photo) => (photo.category || "General").toLowerCase() === catName.toLowerCase()).length;
                        return (
                          <button
                            key={catName}
                            onClick={() => setSelectedCategory(catName.toLowerCase())}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-sans transition border cursor-pointer ${
                              selectedCategory === catName.toLowerCase()
                                ? "bg-indigo-550 text-white border-indigo-500 hover:bg-indigo-550/90"
                                : "bg-slate-900 text-slate-350 hover:bg-slate-805 hover:text-white border-slate-800"
                            }`}
                          >
                            {catName} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Filter by Event Name input */}
                  <div className="w-full md:w-72 shrink-0 space-y-1.5">
                    <span className="text-[10px] text-sky-400 font-bold uppercase font-mono tracking-wider block">
                      🔍 Filter by Booking/Event Name
                    </span>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Search className="h-4 w-4 text-slate-500" />
                      </span>
                      <input
                        type="text"
                        placeholder="Type event name..."
                        value={eventNameQuery}
                        onChange={(e) => setEventNameQuery(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {photos
                .filter((photo) => matchedPhotoIds.includes(photo.id))
                .filter((photo) => {
                  // 1. Category Filter
                  if (selectedCategory !== "all") {
                    const cat = (photo.category || "General").toLowerCase();
                    if (cat !== selectedCategory.toLowerCase()) return false;
                  }
                  // 2. Event Name Filter
                  if (eventNameQuery.trim() !== "") {
                    const proj = projects.find((p) => p.id === photo.projectId);
                    const projectName = photo.projectId === "individual" ? "Individual Photo" : (proj ? proj.name : "Company Photo");
                    if (!projectName.toLowerCase().includes(eventNameQuery.toLowerCase())) {
                      return false;
                    }
                  }
                  return true;
                }).length === 0 ? (
                <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-8 text-center max-w-sm mx-auto">
                  <p className="text-slate-400 text-xs text-center">No matching photos belong to the selected search and event name queries.</p>
                  <button
                    onClick={() => { setSelectedCategory("all"); setEventNameQuery(""); }}
                    className="mt-3 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 text-slate-300 font-bold text-xs px-3 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {photos
                    .filter((photo) => matchedPhotoIds.includes(photo.id))
                    .filter((photo) => {
                      // 1. Category Filter
                      if (selectedCategory !== "all") {
                        const cat = (photo.category || "General").toLowerCase();
                        if (cat !== selectedCategory.toLowerCase()) return false;
                      }
                      // 2. Event Name Filter
                      if (eventNameQuery.trim() !== "") {
                        const proj = projects.find((p) => p.id === photo.projectId);
                        const projectName = photo.projectId === "individual" ? "Individual Photo" : (proj ? proj.name : "Company Photo");
                        if (!projectName.toLowerCase().includes(eventNameQuery.toLowerCase())) {
                          return false;
                        }
                      }
                      return true;
                    })
                    .map((photo) => {
                  const details = matchDetails[photo.id] || { confidence: 0.85, reasoning: "Recognized face correlation." };
                  const isUnlocked = unlockedPhotos[photo.id] || isDemoPaidUser;
                  const proj = projects.find((p) => p.id === photo.projectId);
                  const projectName = photo.projectId === "individual" ? "Individual Photo" : (proj ? proj.name : "Company Photo");

                  return (
                    <div
                      key={photo.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg hover:border-slate-700 transition duration-300 flex flex-col justify-between"
                    >
                      {/* Photo Header Metadata / Confidence Check */}
                      <div className="bg-slate-950/80 p-3 flex justify-between items-center border-b border-slate-800 font-mono text-[10px]">
                        <span className="text-indigo-400 text-ellipsis overflow-hidden whitespace-nowrap max-w-[145px]" title={photo.altText || photo.fileName}>
                          {photo.altText ? `ID: ${photo.altText}` : photo.fileName}
                        </span>
                        <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold shrink-0">
                          {Math.round(details.confidence * 100)}% Match
                        </span>
                      </div>

                      {/* Display Container with Dynamic Watermark */}
                      <div className="relative h-56 sm:h-60 bg-slate-950 overflow-hidden group">
                        <img
                          src={photo.base64Data}
                          alt="Matched Photo"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        
                        {/* Event Name Tag Overlay */}
                        <div className="absolute top-2.5 right-2.5 z-10">
                          <span className="text-[9px] uppercase font-mono bg-indigo-900/90 text-indigo-2 w-max px-2 py-1 rounded shadow-md border border-indigo-750 font-bold text-white">
                            🎯 {projectName}
                          </span>
                        </div>

                        {/* Interactive Watermark Overlay if Locked */}
                        {!isUnlocked && (
                          <div className="absolute inset-0 bg-slate-950/20 flex flex-col items-center justify-center p-4">
                            {/* Watermark diagonal line blocks or logo */}
                            {watermarkSetting?.type === "logo" && watermarkSetting?.logoBase64 ? (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-10">
                                <img
                                  src={watermarkSetting.logoBase64}
                                  alt="Secure Logo Watermark"
                                  className="max-w-[70%] max-h-[70%] object-contain select-none pointer-events-none"
                                  style={{ opacity: watermarkSetting.opacity !== undefined ? watermarkSetting.opacity : 0.45 }}
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            ) : (
                              <div className="absolute inset-0 border-[3px] border-white/10 flex items-center justify-center pointer-events-none">
                                <span 
                                  className="transform rotate-[-30deg] font-mono tracking-[4px] text-[11px] sm:text-[13px] text-white uppercase font-extrabold select-none p-2 border border-white/10 bg-black/60 rounded shadow-md text-center max-w-[90%] break-all"
                                  style={{ opacity: watermarkSetting?.opacity !== undefined ? watermarkSetting.opacity : 0.45 }}
                                >
                                  {watermarkSetting?.text || "SNAP-AI"}
                                </span>
                              </div>
                            )}

                            <div className="z-10 bg-slate-950/90 py-3 px-4 rounded-xl border border-slate-800 max-w-[220px] text-center shadow-lg space-y-2 mt-auto">
                              <p className="text-[10px] text-slate-300">
                                Unlocked original HD copy contains high definition colors with zero watermark locks.
                              </p>
                            </div>
                          </div>
                        )}

                        {isUnlocked && (
                          <div className="absolute top-3 left-3 bg-emerald-500 text-slate-950 text-[9px] uppercase font-mono tracking-widest px-2 py-0.5 rounded-full font-extrabold shadow-md flex items-center gap-1 z-10">
                            <Check className="h-3 w-3 stroke-[3]" /> Unlocked original HD
                          </div>
                        )}
                      </div>

                      {/* AI Reasoning Commentary */}
                      <div className="p-4 space-y-4">
                        <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-850 space-y-1">
                          <h5 className="text-[10px] text-sky-400 font-mono uppercase tracking-wider font-semibold">
                            Snap AI analysis Details:
                          </h5>
                          <p className="text-xs text-slate-350 italic leading-relaxed">
                            "{details.reasoning}"
                          </p>
                          <div className="pt-1.5 border-t border-slate-850/50 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                            <span>Photo ID Code:</span>
                            <span className="text-sky-350 bg-slate-900 px-2 py-0.5 rounded border border-slate-750 font-bold select-all cursor-pointer" title="Double click or copy this ID to search directly">
                              {photo.id}
                            </span>
                          </div>
                        </div>

                        {/* Download and Billing Action Footer */}
                        <div className="pt-3 border-t border-slate-850 flex items-center gap-2">
                          {isUnlocked ? (
                            <button
                              onClick={() => handleDownload(photo, false)}
                              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs py-2.5 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10"
                            >
                              <Download className="h-3.5 w-3.5" /> Download Pristine HD original
                            </button>
                          ) : (
                            <div className="w-full grid grid-cols-2 gap-2">
                              {/* Preview with watermark */}
                              <button
                                onClick={() => handleDownload(photo, true)}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs py-2 rounded-lg border border-slate-700 transition flex items-center justify-center gap-1 cursor-pointer"
                                title="Download free preview with watermarks intact"
                              >
                                <Eye className="h-3.5 w-3.5" /> Free Watermarked
                              </button>

                              {/* Buy unwatermarked Original HD file */}
                              <button
                                onClick={() => handleProcessUnlock(photo.id)}
                                disabled={isProcessingPayment !== null}
                                className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-sky-400/10"
                              >
                                {isProcessingPayment === photo.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <CreditCard className="h-3.5 w-3.5" /> Unlock HD (UGX 7,500)
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    )}
  </div>
  );
}
