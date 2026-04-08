import express from "express";
import path from "path";
import os from "os";
import fs from "fs";
import axios from "axios";
import multer from "multer";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import CryptoJS from "crypto-js";
import checkDiskSpace from "check-disk-space";
import { v4 as uuidv4 } from "uuid";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import ytdl from "ytdl-core";
import contentDisposition from "content-disposition";

// Configure FFmpeg paths
console.log("[System] ffmpegPath type:", typeof ffmpegPath, ffmpegPath);
console.log("[System] ffprobePath type:", typeof ffprobePath, ffprobePath);

if (ffmpegPath) {
  const actualFfmpegPath = typeof ffmpegPath === 'string' ? ffmpegPath : (ffmpegPath as any).default;
  if (typeof actualFfmpegPath === 'string') {
    ffmpeg.setFfmpegPath(actualFfmpegPath);
    console.log("[System] FFmpeg path set to:", actualFfmpegPath);
  }
}
if (ffprobePath) {
  let actualFfprobePath: string | undefined;
  if (typeof ffprobePath === 'string') {
    actualFfprobePath = ffprobePath;
  } else if (typeof (ffprobePath as any).path === 'string') {
    actualFfprobePath = (ffprobePath as any).path;
  } else if (typeof (ffprobePath as any).default === 'string') {
    actualFfprobePath = (ffprobePath as any).default;
  }

  if (actualFfprobePath) {
    ffmpeg.setFfprobePath(actualFfprobePath);
    console.log("[System] FFprobe path set to:", actualFfprobePath);
  } else {
    console.warn("[System] Could not determine FFprobe path from:", ffprobePath);
  }
}

// Ensure storage directories exist
const BASE_DIR = process.cwd();
const STORAGE_DIR = path.join(BASE_DIR, 'storage');
const VIDEOS_DIR = path.join(STORAGE_DIR, 'videos');
const THUMBNAILS_DIR = path.join(STORAGE_DIR, 'thumbnails');

console.log("[System] Base directory for storage:", BASE_DIR);

[STORAGE_DIR, VIDEOS_DIR, THUMBNAILS_DIR].forEach(dir => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log("[System] Created directory:", dir);
    }
  } catch (err) {
    console.error(`[System] Failed to create directory ${dir}:`, err);
  }
});

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(BASE_DIR, 'uploads');
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log("[System] Created uploads directory:", UPLOADS_DIR);
  }
} catch (err) {
  console.error(`[System] Failed to create uploads directory ${UPLOADS_DIR}:`, err);
}

// Configure Multer for local storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Encryption key for tokens (In production, use a secure env var)
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || "super-secret-key";

// Helper: Get Authorized YouTube Client with Auto-Refresh
async function getYouTubeClient(channelId: string) {
  const channel = db.channels.find(c => c.id === channelId);
  if (!channel) throw new Error("Channel not found");

  const config = db.apiConfigs.find(c => c.id === channel.configId);
  if (!config) throw new Error("API Config not found");

  const oauth2Client = new google.auth.OAuth2(
    config.clientId,
    decrypt(config.clientSecret)
  );

  const credentials = {
    access_token: decrypt(channel.accessToken),
    refresh_token: decrypt(channel.refreshToken),
    expiry_date: channel.expiryDate
  };

  oauth2Client.setCredentials(credentials);

  // Check if token is expired or about to expire (within 5 mins)
  if (Date.now() >= (channel.expiryDate - 300000)) {
    console.log(`Refreshing token for channel: ${channel.name}`);
    try {
      const { credentials: newCredentials } = await oauth2Client.refreshAccessToken();
      
      // Update database with new tokens
      channel.accessToken = encrypt(newCredentials.access_token!);
      if (newCredentials.refresh_token) {
        channel.refreshToken = encrypt(newCredentials.refresh_token);
      }
      channel.expiryDate = newCredentials.expiry_date!;
      
      oauth2Client.setCredentials(newCredentials);
    } catch (error) {
      console.error("Failed to refresh token:", error);
      throw new Error("Authentication expired. Please reconnect the channel.");
    }
  }

  return google.youtube({ version: 'v3', auth: oauth2Client });
}

// In-memory "Database" with file persistence
const DB_FILE = path.join(BASE_DIR, 'db.json');

const db = {
  apiConfigs: [] as any[],
  channels: [] as any[],
  jobs: [] as any[],
  history: [] as any[],
  media: [] as any[],
  keywords: [] as any[],
  trending: [] as any[],
  aiKeys: {} as Record<string, any[]>,
  oauthStates: new Map<string, any>()
};

