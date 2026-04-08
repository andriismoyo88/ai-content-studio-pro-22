export type Niche = "Edukasi" | "Kesehatan" | "Storytelling" | "Animasi" | "Travel/Vlog" | "Music";
export type VideoStyle = "Animasi kartun" | "Cinematik" | "Storytelling" | "Relaksasi/ASMR";
export type SceneCount = 4 | 5 | 6 | 7;
export type AssetType = "Image" | "Video";
export type Duration = 8 | 10 | 15 | 30;
export type RoleModelAI = "Gemini" | "OpenRouter" | "MaiaRouter" | "OpenAI";

export interface KeywordForensics {
  id: string;
  keyword: string;
  volume: number;
  competition: number;
  cpc: number;
  intent: "Informational" | "Commercial" | "Transactional";
  cluster: string;
  opportunityScore: number;
  createdAt: string;
  // Detailed Analysis Data
  highVolumeSearch?: {
    keyword: string;
    score: number;
    tag: "HOT" | "NEW" | "EASY" | "STABLE";
    subtext: string;
  }[];
  marketLeaders?: {
    name: string;
    subs: string;
    description: string;
  }[];
  ctrLab?: {
    sentiment: number;
    thumbnailTips: string[];
  };
  viralForecast?: {
    topics: { title: string; viralChance: number }[];
    marketStatus: "STEADY" | "RISING" | "VOLATILE";
  };
}

export interface TrendingAnalysis {
  id: string;
  niche: string;
  platform: "YouTube" | "Shorts";
  timeRange: "24 JAM" | "7 HARI" | "30 HARI";
  region: "Indonesia" | "Global" | "Asia";
  createdAt: string;
  marketLeaders: {
    ranking: number;
    channelName: string;
    nicheRelevance: number;
    avgViews: string;
    growthRate: number;
    engagementRate: string;
    insight: string;
  }[];
  subtopics: {
    title: string;
    growth: number;
    competition: "Low" | "Medium" | "High";
    opportunityScore: number;
    insight: string;
  }[];
  viralHooks: {
    hook: string;
    effectiveness: string;
    platform: string;
  }[];
  contentStrategy: {
    format: string;
    duration: string;
    structure: {
      hook: string;
      buildUp: string;
      climax: string;
      cta: string;
    };
    ideas: string[];
    frequency: string;
    optimization: {
      title: string;
      thumbnail: string;
      retention: string;
    };
  };
}

export interface AIIntelligenceData {
  keywords: KeywordForensics[];
  trending: TrendingAnalysis[];
}

export interface ScriptScene {
  sceneNumber: number;
  content: string;
}

export interface GeneratedScript {
  niche: Niche;
  style: VideoStyle;
  topic: string;
  scenes: string[];
}

export interface SystemStats {
  cpuLoad: number;
  cpuCount: number;
  ramUsage: number;
  totalRam: number;
  storage: number;
  totalStorage: number;
  videoSchedule: number;
  activeChannels: number;
  queueSize: number;
}

export interface GeneratedAsset {
  url: string;
  type: AssetType;
  prompt: string;
  ratio: "16:9" | "9:16" | "1:1" | "4:3";
}

export interface VoiceOverResult {
  id: string;
  url: string;
  language: string;
  gender: string;
  text: string;
}

export interface Asset {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video' | 'audio';
  category: 'voiceover' | 'backsound' | 'visual';
  size: string;
  blob?: Blob;
}

export interface VideoJob {
  id: string;
  data: {
    title: string;
    description: string;
    tags: string[];
    videoPath: string;
    thumbnailPath?: string;
    privacy: 'public' | 'private' | 'unlisted';
    playlistId?: string;
    scheduledAt: string | null;
    channelId: string;
    categoryId?: string;
    madeForKids?: boolean;
    aiLabel?: boolean;
    privacyAfterLive?: 'public' | 'private' | 'unlisted' | 'tetap';
    monetization?: boolean;
  };
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  videoUrl?: string;
  error?: string;
  createdAt: string;
}

export interface YouTubeChannel {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'Connected' | 'Disconnected' | 'Error';
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  configId?: string;
}

export interface APIConfig {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  status: 'Active' | 'Error' | 'Quota Exceeded';
  quotaUsed: number;
  lastUsed: number;
}

export interface StoryboardScene {
  sceneNumber: number;
  shotType: string;
  title: string;
  titleEn: string;
  location: string;
  locationEn: string;
  time: string;
  timeEn: string;
  narration: string;
  narrationEn: string;
  mood: string;
  moodEn: string;
  character: string;
  characterEn: string;
  camera: string;
  cameraEn: string;
  visualPrompt: string;
}

export interface StoryboardResult {
  story: string;
  style: string;
  aspectRatio: string;
  scenes: StoryboardScene[];
}

export interface GlobalConfig {
  defaultProvider: "Gemini" | "OpenRouter" | "MaiaRouter" | "OpenAI";
  defaultStyle: string;
  defaultAspectRatio: string;
  defaultDensity: string;
}

export interface MediaAsset {
  id: string;
  filename: string;
  path: string;
  size: number;
  duration: number;
  thumbnail: string;
  source: 'drive' | 'youtube' | 'local' | 'direct';
  status: 'processing' | 'ready' | 'failed' | 'uploading';
  progress: number;
  error?: string;
  createdAt: string;
}
