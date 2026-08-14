export const DAILY_RATING_MIN = 0;
export const DAILY_RATING_MAX = 10;
export const RATING_PRECISION = 2;
export const PKT_IANA_TIMEZONE = "Asia/Karachi";
export const PKT_UTC_OFFSET_HOURS = 5;

export const TASK_UNITS = ["km", "hours", "pages", "reps", "count", "calories"] as const;
export type TaskUnit = (typeof TASK_UNITS)[number];

export const DEFAULT_PROJECT_COLOR = "#808080";
export const DEFAULT_TIMEZONE = "Asia/Karachi";
export const SEASON_TARGET_RATING_MIN = 0;
export const SEASON_TARGET_RATING_MAX = 10;
export const TASK_IMPORTANCE_WEIGHT_MIN = 1;
export const TASK_IMPORTANCE_WEIGHT_MAX = 5;

/**
 * Included-days representation: a 7-bit bitmask where bit N (the value of
 * `Date#getDay()`, 0 = Sunday .. 6 = Saturday) is set when that weekday is
 * counted toward a challenge. Excluded days never contribute to a season or
 * weekly average (not even as a 0), generalizing the legacy `weekdaysOnly`
 * boolean to any subset of weekdays.
 */
export const INCLUDED_DAYS_SUNDAY = 1 << 0;
export const INCLUDED_DAYS_MONDAY = 1 << 1;
export const INCLUDED_DAYS_TUESDAY = 1 << 2;
export const INCLUDED_DAYS_WEDNESDAY = 1 << 3;
export const INCLUDED_DAYS_THURSDAY = 1 << 4;
export const INCLUDED_DAYS_FRIDAY = 1 << 5;
export const INCLUDED_DAYS_SATURDAY = 1 << 6;

/** All seven weekdays included (legacy `weekdaysOnly: false`). */
export const INCLUDED_DAYS_ALL = 0b1111111; // 127
/** Monday through Friday included (legacy `weekdaysOnly: true`). */
export const INCLUDED_DAYS_MON_FRI =
  INCLUDED_DAYS_MONDAY |
  INCLUDED_DAYS_TUESDAY |
  INCLUDED_DAYS_WEDNESDAY |
  INCLUDED_DAYS_THURSDAY |
  INCLUDED_DAYS_FRIDAY; // 62

/** Number of bits used to represent included days. */
export const INCLUDED_DAYS_BIT_COUNT = 7;

/** A new season is a fixed 28-day (4-week) challenge. */
export const SEASON_CHALLENGE_LENGTH_DAYS = 28;
export const SEASON_CHALLENGE_WEEKS = 4;
export const SEASON_WEEK_LENGTH_DAYS = 7;

export const WEEKLY_REWARD_WEEK_MIN = 1;
export const WEEKLY_REWARD_WEEK_MAX = 4;
export const WEEKLY_REWARD_TEXT_MAX = 500;
export const FINAL_GOAL_TEXT_MAX = 280;
export const FINAL_GOALS_MAX = 50;

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
  includedDays: number;
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
  /**
   * Locked by default after creation. Only accepted on the first day of the
   * user's active season (today == season.startDate in PKT); the API enforces
   * this query-time and rejects these fields with 403 on any other day.
   */
  targetValue?: number;
  unit?: TaskUnit;
  importanceWeight?: number;
}

export interface CreateSeasonInputDTO {
  startDate: PktDateString;
  endDate: PktDateString;
  targetRating: number;
  rewardText: string;
  includedDays: number;
}

export interface UpdateSeasonInputDTO {
  startDate?: PktDateString;
  endDate?: PktDateString;
  targetRating?: number;
  rewardText?: string;
  includedDays?: number;
}

/** One weekly reward target/reward, decided upfront during Start Challenge. */
export interface WeeklyRewardDTO {
  id: string;
  seasonId: string;
  weekNumber: number;
  targetRating: number;
  rewardText: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface WeeklyRewardInputDTO {
  weekNumber: number;
  targetRating: number;
  rewardText: string;
}

/**
 * Resolved status of a weekly (or monthly) reward indicator.
 * - "in_progress"  — the week has not concluded yet (some included days remain).
 * - "achieved"     — the week concluded and its average >= target rating.
 * - "not_achieved" — the week concluded and its average < target rating.
 */
export type RewardIndicatorStatus =
  | "in_progress"
  | "achieved"
  | "not_achieved";

export interface WeeklyRewardIndicatorDTO {
  weekNumber: number;
  targetRating: number;
  rewardText: string;
  status: RewardIndicatorStatus;
  averageRating: number;
  activeDayCount: number;
  loggedDayCount: number;
  /** Inclusive PKT date string range for this week. */
  startDate: PktDateString;
  endDate: PktDateString;
}

export interface MonthlyRewardIndicatorDTO {
  status: RewardIndicatorStatus;
  averageRating: number;
  targetRating: number;
  rewardText: string;
}

/** A standalone, user-defined final goal checklist item (not scored). */
export interface SeasonFinalGoalDTO {
  id: string;
  seasonId: string;
  text: string;
  completed: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface FinalGoalInputDTO {
  text: string;
}

export interface StartChallengeInputDTO {
  includedDays: number;
  targetRating: number;
  rewardText: string;
  weeklyRewards: WeeklyRewardInputDTO[];
  finalGoals: FinalGoalInputDTO[];
}

/**
 * Returned by `POST /api/seasons/start`. Carries the created season together
 * with its resolved weekly rewards and final goals so the client can render
 * the new challenge without a second round-trip.
 */
export interface StartChallengeResultDTO {
  season: SeasonDTO;
  weeklyRewards: WeeklyRewardDTO[];
  finalGoals: SeasonFinalGoalDTO[];
}

/**
 * Whether the user is allowed to start a new challenge right now. `canStart`
 * is true only when the user has no season whose date range includes or is
 * after today.
 */
export interface StartChallengeEligibilityDTO {
  canStart: boolean;
  reason?: string;
}

/**
 * Detailed challenge view for a single season: the running rating, the
 * 4 weekly reward indicators, the overall (monthly) reward indicator, and the
 * standalone final-goals checklist. Returned by
 * `GET /api/seasons/:id/challenge`.
 */
export interface SeasonChallengeDTO {
  season: SeasonDTO;
  weeklyRewards: WeeklyRewardDTO[];
  weeklyRewardIndicators: WeeklyRewardIndicatorDTO[];
  monthlyRewardIndicator: MonthlyRewardIndicatorDTO;
  finalGoals: SeasonFinalGoalDTO[];
  runningAverage: number;
  activeDayCount: number;
  loggedDayCount: number;
  missedDayCount: number;
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
  weeklyRewards: WeeklyRewardDTO[];
  weeklyRewardIndicators: WeeklyRewardIndicatorDTO[];
  monthlyRewardIndicator: MonthlyRewardIndicatorDTO;
  finalGoals: SeasonFinalGoalDTO[];
  runningAverage: number;
  activeDayCount: number;
  loggedDayCount: number;
  missedDayCount: number;
  targetRating: number;
  rewardAchieved: boolean;
  daysRemaining: number;
  /** True when today (PKT) equals this season's startDate — the one-day window
   * during which a task's locked fields (targetValue/unit/importanceWeight)
   * may be edited. False on every other day and when there's no active season. */
  canEditLockedFields: boolean;
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
