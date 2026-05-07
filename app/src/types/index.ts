// ─── Notes ───────────────────────────────────────────────────────────────────

export type NoteColor =
  | 'default'
  | 'pink'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'purple'
  | 'orange';

export type NoteType = 'text' | 'checklist' | 'bullets' | 'numbered';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface NoteFolder {
  id: string;
  name: string;
  emoji: string;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  noteType: NoteType;
  checklistItems: ChecklistItem[];
  images: string[]; // base64 data URLs
  tags: string[];
  color: NoteColor;
  pinned: boolean;
  folderId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low' | 'none';

export type IssueType = 'epic' | 'story' | 'task' | 'bug' | 'subtask';

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly';

export interface Recurring {
  frequency: RecurringFrequency;
  nextDue: string; // ISO date string
}

export interface TaskEvent {
  id: string;
  title: string;
  date: string;   // ISO date string
  time?: string;  // HH:MM
  notes?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;       // column id
  priority: TaskPriority;
  issueType: IssueType;
  storyPoints?: number; // 1 2 3 5 8 13
  tags: string[];
  parentId: string | null;
  sprintId?: string | null;
  linkedNoteIds?: string[];
  dueDate: string | null;
  startTime?: string;    // HH:MM on the due date
  deadlineTime?: string; // HH:MM on the due date
  recurring: Recurring | null;
  events: TaskEvent[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Sprints ──────────────────────────────────────────────────────────────────

export type SprintStatus = 'planned' | 'active' | 'completed';

export interface Sprint {
  id: string;
  name: string;
  goal?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  status: SprintStatus;
  createdAt: string;
}

export interface TaskColumn {
  id: string;
  name: string;
  color: string;  // hex or tailwind color name
  order: number;
}

// ─── Finance ─────────────────────────────────────────────────────────────────

export type TransactionType = 'income' | 'expense';

export type TransactionCategory =
  | 'food'
  | 'transport'
  | 'entertainment'
  | 'bills'
  | 'shopping'
  | 'health'
  | 'rent'
  | 'salary'
  | 'freelance'
  | 'investment'
  | 'other';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  date: string; // ISO date string YYYY-MM-DD
  notes?: string;
  isRecurring: boolean;
  recurringFrequency?: RecurringFrequency;
}

// ─── Habits ──────────────────────────────────────────────────────────────────

export type HabitFrequency = 'daily' | 'weekdays' | 'weekly' | 'monthly';

export type HabitColor =
  | 'blue'
  | 'green'
  | 'purple'
  | 'orange'
  | 'pink'
  | 'teal';

export interface Habit {
  id: string;
  name: string;
  description: string;
  frequency: HabitFrequency;
  color: HabitColor;
  icon: string; // material symbol name
  targetDays: number; // times/week for weekly; 7 for daily; 1 for monthly
  hasNotes: boolean; // prompt user to log notes when completing
  notesPrompt?: string; // e.g. "Which book?" "Which workout?"
  reminderTime?: string; // HH:MM — daily push notification at this time (optional)
  createdAt: string;
  archivedAt: string | null;
}

export interface HabitEntry {
  habitId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  notes?: string; // optional log (book name, workout type, etc.)
}

// ─── Timer ───────────────────────────────────────────────────────────────────

export type TimerMode = 'work' | 'short_break' | 'long_break';

export interface TimerSession {
  id: string;
  taskId: string | null;
  taskTitle: string | null;
  mode: TimerMode;
  duration: number; // seconds
  completedAt: string;
}

// ─── Health ──────────────────────────────────────────────────────────────────

export interface BodyMeasurement {
  id: string;
  date: string;              // YYYY-MM-DD
  weight?: number;           // kg
  bodyFat?: number;          // %
  muscleMass?: number;       // kg
  boneMass?: number;         // kg
  subcutFat?: number;        // % subcutaneous fat
  bodyWater?: number;        // %
  skeletalMuscle?: number;   // %
  visceralFat?: number;      // score 1–59
  bmr?: number;              // kcal basal metabolic rate
  protein?: number;          // %
  metabolicAge?: number;     // years
  notes?: string;
  // fatMass, fatFreeMass, BMI are auto-calculated — not stored
}

export interface HealthProfile {
  height: number;           // cm
  targetBodyFatMin: number; // %
  targetBodyFatMax: number; // %
  targetWeight?: number;    // kg
  targetMuscleMass?: number; // kg
}

// ─── Hobbies ─────────────────────────────────────────────────────────────────

export type MediaType = 'movie' | 'series';
export type WatchStatus = 'watched' | 'watching' | 'dropped';
export type MediaPriority = 'high' | 'medium' | 'low';

export interface MediaReview {
  id: string;
  title: string;
  type: MediaType;
  status: WatchStatus;
  rating: number;      // 1–10
  review: string;
  images: string[];    // base64
  genres: string[];
  year?: number;
  seasons?: number;    // for series
  watchedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistItem {
  id: string;
  title: string;
  type: MediaType;
  reason: string;
  priority: MediaPriority;
  genres: string[];
  addedAt: string;
}

export interface Artwork {
  id: string;
  title: string;
  medium: string;
  section?: 'Glass Paint' | 'Drawing & Painting' | 'Crafts';
  date: string;           // YYYY-MM-DD
  image?: string;         // base64 data URL or /paintings/... path (legacy/fallback)
  driveFileId?: string;   // Google Drive appDataFolder file ID (preferred)
  mediaType?: 'image' | 'video';
  rotation?: number;      // 0, 90, 180, 270
  notes: string;
  createdAt: string;
}

// ─── Books ───────────────────────────────────────────────────────────────────

export type ReadStatus = 'read' | 'reading' | 'dropped';

export interface BookReview {
  id: string;
  title: string;
  author: string;
  status: ReadStatus;
  rating: number;     // 1–10
  review: string;
  images: string[];   // base64
  genres: string[];
  year?: number;      // publication year
  pages?: number;
  dateRead?: string;  // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
}

export interface ReadingListItem {
  id: string;
  title: string;
  author: string;
  reason: string;
  priority: MediaPriority;
  genres: string[];
  addedAt: string;
}

// ─── Search ──────────────────────────────────────────────────────────────────

export type SearchResultType = 'note' | 'task' | 'habit' | 'transaction';

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  color?: string;
  navigateTo: string;
}