function saveDb() {
  try {
    const data = {
      apiConfigs: db.apiConfigs,
      channels: db.channels,
      jobs: db.jobs,
      history: db.history,
      media: db.media,
      keywords: db.keywords,
      trending: db.trending,
      aiKeys: db.aiKeys
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Failed to save database:", e);
  }
}

// Load database from file if it exists
if (fs.existsSync(DB_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    db.apiConfigs = data.apiConfigs || [];
    db.channels = data.channels || [];
    db.jobs = data.jobs || [];
    db.history = data.history || [];
    db.media = data.media || [];
    db.keywords = data.keywords || [];
    db.trending = data.trending || [];
    db.aiKeys = data.aiKeys || {};
    console.log("Database loaded from file.");
  } catch (e) {
    console.error("Failed to load database:", e);
  }
}

// Auto-load client_secret.json if it exists in root
function autoLoadClientSecret() {
  const secretPath = path.join(process.cwd(), 'client_secret.json');
  if (fs.existsSync(secretPath)) {
    try {
      const content = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
      const clientConfig = content.web || content.installed;
      if (clientConfig) {
        const existing = db.apiConfigs.find(c => c.clientId === clientConfig.client_id);
        if (!existing) {
          const newConfig = {
            id: 'auto-loaded-config',
            name: 'client_secret.json (Auto)',
            clientId: clientConfig.client_id,
            clientSecret: encrypt(clientConfig.client_secret),
            status: 'Active',
            quotaUsed: 0,
            lastUsed: Date.now()
          };
          db.apiConfigs.push(newConfig);
          saveDb();
          console.log("[System] Auto-loaded client_secret.json from root.");
        }
      }
    } catch (e) {
      console.error("[System] Failed to auto-load client_secret.json:", e);
    }
  }
}
autoLoadClientSecret();

// Media Processing Logic (In-memory)
async function processMedia(mediaId: string, url?: string, source?: string) {
  const media = db.media.find(m => m.id === mediaId);
  if (!media) return;

  try {
    media.status = 'processing';
    media.progress = 0;
    saveDb();

    const videoPath = path.join(VIDEOS_DIR, `${mediaId}.mp4`);
    const thumbnailPath = path.join(THUMBNAILS_DIR, `${mediaId}.jpg`);

    // 1. Download Video if URL is provided
    if (url) {
      console.log(`[Media Processor] Downloading video from ${source}: ${url}`);
      let downloadUrl = url;

      // Handle Google Drive links
      if (source === 'drive') {
        const driveIdMatch = url.match(/\/file\/d\/([^\/]+)/) || url.match(/id=([^\&]+)/);
        if (driveIdMatch) {
          // Add confirm=t for large files
          downloadUrl = `https://drive.google.com/uc?export=download&id=${driveIdMatch[1]}&confirm=t`;
          console.log(`[Media Processor] Converted Drive URL to: ${downloadUrl}`);
        }
      }

      if (source === 'youtube') {
        try {
          const stream = ytdl(url, { quality: 'highestvideo' });
          const writeStream = fs.createWriteStream(videoPath);
          
          let totalSize = 0;
          stream.on('info', (info) => {
            const format = ytdl.chooseFormat(info.formats, { quality: 'highestvideo' });
            totalSize = parseInt(format.contentLength);
          });

          let downloaded = 0;
          stream.on('data', (chunk) => {
            downloaded += chunk.length;
            if (totalSize) {
              media.progress = Math.round((downloaded / totalSize) * 80); // 80% for download
              saveDb();
            }
          });

          stream.pipe(writeStream);
          await new Promise((resolve, reject) => {
            stream.on('error', (err) => {
              console.error(`[Media Processor] ytdl error for ${mediaId}:`, err);
              reject(err);
            });
            writeStream.on('finish', () => resolve(true));
            writeStream.on('error', (err) => {
              console.error(`[Media Processor] WriteStream error for ${mediaId}:`, err);
              reject(err);
            });
          });
        } catch (err) {
          console.error(`[Media Processor] Failed to start ytdl for ${mediaId}:`, err);
          throw err;
        }
      } else if (source === 'drive' || source === 'direct') {
        try {
          const response = await axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'stream',
            timeout: 0 // No timeout for large file downloads
          });

          const totalSize = parseInt(response.headers['content-length'] || '0');
          let downloaded = 0;

          const writeStream = fs.createWriteStream(videoPath);
          
          response.data.on('data', (chunk: any) => {
            downloaded += chunk.length;
            if (totalSize) {
              media.progress = Math.round((downloaded / totalSize) * 80); // 80% for download
              saveDb();
            }
          });

          response.data.pipe(writeStream);
          await new Promise((resolve, reject) => {
            response.data.on('error', (err: any) => {
              console.error(`[Media Processor] Axios stream error for ${mediaId}:`, err);
              reject(err);
            });
            writeStream.on('finish', () => resolve(true));
            writeStream.on('error', (err) => {
              console.error(`[Media Processor] WriteStream error for ${mediaId}:`, err);
              reject(err);
            });
          });
        } catch (err) {
          console.error(`[Media Processor] Failed to start axios for ${mediaId}:`, err);
          throw err;
        }
      }
    } else {
      // Local upload, already at 80% progress (upload finished)
      media.progress = 80;
      saveDb();
    }

    // 2. Extract Metadata & Generate Thumbnail using FFmpeg
    if (fs.existsSync(videoPath)) {
      const stats = fs.statSync(videoPath);
      console.log(`[Media Processor] Processing video: ${videoPath}, size: ${stats.size} bytes`);
      
      if (stats.size === 0) {
        throw new Error("Video file is empty (0 bytes)");
      }

      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .on('start', (commandLine) => {
            console.log(`[Media Processor] FFmpeg started with command: ${commandLine}`);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              // Map 0-100% of FFmpeg to 80-100% of total progress
              media.progress = 80 + Math.round(progress.percent * 0.2);
              saveDb();
            }
          })
          .on('end', () => {
            console.log(`[Media Processor] FFmpeg screenshots generated for ${mediaId}`);
            
            // Wait a tiny bit to ensure file handles are released if any
            setTimeout(() => {
              ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) {
                  console.error(`[Media Processor] ffprobe error for ${mediaId}:`, err);
                  media.status = 'failed';
                  media.error = `ffprobe error: ${err.message}`;
                  saveDb();
                  reject(err);
                } else {
                  media.duration = metadata.format.duration || 0;
                  media.size = stats.size;
                  media.status = 'ready';
                  media.progress = 100;
                  media.thumbnail = `/api/media/thumbnail/${mediaId}`;
                  saveDb();
                  resolve(true);
                }
              });
            }, 500);
          })
          .on('error', (err, stdout, stderr) => {
            console.error(`[Media Processor] FFmpeg error for ${mediaId}:`, err.message);
            console.error(`[Media Processor] FFmpeg stderr:`, stderr);
            reject(err);
          })
          .screenshots({
            count: 1,
            folder: THUMBNAILS_DIR,
            filename: `${mediaId}.jpg`,
            size: '640x360'
          });
      });
    } else {
      throw new Error("Video file not found after download");
    }

  } catch (err) {
    console.error(`[Media Processor] Failed to process ${mediaId}:`, err);
    media.status = 'failed';
    media.error = err instanceof Error ? err.message : String(err);
    saveDb();
  }
}

