// ── Mission Types ─────────────────────────────────────────────────────

export type MissionStatus = 'proposed' | 'approved' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Mission {
  id: string;
  goal: string;
  status: MissionStatus;
  created_at: number;
  updated_at: number;
  plan: MissionPlan | null;
  result: string | null;
  duration_ms: number | null;
  agent_id: string | null;
}

export interface MissionPlan {
  reasoning: string;
  subtasks: MissionSubtask[];
  needs_clarification: boolean;
  clarification_question?: string;
}

export interface MissionSubtask {
  id: string;
  description: string;
  agent_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result: string | null;
  depends_on: string[];
}

// ── Agent Types ──────────────────────────────────────────────────────

export type AgentStatus = 'available' | 'busy' | 'offline';

export interface AgentCard {
  id: string;
  name: string;
  description: string;
  skills: string[];
  status: AgentStatus;
  type: 'named' | 'stock';
  active_mission_id: string | null;
}

// ── Log Types ────────────────────────────────────────────────────────

export interface MissionLog {
  id: number;
  mission_id: string;
  timestamp: number;
  level: 'info' | 'progress' | 'error' | 'result';
  message: string;
  agent_id: string | null;
}

// ── API Types ────────────────────────────────────────────────────────

export interface CreateMissionRequest {
  goal: string;
}

export interface CreateMissionResponse {
  mission: Mission;
}

export interface MissionDetailResponse {
  mission: Mission;
  logs: MissionLog[];
}

export interface AgentListResponse {
  agents: AgentCard[];
}

export interface StatusResponse {
  mission_id: string;
  status: MissionStatus;
  summary: string;
  progress_pct: number | null;
}
