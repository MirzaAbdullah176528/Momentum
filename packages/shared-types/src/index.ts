export const DAILY_RATING_MIN = 0;
export const DAILY_RATING_MAX = 10;
export const RATING_PRECISION = 2;
export const PKT_IANA_TIMEZONE = "Asia/Karachi";
export const PKT_UTC_OFFSET_HOURS = 5;

export const TASK_UNITS = ["km", "hours", "pages", "reps", "count"] as const;
export type TaskUnit = (typeof TASK_UNITS)[number];

export const DEFAULT_PROJECT_COLOR = "#808080";
export const DEFAULT_TIMEZONE = "Asia/Karachi";
export const SEASON_TARGET_RATING_MIN = 0;
export const SEASON_TARGET_RATING_MAX = 10;
export const TASK_IMPORTANCE_WEIGHT_MIN = 1;
export const TASK_IMPORTANCE_WEIGHT_MAX = 5;

export type PktDateString = string;
export type IsoDateString = string;
export type HhMmString = string;

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  username: string;
  timezone: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface SeasonDTO {
  id: string;
  userId: string;
  startDate: PktDateString;
  endDate: PktDateString;
  targetRating: number;
  rewardText: string;
  weekdaysOnly: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface ProjectDTO {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface TaskDTO {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  targetValue: number;
  unit: TaskUnit;
  importanceWeight: number;
  sortOrder: number;
  scheduledStart: HhMmString;
  scheduledEnd: HhMmString;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface TaskLogDTO {
  id: string;
  taskId: string;
  userId: string;
  date: PktDateString;
  actualValue: number | null;
  taskScore: number | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface DailyRatingDTO {
  pktDate: PktDateString;
  rating: number;
  taskCount: number;
  totalWeight: number;
  totalScore: number;
}

export interface SeasonRatingDTO {
  seasonId: string;
  rating: number;
  activeDayCount: number;
  loggedDayCount: number;
  missedDayCount: number;
  dailyRatings: DailyRatingDTO[];
}

export interface CreateTaskInputDTO {
  projectId: string;
  title: string;
  targetValue: number;
  unit: TaskUnit;
  importanceWeight: number;
  sortOrder?: number;
  scheduledStart: HhMmString;
  scheduledEnd: HhMmString;
}

export interface UpdateTaskInputDTO {
  title?: string;
  sortOrder?: number;
  scheduledStart?: HhMmString;
  scheduledEnd?: HhMmString;
}

export interface CreateSeasonInputDTO {
  startDate: PktDateString;
  endDate: PktDateString;
  targetRating: number;
  rewardText: string;
  weekdaysOnly: boolean;
}

export interface UpdateSeasonInputDTO {
  startDate?: PktDateString;
  endDate?: PktDateString;
  targetRating?: number;
  rewardText?: string;
  weekdaysOnly?: boolean;
}

export interface CreateProjectInputDTO {
  name: string;
  color?: string;
}

export interface UpdateProjectInputDTO {
  name?: string;
  color?: string;
}

export interface UpsertTaskLogInputDTO {
  taskId: string;
  date: PktDateString;
  actualValue: number | null;
}

export interface UpdateUserInputDTO {
  name?: string;
  image?: string | null;
  username?: string;
  timezone?: string;
}

export interface ReorderTasksInputDTO {
  projectId: string;
  taskIds: string[];
}

export interface TaskBreakdownDTO {
  taskId: string;
  title: string;
  targetValue: number;
  unit: TaskUnit;
  importanceWeight: number;
  actualValue: number | null;
  taskScore: number;
  capped: boolean;
  missed: boolean;
}

export interface DailyRatingWithBreakdownDTO {
  pktDate: PktDateString;
  rating: number;
  taskCount: number;
  totalWeight: number;
  totalScore: number;
  tasks: TaskBreakdownDTO[];
}

export interface CurrentSeasonDTO {
  season: SeasonDTO;
  dailyRatings: DailyRatingDTO[];
  runningAverage: number;
  activeDayCount: number;
  loggedDayCount: number;
  missedDayCount: number;
  targetRating: number;
  rewardAchieved: boolean;
  daysRemaining: number;
}

export interface DailyRatingTimeSeriesPointDTO {
  pktDate: PktDateString;
  rating: number;
  taskCount: number;
}

export interface DailyRatingTimeSeriesDTO {
  seasonId: string;
  startDate: PktDateString;
  endDate: PktDateString;
  points: DailyRatingTimeSeriesPointDTO[];
  averageRating: number;
}

export interface ProjectCompletionStatsDTO {
  projectId: string;
  projectName: string;
  projectColor: string;
  taskCount: number;
  loggedTaskCount: number;
  averageScore: number;
  completionRate: number;
}

export interface ProjectCompletionStatsResponseDTO {
  seasonId: string;
  projects: ProjectCompletionStatsDTO[];
}

export interface LeaderboardEntryDTO {
  rank: number;
  username: string;
  seasonRating: number;
}

export interface LeaderboardResponseDTO {
  entries: LeaderboardEntryDTO[];
  total: number;
  limit: number;
  offset: number;
  seasonStartDate: PktDateString;
  seasonEndDate: PktDateString;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export class ApiErrorResponse extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly status: number;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "ApiErrorResponse";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  toJson(): ApiError {
    return {
      ok: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined ? { details: this.details } : {})
      }
    };
  }
}