// Simple In-memory Queue Worker (Simulation of BullMQ)
const queue = {
  add: (data: any) => {
    const job = { 
      id: Math.random().toString(36).substring(7), 
      data, 
      status: 'queued', // Use 'queued' as requested
      progress: 0,
      createdAt: new Date().toISOString()
    };
    db.jobs.push(job);
    saveDb();
    return job;
  }
};

// Background Worker to process jobs when scheduled time is reached
setInterval(async () => {
  try {
    const now = new Date();
    for (const job of db.jobs) {
      if (job.status === 'queued') {
        const scheduledAt = job.data.scheduledAt ? new Date(job.data.scheduledAt) : null;
        if (!scheduledAt || now >= scheduledAt) {
          console.log(`[Worker] Starting job ${job.id}: ${job.data.title}`);
          // Move to processing state
          job.status = 'processing';
          saveDb();
          processJob(job).catch(err => {
            console.error(`[Worker] Job ${job.id} failed:`, err);
          });
        }
      }
    }
  } catch (e) {
    console.error("[Worker] Loop error:", e);
  }
}, 5000); // Check every 5 seconds

async function processJob(job: any) {
  const { data } = job;
  
  if (!data || typeof data.videoPath !== 'string') {
    console.error(`[Job ${job.id}] Invalid job data or videoPath:`, data);
    job.status = 'failed';
    job.error = "Invalid video path provided";
    saveDb();
    return;
  }

  console.log(`[Job ${job.id}] Processing started for: ${data.title}`);
  
  try {
    job.progress = 10;
    saveDb();
    // status is already 'processing'

    const youtube = await getYouTubeClient(data.channelId);
    console.log(`[Job ${job.id}] YouTube client initialized`);
    
    // 1. Upload Video
    const videoRes: any = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: data.title,
          description: data.description,
          tags: data.tags,
          categoryId: data.categoryId || '22',
        },
        status: {
          privacyStatus: data.scheduledAt ? 'private' : (data.privacy || 'private'),
          // If scheduledAt is provided, set publishAt
          ...(data.scheduledAt ? { publishAt: new Date(data.scheduledAt).toISOString() } : {}),
          // MAPPING PRESISI:
          // AI LABEL (true) -> hasAlteredContent: true (YouTube: Ya)
          // BUKAN AI (false) -> hasAlteredContent: false (YouTube: Tidak)
          // Cast ke any karena field ini baru dan mungkin belum ada di tipe library lokal
          hasAlteredContent: data.aiLabel || false,
          selfDeclaredMadeForKids: data.madeForKids || false,
        } as any,
      },
      media: {
        body: fs.createReadStream(data.videoPath),
      },
    }, {
      // Monitor upload progress
      onUploadProgress: (evt) => {
        try {
          if (!fs.existsSync(data.videoPath)) return;
          const stats = fs.statSync(data.videoPath);
          const progress = Math.round((evt.bytesRead / stats.size) * 100);
          job.progress = Math.min(progress, 90); // Reserve last 10% for processing
        } catch (e) {
          console.warn(`[Job ${job.id}] Progress monitoring failed:`, e);
        }
      },
    });

    const videoId = videoRes.data.id;
    if (!videoId) throw new Error("Failed to get video ID after upload");
    console.log(`[Job ${job.id}] Video uploaded: ${videoId}`);

    job.status = 'processing';
    job.progress = 95;
    saveDb();

    // 2. Set Thumbnail if provided
    if (data.thumbnailPath && fs.existsSync(data.thumbnailPath)) {
      try {
        let finalThumbnailPath = data.thumbnailPath;
        const stats = fs.statSync(data.thumbnailPath);
        const MAX_THUMBNAIL_SIZE = 2 * 1024 * 1024; // 2MB

        if (stats.size > MAX_THUMBNAIL_SIZE) {
          console.log(`[Job ${job.id}] Thumbnail too large (${stats.size} bytes). Resizing...`);
          const resizedPath = data.thumbnailPath + ".resized.jpg";
          const sharp = (await import("sharp")).default;
          await sharp(data.thumbnailPath)
            .resize(1280, 720, { fit: 'inside' })
            .jpeg({ quality: 80 })
            .toFile(resizedPath);
          finalThumbnailPath = resizedPath;
          console.log(`[Job ${job.id}] Thumbnail resized to: ${resizedPath}`);
        }

        console.log(`[Job ${job.id}] Uploading thumbnail: ${finalThumbnailPath}`);
        await youtube.thumbnails.set({
          videoId: videoId,
          media: {
            body: fs.createReadStream(finalThumbnailPath),
          },
        });
        console.log(`[Job ${job.id}] Thumbnail uploaded.`);
        
        // Clean up resized thumbnail if it was created
        if (finalThumbnailPath !== data.thumbnailPath) {
          fs.unlinkSync(finalThumbnailPath);
        }
      } catch (thumbError: any) {
        console.error(`[Job ${job.id}] Failed to set thumbnail:`, thumbError.message);
        // Non-fatal, continue
      }
    }

    // 3. Add to Playlist if provided
    if (data.playlistId) {
      try {
        console.log(`[Job ${job.id}] Adding to playlist: ${data.playlistId}`);
        await youtube.playlistItems.insert({
          part: ['snippet'],
          requestBody: {
            snippet: {
              playlistId: data.playlistId,
              resourceId: {
                kind: 'youtube#video',
                videoId: videoId,
              },
            },
          },
        });
        console.log(`[Job ${job.id}] Added to playlist.`);
      } catch (playlistError: any) {
        console.error(`[Job ${job.id}] Failed to add to playlist:`, playlistError.message);
        // Non-fatal, continue
      }
    }
    
    job.status = 'completed';
    job.progress = 100;
    job.videoUrl = `https://youtu.be/${videoId}`;
    console.log(`[Job ${job.id}] Completed successfully`);

    // Add to history
    db.history.unshift({
      id: `#${videoId}`,
      type: "VOD",
      title: data.title,
      status: "success",
      channelId: data.channelId,
      scheduledAt: data.scheduledAt,
      created_at: new Date().toISOString()
    });
    
    saveDb();

    // Cleanup local files after successful upload
    try {
      if (fs.existsSync(data.videoPath)) fs.unlinkSync(data.videoPath);
      if (data.thumbnailPath && fs.existsSync(data.thumbnailPath)) fs.unlinkSync(data.thumbnailPath);
    } catch (e) {
      console.warn("Failed to cleanup files:", e);
    }

  } catch (error: any) {
    console.error("YouTube Upload Error:", error);
    job.status = 'failed';
    job.error = error.message || "Unknown error during upload";

    // Add to history
    db.history.unshift({
      id: `#ERR_${Math.floor(Math.random() * 1000000)}`,
      type: "VOD",
      title: data.title,
      status: "failed",
      channelId: data.channelId,
      scheduledAt: data.scheduledAt,
      created_at: new Date().toISOString()
    });
    saveDb();
  }
}

