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
  creator_id: number;
  song_count: number;
}

export interface SongsResponse {
  songs: Song[];
}

export interface AlbumsResponse {
  albums: Album[];
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
