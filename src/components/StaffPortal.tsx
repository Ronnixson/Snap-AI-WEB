import React, { useState, useRef } from "react";
import { Project, EventPhoto, UserProfile } from "../types";
import { collection, doc, setDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import { handleFirestoreError, OperationType } from "../utils/firebaseErrors";
import { Plus, Camera, Image as ImageIcon, Loader2, UploadCloud, CheckCircle, Calendar, MapPin, Trash2, AlertTriangle, Eye } from "lucide-react";

interface StaffPortalProps {
  projects: Project[];
  photos: EventPhoto[];
  currentProfile: UserProfile | null;
  onRefreshData: () => Promise<void>;
  onSelectProjectId: (projectId: string) => void;
}

export default function StaffPortal({
  projects,
  photos,
  currentProfile,
  onRefreshData,
  onSelectProjectId,
}: StaffPortalProps) {
  // Navigation
  const [activeTab, setActiveTab] = useState<"projects" | "upload">("projects");

  // Create Project states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newProjectDate, setNewProjectDate] = useState("");
  const [newProjectLoc, setNewProjectLoc] = useState("");
  const [newProjectCover, setNewProjectCover] = useState<string>("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Upload Photos states
  const [targetProjectId, setTargetProjectId] = useState("individual");
  const [uploadCategory, setUploadCategory] = useState("Individual");
  const [uploadQueue, setUploadQueue] = useState<{ name: string; base64: string; sizeKB: number; altText: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleSelectProject = (projectId: string) => {
    setTargetProjectId(projectId);
    const proj = projects.find((p) => p.id === projectId);
    if (proj) {
      setUploadCategory(proj.name);
    } else if (projectId === "individual") {
      setUploadCategory("Individual");
    } else {
      setUploadCategory("General");
    }
  };

  // Error/Success alerts
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Permission Check
  const hasStaffPermissions = currentProfile?.role === "staff" || currentProfile?.role === "admin";

  const clearAlerts = () => {
    setError(null);
    setSuccess(null);
  };

  // Client-side auto image compression (HD preserve)
  const compressAndLoadImage = (file: File, maxDim: number, callback: (base64: string, sizeKB: number) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Apply scaling constraints preserving aspect ratio
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.85); // 0.85 retains pristine HD detail
          const byteLength = compressedBase64.length;
          const sizeInKB = Math.round((byteLength * 3) / 4 / 1024); // approx KB
          callback(compressedBase64, sizeInKB);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Project Cover image load
  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      compressAndLoadImage(file, 800, (base64) => {
        setNewProjectCover(base64);
      });
    }
  };

  // Create Project handler
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName || !newProjectDate || !newProjectLoc) {
      setError("Please fill out all mandatory project details.");
      return;
    }

    setIsCreatingProject(true);
    clearAlerts();

    const projId = `project_${Date.now()}`;
    // Fallback default cover card if none uploaded
    const coverToUse = newProjectCover || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' fill='%230f172a' height='100'/></svg>";

    const newProject: Project = {
      id: projId,
      name: newProjectName,
      description: newProjectDesc,
      date: newProjectDate,
      location: newProjectLoc,
      coverUrl: coverToUse,
      creatorId: currentProfile?.id || "anonymous_photographer",
      createdAt: new Date().toISOString(),
    };

    try {
      const projRef = doc(db, "projects", projId);
      await setDoc(projRef, newProject);
      
      setSuccess(`Project Event "${newProjectName}" launched successfully!`);
      // Reset input fields
      setNewProjectName("");
      setNewProjectDesc("");
      setNewProjectDate("");
      setNewProjectLoc("");
      setNewProjectCover("");
      setShowCreateForm(false);
      
      await onRefreshData();
    } catch (err: any) {
      setError("Failed to create project: " + err.message);
      handleFirestoreError(err, OperationType.WRITE, `projects/${projId}`);
    } finally {
      setIsCreatingProject(false);
    }
  };

  // Batch Event Photos load into Queue
  const handlePhotosSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    clearAlerts();
    (Array.from(files) as File[]).forEach((file) => {
      // Auto compress to 1200px (HD details, perfectly fits under 1MB Firestore doc boundary)
      compressAndLoadImage(file, 1200, (base64, sizeKB) => {
        const lastDot = file.name.lastIndexOf('.');
        const cleanName = lastDot !== -1 ? file.name.substring(0, lastDot) : file.name;
        // Clean special symbols but keep dashes and spacing
        const defaultAltText = cleanName.replace(/[^a-zA-Z0-9_\-\s]/g, "");

        setUploadQueue((prev) => [
          ...prev,
          {
            name: file.name,
            base64,
            sizeKB,
            altText: defaultAltText,
          },
        ]);
      });
    });
  };

  const handleRemoveFromQueue = (index: number) => {
    setUploadQueue((prev) => prev.filter((_, i) => i !== index));
  };

  // Upload Batch photos to Database
  const handleUploadPhotos = async () => {
    const finalProjectId = targetProjectId || "individual";
    if (uploadQueue.length === 0) {
      setError("Upload queue is empty. Choose photo files first.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    clearAlerts();

    let uploadedCount = 0;
    try {
      const finalCategory = uploadCategory.trim() || (finalProjectId === "individual" ? "Individual" : "General");
      for (const item of uploadQueue) {
        // Use photographer-provided altText as the custom matching key
        const rawAlt = item.altText.trim();
        // Replace spaces with underscores to create a clean database key
        const cleanAltId = rawAlt ? rawAlt.replace(/\s+/g, "_") : "";
        
        // Use clean alt text ID as primary key, fallback if blank
        const photoId = cleanAltId || `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        
        const ref = doc(db, "photos", photoId);

        const photoObj: EventPhoto = {
          id: photoId,
          projectId: finalProjectId,
          base64Data: item.base64,
          fileName: item.name,
          uploaderId: currentProfile?.id || "anonymous_photographer",
          createdAt: new Date().toISOString(),
          category: finalCategory,
          isPreview: false, // Default is false so it is stored privately for face scan matching only
          altText: rawAlt || item.name,
        };

        await setDoc(ref, photoObj);
        uploadedCount++;
        setUploadProgress(Math.round((uploadedCount / uploadQueue.length) * 100));
      }

      setSuccess(`Successfully posted ${uploadedCount} HD photos. They are stored securely with Unique Alt Text IDs!`);
      setUploadQueue([]);
      await onRefreshData();
    } catch (err: any) {
      setError(`Batch upload halted after exporting ${uploadedCount} images. ${err.message}`);
      handleFirestoreError(err, OperationType.WRITE, "photos");
    } finally {
      setIsUploading(false);
    }
  };

  // Unauthorised Guard
  if (!hasStaffPermissions) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center max-w-xl mx-auto my-6 shadow-2xl">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4 opacity-85" />
        <h3 className="text-xl font-bold text-white font-sans">Photographer Permission Required</h3>
        <p className="text-slate-400 text-sm mt-2 leading-relaxed">
          The **Staff Portal** contains private professional uploader features. Click on raw role **"Staff"** or **"Admin"** inside the demo simulation panel above to immediately unlock these photographer systems!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl my-6">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Camera className="h-6 w-6 text-sky-400" />
            Spotlight Staff Workspace
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Registered Photographer: <strong className="text-white">{currentProfile?.name}</strong> • Level: <strong className="text-sky-400 uppercase font-mono">{currentProfile?.role}</strong>
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveTab("projects"); clearAlerts(); }}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition border cursor-pointer ${
              activeTab === "projects"
                ? "bg-sky-500/20 text-sky-400 border-sky-500/30"
                : "bg-slate-950/40 text-slate-400 border-slate-800 hover:text-white"
            }`}
          >
            Manage Events
          </button>
          <button
            onClick={() => { setActiveTab("upload"); clearAlerts(); }}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition border cursor-pointer ${
              activeTab === "upload"
                ? "bg-indigo-500/25 text-indigo-400 border-indigo-500/30"
                : "bg-slate-950/40 text-slate-400 border-slate-800 hover:text-white"
            }`}
          >
            Upload Event Photos
          </button>
        </div>
      </div>

      {/* ALERT CODES */}
      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-lg text-xs font-sans flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-4 py-3 rounded-lg text-xs font-sans flex items-start gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* TAB A: PROJECTS / EVENTS MANAGEMENT */}
      {activeTab === "projects" && (
        <div className="mt-6 space-y-6">
          <div className="flex justify-between items-center bg-slate-950/50 p-4 rounded-xl border border-slate-850">
            <span className="text-xs text-slate-400">Add an accomplished event folder that was captured by you.</span>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-sky-500/10"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" /> Launch New Booking Event
            </button>
          </div>

          {/* PROJECT CREATE FORM */}
          {showCreateForm && (
            <form onSubmit={handleCreateProject} className="bg-slate-950/40 border border-slate-850 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Configure New Spotlight Event</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium font-sans">Project / Event Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Oakridge Corporate Gala"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-850 px-3 py-2 text-xs rounded-lg text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium font-sans">Date of Event *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. October 12, 2026"
                    value={newProjectDate}
                    onChange={(e) => setNewProjectDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-850 px-3 py-2 text-xs rounded-lg text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium font-sans">Location Venue *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Grand Plaza Ballroom, NY"
                    value={newProjectLoc}
                    onChange={(e) => setNewProjectLoc(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-850 px-3 py-2 text-xs rounded-lg text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold font-sans">Cover Photo Thumbnail *</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-750 px-3 py-2 rounded-lg text-xs text-slate-300 font-medium transition cursor-pointer shrink-0"
                    >
                      Choose File
                    </button>
                    {newProjectCover ? (
                      <span className="text-[10px] text-emerald-400 font-mono self-center">Cover Attached!</span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-mono self-center">No cover uploaded (defaults to placeholder)</span>
                    )}
                  </div>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium font-sans">Brief Description</label>
                <textarea
                  placeholder="Tell clients about the event environment or standard settings..."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-850 px-3 py-2 text-xs rounded-lg text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <button
                type="submit"
                disabled={isCreatingProject}
                className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-6 py-2.5 rounded-lg mr-2"
              >
                {isCreatingProject ? (
                  <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Launching...</span>
                ) : (
                  "Create Event Project"
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="bg-transparent text-slate-400 hover:text-white text-xs px-4 py-2"
              >
                Cancel
              </button>
            </form>
          )}

          {/* PROJECT LISTINGS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((proj) => {
              const projectPhotosCount = photos.filter(p => p.projectId === proj.id).length;
              return (
                <div
                  key={proj.id}
                  className="bg-slate-950/60 p-4 rounded-xl border border-slate-850/80 flex gap-4 hover:border-slate-750 transition"
                >
                  <img
                    src={proj.coverUrl || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' fill='%230f172a' height='100'/></svg>"}
                    alt={proj.name}
                    className="w-16 h-16 rounded-lg object-cover bg-slate-900"
                  />
                  <div className="flex flex-col justify-between overflow-hidden">
                    <div>
                      <h4 className="text-white font-bold text-sm text-ellipsis overflow-hidden whitespace-nowrap">{proj.name}</h4>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-2.5 w-2.5" /> {proj.location}
                      </p>
                    </div>
                    <div className="flex gap-3 mt-2 text-[10px] font-mono">
                      <span className="text-slate-300">Photos: <strong className="text-sky-400">{projectPhotosCount} matches</strong></span>
                      <button
                        onClick={() => { setTargetProjectId(proj.id); setActiveTab("upload"); clearAlerts(); }}
                        className="text-sky-400 font-bold hover:underline cursor-pointer"
                      >
                        Add + Upload
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB B: UPLOAD EVENT PHOTOS */}
      {activeTab === "upload" && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Target project folder selection */}
            <div className="md:col-span-1 space-y-4">
              <div className="bg-slate-950 border border-slate-850 rounded-xl p-4">
                <label className="block text-xs uppercase font-mono tracking-wider text-slate-400 font-bold mb-2">
                  1. Target Event Compilation (Optional)
                </label>
                <select
                  value={targetProjectId}
                  onChange={(e) => handleSelectProject(e.target.value)}
                  className="w-full bg-slate-900 text-slate-200 border border-slate-750 px-3 py-2 text-xs rounded-lg focus:outline-none"
                >
                  <option value="individual">-- No Event (Individual Photo/Private) --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {targetProjectId && (
                  <p className="text-[10px] text-slate-400 font-mono mt-2">
                    {targetProjectId === "individual" ? (
                      <span>Current private individual uploads: <strong className="text-amber-400">{photos.filter(p => p.projectId === "individual").length} photos</strong></span>
                    ) : (
                      <span>Current images uploaded to project: <strong className="text-sky-400">{photos.filter(p => p.projectId === targetProjectId).length} photos</strong></span>
                    )}
                  </p>
                )}

                {/* Smooth Photo Categorization Input */}
                <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                  <label className="block text-xs uppercase font-mono tracking-wider text-slate-400 font-bold">
                    2. Upload Category *
                  </label>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Defaults to the event name so the system can filter smoothly.
                  </p>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ceremony, Candid, or VIP Portraits"
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full bg-slate-900 text-slate-200 border border-slate-750 px-3 py-2 text-xs rounded-lg focus:outline-none placeholder-slate-600 focus:border-sky-500"
                  />
                  {targetProjectId && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {["Ceremony", "Candid", "VIP Portraits", "Stage shots", "Reception"].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setUploadCategory(cat)}
                          className="text-[9px] bg-slate-905 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 px-2 py-0.5 rounded-md transition cursor-pointer font-mono"
                        >
                          {cat}
                        </button>
                      ))}
                      {/* Button to quickly reset to project name */}
                      <button
                        type="button"
                        onClick={() => {
                          const proj = projects.find(p => p.id === targetProjectId);
                          if (proj) setUploadCategory(proj.name);
                        }}
                        className="text-[9px] bg-sky-500/10 border border-sky-500/20 text-sky-450 hover:bg-sky-500/20 px-2 py-0.5 rounded-md transition cursor-pointer font-mono font-medium"
                      >
                        Reset to Event Name
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Drag Drop Area / Queue input */}
            <div className="md:col-span-2 space-y-4">
              <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 flex flex-col items-center justify-center min-h-[140px] text-center">
                <UploadCloud className="h-10 w-10 text-indigo-400 mb-2 opacity-80" />
                <h4 className="text-sm font-bold text-white mb-1">Batch Upload HD Event Photos</h4>
                <p className="text-[10px] text-slate-400 max-w-[320px] mb-3 leading-normal">
                  Select multiple photo files. Our tool automatically processes and maps details, resizing files perfectly to fit HD structures without losing detail.
                </p>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs px-4 py-2 rounded-lg transition"
                >
                  Select Photos from Device
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotosSelected}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* QUEUE DISPLAY */}
          {uploadQueue.length > 0 && (
            <div className="bg-slate-950 rounded-xl border border-slate-850 p-4 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold font-mono text-white block">Pending Upload Queue ({uploadQueue.length})</span>
                  <p className="text-[10px] text-slate-500">Configure Alt Text fields below. They will serve as the exact Unique Search IDs.</p>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Estimated size: ~{Math.round(uploadQueue.reduce((acc, curr) => acc + curr.sizeKB, 0))} KB</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[300px] overflow-y-auto pr-1">
                {uploadQueue.map((item, index) => (
                  <div key={index} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex gap-3 items-center relative">
                    <div className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-slate-950 border border-slate-800">
                      <img src={item.base64} alt="Thumbnail preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveFromQueue(index)}
                        className="absolute inset-0 bg-black/75 opacity-0 hover:opacity-100 flex items-center justify-center text-red-400 transition cursor-pointer"
                        title="Remove photo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="flex-1 space-y-2 overflow-hidden">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] text-slate-500 truncate font-mono max-w-[120px]">{item.name}</span>
                        <span className="text-[8px] bg-slate-950 px-1 py-0.5 rounded text-slate-400 font-mono">{item.sizeKB}KB</span>
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[8px] uppercase font-mono tracking-wider text-slate-400 font-extrabold block">
                          Alt Text (Search Unique ID) *
                        </label>
                        <input
                          type="text"
                          value={item.altText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setUploadQueue(prev => prev.map((q, i) => i === index ? { ...q, altText: val } : q));
                          }}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-indigo-400 focus:outline-none focus:border-indigo-500 font-mono"
                          placeholder="e.g. bride_dance_01"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Upload trigger with progress bar */}
              <div className="pt-3 border-t border-slate-850 flex items-center justify-between gap-4 flex-wrap">
                <span className="text-[10px] text-slate-400 block max-w-sm">
                  Photos are compressed to ~200KB. Click "Publish Batch" to write them into Secure Cloud Firestore documents immediately.
                </span>

                <div className="flex gap-2">
                  <button
                    onClick={() => setUploadQueue([])}
                    className="bg-transparent text-slate-400 hover:text-white text-xs px-4 py-2"
                  >
                    Clear All
                  </button>

                  <button
                    onClick={handleUploadPhotos}
                    disabled={isUploading || !targetProjectId}
                    className={`px-6 py-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      targetProjectId
                        ? "bg-indigo-500 hover:bg-indigo-400 text-white cursor-pointer"
                        : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-750"
                    }`}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Publishing ({uploadProgress}%)</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-3.5 w-3.5" />
                        <span>Publish Batch to Event</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
