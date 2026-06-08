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
}

export interface MatchResponse {
  matches: number[];
  confidence: number[];
  reasoning: string;
}
