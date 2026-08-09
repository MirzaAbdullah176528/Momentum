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
}

export interface AppContext {
  Bindings: Env;
  Variables: {
    userId: string;
    sessionId: string;
  };
}
