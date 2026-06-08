import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Enable larger payloads to accept high quality HD image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Helper to initialize Gemini SDK client with telemetry User-Agent
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * API route to match a selfie face image with candidate project photo images.
 * Uses Gemini's multi-modal understanding to analyze facial structures and verify matches.
 */
app.post("/api/match-face", async (req, res) => {
  try {
    const { selfieBase64, photos } = req.body;

    if (!selfieBase64) {
      return res.status(400).json({ error: "Selfie image is required." });
    }
    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ error: "A list of candidate photos is required." });
    }

    const ai = getGeminiClient();

    // Parse base64 string helper (removes dataurl prefix if present)
    const cleanBase64 = (base64Str: string) => {
      if (base64Str.startsWith("data:")) {
        const commaIdx = base64Str.indexOf(",");
        if (commaIdx !== -1) {
          return base64Str.substring(commaIdx + 1);
        }
      }
      return base64Str;
    };

    const getMimeType = (base64Str: string) => {
      if (base64Str.startsWith("data:")) {
        const match = base64Str.match(/data:([^;]+);/);
        if (match) return match[1];
      }
      return "image/jpeg";
    };

    const cleanSelfie = cleanBase64(selfieBase64);
    const selfieMime = getMimeType(selfieBase64);

    console.log(`Matching selfie against ${photos.length} photos...`);

    // We can compare up to 6 photos in a batch to avoid token/latency overhead and improve accuracy.
    // If there are more photos, we chunk them and run them in batches.
    const batchSize = 6;
    const matchedPhotoIds: string[] = [];
    const matchDetails: { [photoId: string]: { confidence: number; reasoning: string } } = {};

    for (let i = 0; i < photos.length; i += batchSize) {
      const chunk = photos.slice(i, i + batchSize);
      
      // Construct parts array for Gemini content request:
      // Part 1: Selfie image (as the main anchor face)
      const parts: any[] = [
        {
          inlineData: {
            mimeType: selfieMime,
            data: cleanSelfie,
          },
        },
        {
          text: `You are a high-fidelity face matching facial recognition expert.
Your job is to compare the Anchor Face (the selfie provided as the first image) against these ${chunk.length} candidate photos.
Determine which candidate photos contain the SAME person shown in the selfie. 
Be careful with lighting, background, poses, sunglasses, or clothing. Pay close attention to features like the nose bridge, eye shape, jawline, mouth structure, and cheekbones.

Analyze each Candidate Photo index (0 to ${chunk.length - 1}) and respond with a JSON array that tells us which candidates are a MATCH.
Provide a confidence value between 0.0 and 1.0 for each matched candidate, along with a brief explanation (reasoning) of why they match or don't match.

Reply in strict JSON format matching the schema requested:
{
  "matches": [0, 2],
  "confidence": [0.95, 0.85],
  "reasoning": "Candidate 0 shows the same cheekbones and nose structure standing near the cake. Candidate 2 shows the user sitting at the table."
}`,
        }
      ];

      // Add each candidate photo as a separate image part
      chunk.forEach((photo, idx) => {
        parts.push({
          text: `Candidate Photo index ${idx} (Photo ID: ${photo.id}):`
        });
        parts.push({
          inlineData: {
            mimeType: getMimeType(photo.base64Data),
            data: cleanBase64(photo.base64Data),
          }
        });
      });

      // Call Gemini 3.5-flash with JSON schema config
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matches: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: "Indices (from 0 to chunk size - 1) of matching candidate images."
              },
              confidence: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER },
                description: "Confidence scores matching the order in the 'matches' list."
              },
              reasoning: {
                type: Type.STRING,
                description: "Brief comparison reasoning."
              }
            },
            required: ["matches", "confidence", "reasoning"]
          }
        }
      });

      const responseText = response.text || "{}";
      const result = JSON.parse(responseText.trim());

      console.log(`Batch results for photos ${i} to ${i + chunk.length}:`, result);

      if (result && Array.isArray(result.matches)) {
        result.matches.forEach((matchedIdx: number, matchPtr: number) => {
          if (matchedIdx >= 0 && matchedIdx < chunk.length) {
            const matchedPhoto = chunk[matchedIdx];
            matchedPhotoIds.push(matchedPhoto.id);
            matchDetails[matchedPhoto.id] = {
              confidence: result.confidence?.[matchPtr] ?? 0.85,
              reasoning: result.reasoning || "Matched face signature matching structural metrics."
            };
          }
        });
      }
    }

    res.json({
      success: true,
      matchedPhotoIds,
      details: matchDetails,
    });
  } catch (error) {
    console.error("Error matching face:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal Face Matching Error"
    });
  }
});

// Setup Vite Dev server or production static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    // Use vite's middlewares to compile React assets on the fly
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Snap AI Service] Running at http://localhost:${PORT}`);
    console.log(`Port is hardlocked to 3000 for routing container gateway.`);
  });
}

startServer();
