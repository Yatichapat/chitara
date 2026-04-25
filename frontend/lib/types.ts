export type GenerationStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | string;

export interface Song {
  song_id: number;
  title: string;
  description: string;
  created_date: string;
  audio_file_path: string;
  generation_task_id: string;
  generation_status: GenerationStatus;
  privacy_level: PrivacyLevel;
  invited_emails: string[];
  creator_generation_quota?: number;
  genre: string;
  mood: string;
  occasion: string;
  creator_id: number;
  albums: number[];
}

export interface Album {
  album_id: number;
  name: string;
  created_date: string;
  privacy_level: PrivacyLevel;
  invited_emails: string[];
  creator_id: number;
  song_count: number;
}

export type PrivacyLevel = "public" | "invite_only" | "private";

export interface SongsResponse {
  songs: Song[];
}

export interface AlbumsResponse {
  albums: Album[];
}

export interface SharedAlbumResponse {
  album: Album;
  songs: Song[];
}

export interface GenerateRequest {
  prompt: string;
  title: string;
  genre: string;
  mood: string;
  occasion?: string;
}

export interface ApiError {
  error?: string;
}

export interface AuthUser {
  user_id: number;
  name: string;
  email: string;
  generation_quota: number;
}
