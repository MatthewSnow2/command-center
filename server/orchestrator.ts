import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import {
  createMission,
  getMission,
  updateMission,
  addMissionLog,
  listAgents,
  updateAgentStatus,
} from './db.js';
import type { Mission, MissionPlan, AgentCard } from '../shared/types.js';

// ── Intent Classification ────────────────────────────────────────────

interface ClassificationResult {
  task_type: 'research' | 'coding' | 'content' | 'ops' | 'general';
  complexity: 'simple' | 'moderate' | 'complex';
  suggested_agent: string | null;
  reasoning: string;
}

/**
 * Classify intent from a mission goal. For MVP, uses keyword matching.
 * Phase 3 will add LLM-powered classification via Gemini.
 */
export function classifyIntent(goal: string): ClassificationResult {
  const lower = goal.toLowerCase();

  // Keyword-based classification (MVP — replace with LLM in Phase 3)
  const codingKeywords = /\b(build|code|implement|fix|refactor|debug|create.*app|write.*function|add.*feature|test|deploy)\b/;
  const researchKeywords = /\b(research|find|search|look up|investigate|analyze|compare|what is|how does|summarize)\b/;
  const contentKeywords = /\b(write|draft|blog|post|email|article|documentation|content|social media|copy)\b/;
  const opsKeywords = /\b(deploy|restart|update|install|configure|migrate|backup|monitor|server|docker|container)\b/;

  let task_type: ClassificationResult['task_type'] = 'general';
  if (codingKeywords.test(lower)) task_type = 'coding';
  else if (researchKeywords.test(lower)) task_type = 'research';
  else if (contentKeywords.test(lower)) task_type = 'content';
  else if (opsKeywords.test(lower)) task_type = 'ops';

  const complexity = lower.length > 200 || lower.includes(' and ') || lower.includes(' then ')
    ? 'complex'
    : lower.length > 80 ? 'moderate' : 'simple';

  // Match to available agents
  const agents = listAgents() as AgentCard[];
  const matched = agents.find(a =>
    a.skills.some((s: string) => s.toLowerCase() === task_type) && a.status === 'available'
  );

  return {
    task_type,
    complexity,
    suggested_agent: matched?.id ?? (agents.find(a => a.status === 'available')?.id ?? null),
    reasoning: `Classified as ${task_type} (${complexity}). ${matched ? `Matched agent: ${matched.name}` : 'No specific agent matched — will use default.'}`,
  };
}

// ── Mission Lifecycle ────────────────────────────────────────────────

export function proposeMission(goal: string): { mission: Mission; classification: ClassificationResult } {
  const id = uuidv4();
  const classification = classifyIntent(goal);

  createMission(id, goal);

  const plan: MissionPlan = {
    reasoning: classification.reasoning,
    subtasks: [{
      id: uuidv4(),
      description: goal,
      agent_id: classification.suggested_agent ?? 'claude-code',
      status: 'pending',
      result: null,
      depends_on: [],
    }],
    needs_clarification: false,
  };

  updateMission(id, {
    plan,
    agent_id: classification.suggested_agent ?? 'claude-code',
  });

  addMissionLog(id, 'info', `Mission proposed: ${goal}`);
  addMissionLog(id, 'info', `Classification: ${classification.task_type} (${classification.complexity})`);
  if (classification.suggested_agent) {
    addMissionLog(id, 'info', `Suggested agent: ${classification.suggested_agent}`);
  }

  const mission = getMission(id) as Mission;
  return { mission, classification };
}

export async function approveMission(missionId: string): Promise<void> {
  const mission = getMission(missionId);
  if (!mission) throw new Error(`Mission ${missionId} not found`);

  updateMission(missionId, { status: 'running' });
  addMissionLog(missionId, 'info', 'Mission approved — executing');

  const agentId = (mission.agent_id as string) ?? 'claude-code';

  // Mark agent busy
  updateAgentStatus(agentId, 'busy', missionId);

  const startTime = Date.now();

  try {
    addMissionLog(missionId, 'progress', `Dispatching to agent: ${agentId}`);
    const result = await executeViaClaudeCode(mission.goal as string, missionId);

    const durationMs = Date.now() - startTime;
    updateMission(missionId, {
      status: 'completed',
      result,
      duration_ms: durationMs,
    });
    addMissionLog(missionId, 'result', result);
    addMissionLog(missionId, 'info', `Mission completed in ${Math.round(durationMs / 1000)}s`);
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errMsg = err instanceof Error ? err.message : String(err);
    updateMission(missionId, {
      status: 'failed',
      result: errMsg,
      duration_ms: durationMs,
    });
    addMissionLog(missionId, 'error', `Mission failed: ${errMsg}`);
  } finally {
    updateAgentStatus(agentId, 'available', null);
  }
}

export function cancelMission(missionId: string): void {
  updateMission(missionId, { status: 'cancelled' });
  addMissionLog(missionId, 'info', 'Mission cancelled');
}

// ── Agent Dispatch (MVP: Claude Code subprocess) ─────────────────────

function executeViaClaudeCode(prompt: string, missionId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      '--print', prompt,
      '--output-format', 'text',
    ];

    // Build env without ANTHROPIC_API_KEY (use Max OAuth)
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;

    addMissionLog(missionId, 'progress', 'Starting Claude Code session...');

    const child = spawn('claude', args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 600_000, // 10 min
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim() || '(no output)');
      } else {
        reject(new Error(`Claude Code exited with code ${code}: ${stderr.trim() || stdout.trim()}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn Claude Code: ${err.message}`));
    });
  });
}

