import type {
  ApiResponse,
  ProjectDTO,
  TaskDTO,
  TaskLogDTO,
  SeasonDTO,
  CreateProjectInputDTO,
  UpdateProjectInputDTO,
  CreateTaskInputDTO,
  UpdateTaskInputDTO,
  UpsertTaskLogInputDTO,
  CreateSeasonInputDTO,
  UpdateSeasonInputDTO,
  ReorderTasksInputDTO,
  DailyRatingWithBreakdownDTO,
  CurrentSeasonDTO,
  SeasonRatingDTO,
  DailyRatingTimeSeriesDTO,
  ProjectCompletionStatsResponseDTO,
  LeaderboardResponseDTO,
  UserDTO,
  UpdateUserInputDTO,
  StartChallengeInputDTO,
  StartChallengeResultDTO,
  StartChallengeEligibilityDTO,
  SeasonChallengeDTO,
  SeasonFinalGoalDTO,
  FinalGoalInputDTO
} from "@momentum/shared-types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) ?? {})
  };

  if (options.body && typeof options.body === "string") {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: "include"
    });
  } catch {
    throw new ApiError(
      "Network error — could not reach the server.",
      0,
      "network_error"
    );
  }

  let body: ApiResponse<T> | null = null;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    if (!response.ok) {
      throw new ApiError(
        response.status >= 500
          ? "The server encountered an error."
          : "Request failed.",
        response.status,
        "http_error"
      );
    }
    throw new ApiError("Invalid response from server.", response.status, "parse_error");
  }

  if (!body.ok) {
    throw new ApiError(body.error.message, response.status, body.error.code);
  }

  return body.data;
}

function postJson<T>(path: string, data: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(data)
  });
}

function patchJson<T>(path: string, data: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: JSON.stringify(data)
  });
}

function putJson<T>(path: string, data: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

function deleteReq<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

function getJson<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

export const api = {
  user: {
    get: () => getJson<UserDTO>("/api/user"),
    update: (data: UpdateUserInputDTO) => patchJson<UserDTO>("/api/user", data)
  },

  projects: {
    list: () => getJson<ProjectDTO[]>("/api/projects"),
    get: (id: string) => getJson<ProjectDTO>(`/api/projects/${id}`),
    create: (data: CreateProjectInputDTO) =>
      postJson<ProjectDTO>("/api/projects", data),
    update: (id: string, data: UpdateProjectInputDTO) =>
      patchJson<ProjectDTO>(`/api/projects/${id}`, data),
    delete: (id: string) => deleteReq<{ id: string }>(`/api/projects/${id}`)
  },

  tasks: {
    list: (projectId?: string) =>
      getJson<TaskDTO[]>(
        projectId ? `/api/tasks?projectId=${projectId}` : "/api/tasks"
      ),
    get: (id: string) => getJson<TaskDTO>(`/api/tasks/${id}`),
    create: (data: CreateTaskInputDTO) => postJson<TaskDTO>("/api/tasks", data),
    update: (id: string, data: UpdateTaskInputDTO) =>
      patchJson<TaskDTO>(`/api/tasks/${id}`, data),
    delete: (id: string) => deleteReq<{ id: string }>(`/api/tasks/${id}`),
    reorder: (data: ReorderTasksInputDTO) =>
      postJson<TaskDTO[]>("/api/tasks/reorder", data)
  },

  taskLogs: {
    listByDate: (date: string) =>
      getJson<TaskLogDTO[]>(`/api/task-logs/by-date/${date}`),
    listByTask: (taskId: string) =>
      getJson<TaskLogDTO[]>(`/api/task-logs/by-task/${taskId}`),
    upsert: (data: UpsertTaskLogInputDTO) =>
      putJson<TaskLogDTO>("/api/task-logs", data),
    delete: (id: string) => deleteReq<{ id: string }>(`/api/task-logs/${id}`),
    dailyRating: (date: string) =>
      getJson<DailyRatingWithBreakdownDTO>(
        `/api/task-logs/daily-rating/${date}`
      )
  },

  seasons: {
    list: () => getJson<SeasonDTO[]>("/api/seasons"),
    current: () => getJson<CurrentSeasonDTO>("/api/seasons/current"),
    get: (id: string) => getJson<SeasonDTO>(`/api/seasons/${id}`),
    create: (data: CreateSeasonInputDTO) =>
      postJson<SeasonDTO>("/api/seasons", data),
    update: (id: string, data: UpdateSeasonInputDTO) =>
      patchJson<SeasonDTO>(`/api/seasons/${id}`, data),
    delete: (id: string) => deleteReq<{ id: string }>(`/api/seasons/${id}`),
    rating: (id: string) =>
      getJson<SeasonRatingDTO>(`/api/seasons/${id}/rating`),
    startEligibility: () =>
      getJson<StartChallengeEligibilityDTO>("/api/seasons/start-eligibility"),
    startChallenge: (data: StartChallengeInputDTO) =>
      postJson<StartChallengeResultDTO>("/api/seasons/start", data),
    challenge: (id: string) =>
      getJson<SeasonChallengeDTO>(`/api/seasons/${id}/challenge`),
    addFinalGoal: (seasonId: string, data: FinalGoalInputDTO) =>
      postJson<SeasonFinalGoalDTO>(
        `/api/seasons/${seasonId}/final-goals`,
        data
      ),
    updateFinalGoal: (
      seasonId: string,
      goalId: string,
      completed: boolean
    ) =>
      patchJson<SeasonFinalGoalDTO>(
        `/api/seasons/${seasonId}/final-goals/${goalId}`,
        { completed }
      ),
    deleteFinalGoal: (seasonId: string, goalId: string) =>
      deleteReq<{ id: string }>(
        `/api/seasons/${seasonId}/final-goals/${goalId}`
      )
  },

  analytics: {
    dailyRatingTimeSeries: (seasonId?: string) =>
      getJson<DailyRatingTimeSeriesDTO>(
        `/api/analytics/daily-rating-time-series${
          seasonId ? `?seasonId=${seasonId}` : ""
        }`
      ),
    projectCompletionStats: (seasonId?: string) =>
      getJson<ProjectCompletionStatsResponseDTO>(
        `/api/analytics/project-completion-stats${
          seasonId ? `?seasonId=${seasonId}` : ""
        }`
      )
  },

  leaderboard: {
    get: (params?: {
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.startDate)
        searchParams.set("startDate", params.startDate);
      if (params?.endDate) searchParams.set("endDate", params.endDate);
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.offset) searchParams.set("offset", String(params.offset));
      const query = searchParams.toString();
      return getJson<LeaderboardResponseDTO>(
        `/api/leaderboard${query ? `?${query}` : ""}`
      );
    }
  }
};
