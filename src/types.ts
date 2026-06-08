/**
 * Type declarations for Snap AI
 */

export type UserRole = "client" | "staff" | "admin";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  date: string;
  location: string;
  coverUrl: string;
  creatorId: string;
  createdAt: string;
}

export interface EventPhoto {
  id: string;
  projectId: string;
  base64Data: string; // HD Base64 photo
  fileName: string;
  uploaderId: string;
  createdAt: string;
  category?: string; // Event Name or Custom category
  isPreview?: boolean; // Set by administrator to allow public previewing
}

export interface MatchResponse {
  matches: number[];
  confidence: number[];
  reasoning: string;
}

export interface SystemSetting {
  id: string; // "watermark"
  text: string; // Default: SNAP-AI
  type: "text" | "logo"; // "text" or "logo" overlay
  logoBase64?: string; // High quality custom base64-encoded logo image
  opacity: number; // e.g. 0.35, 0.50
  updatedAt: string;
}
