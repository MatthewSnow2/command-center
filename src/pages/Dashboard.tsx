import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

interface Mission {
  id: string;
  goal: string;
  status: string;
  created_at: number;
  updated_at: number;
  duration_ms: number | null;
  agent_id: string | null;
}

export function Dashboard() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [goal, setGoal] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMissions = useCallback(() => {
    api.listMissions().then((data) => setMissions(data.missions as Mission[]));
  }, []);

  useEffect(() => {
    loadMissions();
    const interval = setInterval(loadMissions, 5_000);
    return () => clearInterval(interval);
  }, [loadMissions]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await api.createMission(goal.trim());
      setGoal('');
      loadMissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      proposed: 'bg-blue-900 text-blue-300',
      approved: 'bg-indigo-900 text-indigo-300',
      running: 'bg-yellow-900 text-yellow-300',
      completed: 'bg-green-900 text-green-300',
      failed: 'bg-red-900 text-red-300',
      cancelled: 'bg-gray-800 text-gray-400',
    };
    return colors[s] || 'bg-gray-800 text-gray-400';
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const active = missions.filter(m => m.status === 'running' || m.status === 'proposed');
  const completed = missions.filter(m => m.status !== 'running' && m.status !== 'proposed');

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Missions</h1>

      {/* Create Mission */}
      <form onSubmit={handleCreate} className="mb-8">
        <div className="flex gap-3">
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Describe a mission for Data..."
            className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={creating || !goal.trim()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition-colors"
          >
            {creating ? 'Creating...' : 'Create Mission'}
          </button>
        </div>
        {error && <p className="mt-2 text-red-400 text-sm">{error}</p>}
      </form>

      {/* Active Missions */}
      {active.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Active ({active.length})</h2>
          <div className="space-y-2">
            {active.map((m) => (
              <MissionRow key={m.id} mission={m} statusBadge={statusBadge} formatTime={formatTime} />
            ))}
          </div>
        </section>
      )}

      {/* Completed Missions */}
      {completed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">History</h2>
          <div className="space-y-2">
            {completed.map((m) => (
              <MissionRow key={m.id} mission={m} statusBadge={statusBadge} formatTime={formatTime} />
            ))}
          </div>
        </section>
      )}

      {missions.length === 0 && (
        <p className="text-gray-500 text-center py-12">No missions yet. Create one above.</p>
      )}
    </div>
  );
}

function MissionRow({
  mission: m,
  statusBadge,
  formatTime,
}: {
  mission: { id: string; goal: string; status: string; created_at: number; duration_ms: number | null; agent_id: string | null };
  statusBadge: (s: string) => string;
  formatTime: (ts: number) => string;
}) {
  return (
    <Link
      to={`/mission/${m.id}`}
      className="block p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge(m.status)}`}>
          {m.status}
        </span>
        <span className="text-gray-100 flex-1 truncate">{m.goal}</span>
        <span className="text-xs text-gray-500">{formatTime(m.created_at)}</span>
        {m.duration_ms && (
          <span className="text-xs text-gray-500">{Math.round(m.duration_ms / 1000)}s</span>
        )}
        {m.agent_id && (
          <span className="text-xs text-gray-600">{m.agent_id}</span>
        )}
      </div>
    </Link>
  );
}
