import type {
  ApiResponse,
  CreateTaskInputDTO,
  UpdateTaskInputDTO,
  CreateSeasonInputDTO,
  UpdateSeasonInputDTO,
  CreateProjectInputDTO,
  UpdateProjectInputDTO,
  UpsertTaskLogInputDTO,
  UpdateUserInputDTO,
  ReorderTasksInputDTO,
  TaskDTO,
  SeasonDTO,
  ProjectDTO,
  TaskLogDTO,
  UserDTO,
  DailyRatingDTO,
  SeasonRatingDTO,
  DailyRatingWithBreakdownDTO,
  CurrentSeasonDTO,
  DailyRatingTimeSeriesDTO,
  ProjectCompletionStatsResponseDTO,
  LeaderboardResponseDTO
} from "@momentum/shared-types";

export type {
  ApiResponse,
  CreateTaskInputDTO,
  UpdateTaskInputDTO,
  CreateSeasonInputDTO,
  UpdateSeasonInputDTO,
  CreateProjectInputDTO,
  UpdateProjectInputDTO,
  UpsertTaskLogInputDTO,
  UpdateUserInputDTO,
  ReorderTasksInputDTO,
  TaskDTO,
  SeasonDTO,
  ProjectDTO,
  TaskLogDTO,
  UserDTO,
  DailyRatingDTO,
  SeasonRatingDTO,
  DailyRatingWithBreakdownDTO,
  CurrentSeasonDTO,
  DailyRatingTimeSeriesDTO,
  ProjectCompletionStatsResponseDTO,
  LeaderboardResponseDTO
};

export interface Env {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  RESEND_API_KEY: string;
  FROM_EMAIL: string;
  APP_ENV: "local" | "production";
  WEB_DEV_ORIGINS?: string;
  /**
   * Comma-separated list of frontend origins allowed to call the API in
   * production (e.g. "https://momentum-by-abdullah-hassan.vercel.app").
   * When unset, only BETTER_AUTH_URL + localhost are trusted. Used by
   * better-auth trustedOrigins, CORS, CSRF, and the CSP connect-src list so
   * all four agree — set this to your deployed web origin(s) and auth works
   * without code changes.
   */
  WEB_ORIGINS?: string;
}

export interface AppContext {
  Bindings: Env;
  Variables: {
    userId: string;
    sessionId: string;
  };
}
