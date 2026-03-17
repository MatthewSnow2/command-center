import { upsertAgent } from './db.js';

/**
 * Seed default agents into the registry.
 * Phase 3 will replace these with proper A2A agent cards.
 */
export function seedDefaultAgents(): void {
  upsertAgent(
    'claude-code',
    'Claude Code',
    'General-purpose coding and task execution via Claude Code CLI',
    ['coding', 'general', 'ops', 'research', 'content'],
    'stock'
  );
}
