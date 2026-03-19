import { spawn } from 'child_process';
import {
  listAgents,
  listAgentCapabilities,
  listMissions,
  getOutcomeStats,
  listSchedules,
} from './db.js';

/**
 * Lightweight chat advisor — answers questions about CMD using DB context.
 * Uses a short Claude --print call with injected system context.
 * No agent dispatch, no tool access, max 3 turns.
 */
export async function chatWithData(question: string): Promise<string> {
  const context = buildContext();

  const systemPrompt = `You are Data, the AI orchestrator of Command Center (CMD). You answer questions about the system, its agents, capabilities, missions, and how things work. Be concise and helpful.

You have access to the current system state below. Answer from this context. If the question is about something outside CMD, say so briefly.

If the user is asking you to DO something (build, research, write, deploy, fix) rather than asking a question, respond with:
"That sounds like a mission! Use the Mission input to dispatch it to an agent."

${context}`;

  return runQuickChat(question, systemPrompt);
}

function buildContext(): string {
  const agents = listAgents() as Array<Record<string, unknown>>;
  const capabilities = listAgentCapabilities();
  const missions = listMissions(10);
  const stats = getOutcomeStats() as Array<Record<string, unknown>>;
  const schedules = listSchedules();

  const capMap = new Map(capabilities.map(c => [c.agent_id, c]));

  const agentSummary = agents.map(a => {
    const cap = capMap.get(a.id as string);
    const tier = cap ? `Tier ${cap.tier}` : (a.type === 'custom' ? 'Tier 2' : 'Tier 3');
    const tools = cap ? cap.tools.join(', ') : 'Read, Glob, Grep, Write, Edit, Bash';
    const mcp = cap?.mcp_servers.length ? `, MCP: ${cap.mcp_servers.join(', ')}` : '';
    const subAgents = cap?.can_spawn_sub_agents ? ', can spawn sub-agents' : '';
    return `- ${a.name} (${a.id}) [${tier}, ${a.status}]: ${a.description}. Tools: ${tools}${mcp}${subAgents}`;
  }).join('\n');

  const missionSummary = missions.slice(0, 5).map((m: Record<string, unknown>) => {
    const dur = m.duration_ms ? ` (${Math.round((m.duration_ms as number) / 1000)}s)` : '';
    return `- [${m.status}] ${(m.goal as string).slice(0, 80)} → agent: ${m.agent_id ?? 'none'}${dur}`;
  }).join('\n');

  const statSummary = stats.length > 0
    ? stats.map(s => `- ${s.agent_id}/${s.task_type}: ${s.total} tasks, ${s.successes} succeeded`).join('\n')
    : 'No outcome data yet.';

  const scheduleSummary = schedules.length > 0
    ? schedules.map(s => `- "${s.goal}" every ${s.cron} [${s.enabled ? 'enabled' : 'paused'}]`).join('\n')
    : 'No schedules configured.';

  return `## Current System State

### Agents (${agents.length} registered)
${agentSummary}

### Tier System
- Tier 1 (Named): Persistent A2A agents with dedicated capabilities, MCP servers, learning
- Tier 2 (Custom): User-defined agents with custom system prompts, core tools only
- Tier 3 (Stock): Generic workers from template repos, core tools only

### Recent Missions
${missionSummary || 'No missions yet.'}

### Outcome Stats
${statSummary}

### Schedules
${scheduleSummary}

### Routing
- Intent classification: keyword-based (coding, research, content, ops, general)
- Capability-aware scoring: agents penalized for missing required capabilities (WebSearch, MCP, sub-agents)
- Gap detection: flags when no agent has the needed capability`;
}

function runQuickChat(question: string, systemPrompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      '--print', question,
      '--output-format', 'text',
      '--append-system-prompt', systemPrompt,
      '--max-turns', '3',
    ];

    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;

    const child = spawn('claude', args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim() || '(no response)');
      else reject(new Error(`Chat failed (code ${code}): ${stderr.trim()}`));
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to start chat: ${err.message}`));
    });
  });
}