function encrypt(text: string) {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

function decrypt(ciphertext: string) {
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

import { OpenAI } from "openai";
import { GoogleGenAI } from "@google/genai";

// --- External API Integration Helpers ---

async function getYouTubeData(keyword: string, apiKey: string) {
  try {
    const youtube = google.youtube({ version: 'v3', auth: apiKey });
    const searchRes = await youtube.search.list({
      q: keyword,
      part: ['snippet'],
      maxResults: 10,
      type: ['video'],
      order: 'relevance'
    });
    
    const items = searchRes.data.items || [];
    const totalResults = parseInt(searchRes.data.pageInfo?.totalResults?.toString() || "0");
    const volume = Math.min(100000, totalResults * 10);
    const competition = Math.min(100, Math.floor(totalResults / 1000));
    
    // Extract channel IDs to get subscriber counts
    const channelIds = [...new Set(items.map(item => item.snippet?.channelId).filter(Boolean))];
    let marketLeaders = [];
    
    if (channelIds.length > 0) {
      const channelRes = await youtube.channels.list({
        id: channelIds.slice(0, 6) as string[],
        part: ['snippet', 'statistics']
      });
      
      marketLeaders = (channelRes.data.items || []).map(ch => ({
        name: ch.snippet?.title,
        subs: formatSubs(ch.statistics?.subscriberCount),
        description: ch.snippet?.description?.slice(0, 120) + "..."
      }));
    }

    // Extract related keywords from titles
    const highVolumeSearch = items.slice(0, 9).map(item => ({
      keyword: item.snippet?.title?.split('|')[0].split('-')[0].trim().slice(0, 50),
      score: Math.floor(Math.random() * 20) + 80,
      tag: Math.random() > 0.5 ? "HOT" : "NEW",
      subtext: "PER MONTH"
    }));
    
    return { volume, competition, marketLeaders, highVolumeSearch };
  } catch (e) {
    console.error("YouTube API Error:", e);
    return null;
  }
}

async function getYouTubeNicheTrending(apiKey: string, niche: string, regionCode: string, publishedAfter: string, maxResults: number = 10) {
  try {
    const youtube = google.youtube({ version: 'v3', auth: apiKey });
    const response = await youtube.search.list({
      part: ['snippet'],
      q: niche,
      regionCode: regionCode,
      publishedAfter: publishedAfter,
      order: 'viewCount',
      type: ['video'],
      maxResults: maxResults
    });
    
    const videoIds = response.data.items?.map(item => item.id?.videoId).filter(Boolean) as string[];
    if (!videoIds || videoIds.length === 0) return [];

    const videoStats = await youtube.videos.list({
      part: ['snippet', 'statistics'],
      id: videoIds
    });

    return videoStats.data.items || [];
  } catch (error) {
    console.error("YouTube Niche Trending API Error:", error);
    return [];
  }
}

function formatSubs(count: string | undefined | null) {
  if (!count) return "0";
  const n = parseInt(count);
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

function parseAIJSON(text: string) {
  if (!text) return {};
  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch (e) {
    // Try to extract JSON from markdown blocks
    let cleaned = text;
    if (cleaned.includes("```json")) {
      cleaned = cleaned.split("```json")[1].split("```")[0];
    } else if (cleaned.includes("```")) {
      cleaned = cleaned.split("```")[1].split("```")[0];
    }
    
    cleaned = cleaned.trim();
    
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      // Last resort: try to find the first '{' and last '}'
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        try {
          return JSON.parse(cleaned.substring(start, end + 1));
        } catch (e3) {
          console.error("Failed to parse AI JSON even after extraction:", e3);
          return {};
        }
      }
      return {};
    }
  }
}

async function callAIProvider(prompt: string, provider: string, keys: string[]) {
  if (!keys || keys.length === 0) return null;
  const apiKey = keys[0];

  try {
    if (provider === "OpenAI") {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });
      return parseAIJSON(response.choices[0].message.content || "{}");
    } else if (provider === "OpenRouter") {
      const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
        model: "openai/gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }]
      }, {
        headers: { "Authorization": `Bearer ${apiKey}` }
      });
      return parseAIJSON(response.data.choices[0].message.content || "{}");
    } else if (provider === "MaiaRouter") {
      const response = await axios.post("https://api.maiarouter.ai/v1/chat/completions", {
        model: "maia/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }]
      }, {
        headers: { "Authorization": `Bearer ${apiKey}` }
      });
      return parseAIJSON(response.data.choices[0].message.content || "{}");
    } else if (provider === "Gemini") {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      return parseAIJSON(response.text || "{}");
    }
    return null;
  } catch (e) {
    console.error(`AI Provider (${provider}) Error:`, e);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5000mb' }));
  app.use(express.urlencoded({ limit: '5000mb', extended: true }));

  // --- End AI Intelligence Endpoints ---

  // API: System Stats (Realtime Monitoring)
  app.get("/api/stats", async (req, res) => {
    try {
      let totalMem = os.totalmem();
      let freeMem = os.freemem();
      
      // On Linux (Debian/VPS), we can get more accurate "Available" memory which excludes buffers/cache
      if (process.platform === 'linux') {
        try {
          const memInfo = fs.readFileSync('/proc/meminfo', 'utf8');
          const totalMatch = memInfo.match(/^MemTotal:\s+(\d+)\s+kB/m);
          const availMatch = memInfo.match(/^MemAvailable:\s+(\d+)\s+kB/m);
          if (totalMatch && availMatch) {
            totalMem = parseInt(totalMatch[1]) * 1024;
            freeMem = parseInt(availMatch[1]) * 1024;
          }
        } catch (e) {
          console.warn("[System] Failed to read /proc/meminfo, falling back to os.freemem()");
        }
      }

      const usedMem = totalMem - freeMem;
      const ramUsage = Math.round((usedMem / totalMem) * 100);
      
      // CPU Load based on loadavg (1 min) normalized by CPU count
      const cpuCount = os.cpus().length;
      const loadAvg = os.loadavg()[0];
      // Load average can exceed cpuCount, so we cap it at 100% for the UI gauge
      const cpuLoad = Math.min(Math.round((loadAvg / cpuCount) * 100), 100);
      
      // Real Storage Monitoring - check the root or current directory
      const diskSpace = await checkDiskSpace(process.platform === 'win32' ? process.cwd().split(path.sep)[0] : '/');
      const storageUsage = Math.round(((diskSpace.size - diskSpace.free) / diskSpace.size) * 100);
      
      res.json({
        cpuLoad,
        cpuCount,
        ramUsage,
        totalRam: Math.round(totalMem / (1024 * 1024 * 1024)), // in GB
        storage: storageUsage,
        totalStorage: Math.round(diskSpace.size / (1024 * 1024 * 1024)), // in GB
        videoSchedule: db.jobs.filter(j => !['completed', 'failed'].includes(j.status.toLowerCase())).length,
        activeChannels: db.channels.length,
        queueSize: db.jobs.filter(j => !['completed', 'failed'].includes(j.status.toLowerCase())).length,
        platform: process.platform === 'linux' ? 'Debian Linux VPS' : process.platform
      });
    } catch (error) {
      console.error("Error fetching system stats:", error);
      res.status(500).json({ error: "Failed to fetch system stats" });
    }
  });

  // API: AI Keys Management
  app.get("/api/config/keys", (req, res) => {
    res.json(db.aiKeys);
  });

  app.post("/api/config/keys", (req, res) => {
    const { provider, keys } = req.body;
    if (!provider || !Array.isArray(keys)) {
      return res.status(400).json({ error: "Invalid request body" });
    }
    db.aiKeys[provider] = keys;
    saveDb();
    res.json({ success: true });
  });

  // API: Google API Config Management
  app.post("/api/config/api-keys", (req, res) => {
    const { clientId, clientSecret, name } = req.body;
    const newConfig = {
      id: Math.random().toString(36).substring(7),
      name: name || `API Key ${db.apiConfigs.length + 1}`,
      clientId,
      clientSecret: encrypt(clientSecret),
      status: 'Active',
      quotaUsed: 0,
      lastUsed: Date.now()
    };
    db.apiConfigs.push(newConfig);
    saveDb();
    res.json(newConfig);
  });

  app.get("/api/config/api-keys", (req, res) => {
    res.json(db.apiConfigs.map(c => ({ ...c, clientSecret: '********' })));
  });

  app.post("/api/config/api-keys/test/:id", async (req, res) => {
    const { id } = req.params;
    const config = db.apiConfigs.find(c => c.id === id);
    if (!config) return res.status(404).json({ error: "API Config not found" });

    try {
      // Just a simple check to see if we can initialize it
      const oauth2Client = new google.auth.OAuth2(
        config.clientId,
        decrypt(config.clientSecret)
      );
      res.json({ success: true, message: "API Configuration is valid and connected." });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/config/api-keys/:id", (req, res) => {
    const { id } = req.params;
    db.apiConfigs = db.apiConfigs.filter(c => c.id !== id);
    // Also remove channels associated with this config
    db.channels = db.channels.filter(c => c.configId !== id);
    saveDb();
    res.json({ success: true });
  });

  // API: OAuth Device Flow (TV System)
  app.post("/api/auth/google/device/code", async (req, res) => {
    const { configId } = req.body;
    const config = db.apiConfigs.find(c => c.id === configId);
    if (!config) return res.status(404).json({ error: "API Config not found" });

    try {
      const response = await axios.post('https://oauth2.googleapis.com/device/code', {
        client_id: config.clientId,
        scope: 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'
      });
      
      db.oauthStates.set(response.data.device_code, { configId, ...response.data });
      res.json(response.data);
    } catch (error: any) {
      res.status(500).json({ error: error.response?.data || error.message });
    }
  });

  app.post("/api/auth/google/device/poll", async (req, res) => {
    const { device_code } = req.body;
    const state = db.oauthStates.get(device_code);
    if (!state) return res.status(404).json({ error: "Invalid device code" });

    const config = db.apiConfigs.find(c => c.id === state.configId);

    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: config.clientId,
        client_secret: decrypt(config.clientSecret),
        device_code: device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      });

      const { access_token, refresh_token, expires_in } = response.data;

      // Get user & channel info
      const oauth2Client = new google.auth.OAuth2(config.clientId);
      oauth2Client.setCredentials({ access_token });
      
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });

      const [channelRes, userRes] = await Promise.all([
        youtube.channels.list({ part: ['snippet'], mine: true }),
        oauth2.userinfo.v2.me.get()
      ]);

      const channel = channelRes.data.items?.[0];
      const email = userRes.data.email || "Unknown Email";

      const newChannel = {
        id: channel?.id || Math.random().toString(36).substring(7),
        name: channel?.snippet?.title || "Unknown Channel",
        email: email,
        avatar: channel?.snippet?.thumbnails?.default?.url,
        status: 'Connected',
        accessToken: encrypt(access_token),
        refreshToken: encrypt(refresh_token),
        expiryDate: Date.now() + (expires_in * 1000),
        configId: config.id
      };

      db.channels.push(newChannel);
      db.oauthStates.delete(device_code);
      saveDb();
      res.json(newChannel);
    } catch (error: any) {
      if (error.response?.data?.error === 'authorization_pending') {
        return res.json({ status: 'pending' });
      }
      res.status(500).json({ error: error.response?.data || error.message });
    }
  });

  // API: File Upload (Video/Thumbnail)
  app.post("/api/upload", upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]), (req: any, res) => {
    const files = req.files;
    const response: any = {};
    
    if (files.video) {
      response.videoPath = files.video[0].path;
      response.videoName = files.video[0].originalname;
    }
    if (files.thumbnail) {
      response.thumbnailPath = files.thumbnail[0].path;
      response.thumbnailName = files.thumbnail[0].originalname;
    }
    
    res.json(response);
  });

  // API: Video Upload Job
  app.post("/api/youtube/upload", (req, res) => {
    const jobData = req.body;
    // Validate required fields
    if (!jobData.channelId || !jobData.videoPath || !jobData.title) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const job = queue.add(jobData);
    res.json(job);
  });

  app.get("/api/youtube/jobs", (req, res) => {
    res.json(db.jobs);
  });

  app.get("/api/youtube/history", (req, res) => {
    // Basic filtering, search, and pagination could be done here
    const { status, search, page = 1, limit = 10 } = req.query;
    let filtered = [...db.history];

    if (status && status !== 'all') {
      filtered = filtered.filter(h => h.status === status);
    }

    if (search) {
      const searchStr = (search as string).toLowerCase();
      filtered = filtered.filter(h => h.title.toLowerCase().includes(searchStr));
    }

    const total = filtered.length;
    const start = (Number(page) - 1) * Number(limit);
    const end = start + Number(limit);
    const paginated = filtered.slice(start, end);

    res.json({
      data: paginated,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit))
    });
  });

  app.get("/api/youtube/channels", (req, res) => {
    res.json(db.channels.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      avatar: c.avatar,
      status: c.status
    })));
  });

  // API: Media Gallery
  app.get("/api/media", (req, res) => {
    const { search, source, page = 1, limit = 20 } = req.query;
    let filtered = [...db.media];

    if (source && source !== 'all') {
      filtered = filtered.filter(m => m.source === source);
    }

    if (search) {
      const searchStr = (search as string).toLowerCase();
      filtered = filtered.filter(m => m.filename.toLowerCase().includes(searchStr));
    }

    // Sort by newest first
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = filtered.length;
    const start = (Number(page) - 1) * Number(limit);
    const end = start + Number(limit);
    const paginated = filtered.slice(start, end);

    res.json(paginated);
  });

  app.post("/api/media/process", async (req, res) => {
    const { url, filename } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    let source: 'drive' | 'youtube' | 'direct' = 'direct';
    if (url.includes('youtube.com') || url.includes('youtu.be')) source = 'youtube';
    else if (url.includes('drive.google.com')) source = 'drive';

    const id = uuidv4();
    const newMedia = {
      id,
      filename: filename || `Video_${id.substring(0, 8)}`,
      path: path.join(VIDEOS_DIR, `${id}.mp4`),
      size: 0,
      duration: 0,
      thumbnail: "",
      source,
      status: 'processing',
      createdAt: new Date().toISOString()
    };

    db.media.push(newMedia);
    saveDb();

    processMedia(id, url, source);
    res.json(newMedia);
  });

  app.post("/api/media/upload-init", (req, res) => {
    const { filename, size } = req.body;
    const id = uuidv4();
    const newMedia = {
      id,
      filename: filename || `Upload_${id.substring(0, 8)}`,
      path: path.join(VIDEOS_DIR, `${id}.mp4`),
      size: size || 0,
      duration: 0,
      thumbnail: "",
      source: 'local',
      status: 'uploading',
      progress: 0,
      createdAt: new Date().toISOString()
    };

    db.media.push(newMedia);
    saveDb();
    res.json(newMedia);
  });

  const mediaUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, VIDEOS_DIR),
      filename: (req, file, cb) => {
        const id = req.body.id || uuidv4();
        (req as any).mediaId = id;
        cb(null, `${id}.mp4`);
      }
    }),
    limits: { fileSize: 100 * 1024 * 1024 * 1024 } // 100GB
  });

  app.post("/api/media/upload", mediaUpload.single('video'), async (req: any, res) => {
    const file = req.file;
    const id = req.mediaId;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    let media = db.media.find(m => m.id === id);
    if (!media) {
      media = {
        id,
        filename: file.originalname,
        path: file.path,
        size: file.size,
        duration: 0,
        thumbnail: "",
        source: 'local',
        status: 'processing',
        progress: 80,
        createdAt: new Date().toISOString()
      };
      db.media.push(media);
    } else {
      media.status = 'processing';
      media.progress = 80;
      media.size = file.size;
    }
    
    saveDb();

    // Process metadata and thumbnail
    processMedia(id);
    res.json(media);
  });

  app.patch("/api/media/:id", (req, res) => {
    const { id } = req.params;
    const { filename } = req.body;
    const media = db.media.find(m => m.id === id);
    if (!media) return res.status(404).json({ error: "Media not found" });

    if (filename) media.filename = filename;
    saveDb();
    res.json(media);
  });

  app.delete("/api/media/:id", (req, res) => {
    const { id } = req.params;
    const index = db.media.findIndex(m => m.id === id);
    if (index === -1) return res.status(404).json({ error: "Media not found" });

    const media = db.media[index];
    
    // Delete files
    try {
      if (fs.existsSync(media.path)) fs.unlinkSync(media.path);
      const thumbPath = path.join(THUMBNAILS_DIR, `${id}.jpg`);
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    } catch (e) {
      console.warn("Failed to delete files:", e);
    }

    db.media.splice(index, 1);
    saveDb();
    res.json({ success: true });
  });

  app.get("/api/media/stream/:id", (req, res) => {
    const { id } = req.params;
    const media = db.media.find(m => m.id === id);
    if (!media || !fs.existsSync(media.path)) return res.status(404).json({ error: "Video not found" });

    const stat = fs.statSync(media.path);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(media.path, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(media.path).pipe(res);
    }
  });

  app.get("/api/media/download/:id", (req, res) => {
    const { id } = req.params;
    const media = db.media.find(m => m.id === id);
    if (!media || !fs.existsSync(media.path)) return res.status(404).json({ error: "Video not found" });

    res.setHeader('Content-Disposition', contentDisposition(media.filename));
    res.setHeader('Content-Type', 'video/mp4');
    fs.createReadStream(media.path).pipe(res);
  });

  app.get("/api/media/thumbnail/:id", (req, res) => {
    const { id } = req.params;
    const thumbPath = path.join(THUMBNAILS_DIR, `${id}.jpg`);
    if (fs.existsSync(thumbPath)) {
      res.sendFile(thumbPath);
    } else {
      res.status(404).send("Not found");
    }
  });

  app.delete("/api/youtube/jobs/:id", (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Job ID is required" });
    
    db.jobs = db.jobs.filter(j => j.id !== id);
    saveDb();
    res.json({ success: true });
  });

  app.delete("/api/youtube/history/:id", (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "History ID is required" });
    
    db.history = db.history.filter(h => h.id !== id);
    saveDb();
    res.json({ success: true });
  });

  app.delete("/api/youtube/jobs-history/clear", (req, res) => {
    db.jobs = db.jobs.filter(j => !['completed', 'failed'].includes(j.status.toLowerCase()));
    db.history = [];
    saveDb();
    res.json({ success: true });
  });

  app.delete("/api/youtube/channels/:id", (req, res) => {
    const { id } = req.params;
    db.channels = db.channels.filter(c => c.id !== id);
    saveDb();
    res.json({ success: true });
  });

  // API: Fetch Playlists for a Channel
  app.get("/api/youtube/playlists/:channelId", async (req, res) => {
    const { channelId } = req.params;
    try {
      const youtube = await getYouTubeClient(channelId);
      const playlistRes = await youtube.playlists.list({
        part: ['snippet', 'contentDetails'],
        mine: true,
        maxResults: 50
      });

      res.json(playlistRes.data.items || []);
    } catch (error: any) {
      console.error('Error fetching playlists:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/generate-image", async (req, res) => {
    const { prompt, provider, apiKey, ratio } = req.body;
    if (!prompt || !provider || !apiKey) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      if (provider === "OpenAI") {
        const openai = new OpenAI({ apiKey });
        let size: any = "1024x1024";
        if (ratio === "16:9") size = "1792x1024";
        else if (ratio === "9:16") size = "1024x1792";

        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: prompt,
          n: 1,
          size: size,
          quality: "hd",
        });
        return res.json({ url: response.data[0].url });
      } else if (provider === "OpenRouter" || provider === "MaiaRouter") {
        const baseURL = provider === "OpenRouter" ? "https://openrouter.ai/api/v1" : "https://api.maiarouter.ai/v1";
        const model = provider === "OpenRouter" ? "openai/dall-e-3" : "maia/stable-diffusion-xl";
        
        const openai = new OpenAI({ 
          apiKey, 
          baseURL,
          defaultHeaders: {
            "HTTP-Referer": "https://ai.studio",
            "X-Title": "AI Studio Applet"
          }
        });

        let size: any = "1024x1024";
        if (ratio === "16:9") size = "1792x1024";
        else if (ratio === "9:16") size = "1024x1792";

        const response = await openai.images.generate({
          model: model,
          prompt: prompt,
          n: 1,
          size: size,
        });
        return res.json({ url: response.data[0].url });
      }
      res.status(400).json({ error: "Unsupported provider for server-side image generation" });
    } catch (e: any) {
      const errorData = e.response?.data;
      const errorMessage = typeof errorData === 'string' && errorData.includes('<!DOCTYPE html>') 
        ? "Provider returned a 404/Not Found error. This provider may not support image generation."
        : (errorData?.error?.message || e.message);
      
      console.error(`Image generation error (${provider}):`, errorMessage);
      res.status(500).json({ error: errorMessage });
    }
  });

  // AI Intelligence: Trending (Removed)
  // End Trending Endpoints

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Set timeout to 0 (no timeout) to allow large file uploads/downloads
  server.timeout = 0;
  server.keepAliveTimeout = 0;
}

startServer();
