import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';

interface Mission {
  id: string;
  goal: string;
  status: string;
  created_at: number;
  updated_at: number;
  plan: { reasoning: string; subtasks: Array<{ description: string; agent_id: string; status: string }> } | null;
  result: string | null;
  duration_ms: number | null;
  agent_id: string | null;
}

interface Log {
  id: number;
  timestamp: number;
  level: string;
  message: string;
  agent_id: string | null;
}

export function MissionDetail() {
  const { id } = useParams<{ id: string }>();
  const [mission, setMission] = useState<Mission | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    api.getMission(id)
      .then((data) => {
        setMission(data.mission as Mission);
        setLogs(data.logs as Log[]);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3_000);
    return () => clearInterval(interval);
  }, [load]);

  const handleApprove = async () => {
    if (!id) return;
    try {
      await api.approveMission(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    try {
      await api.cancelMission(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (error && !mission) {
    return (
      <div className="max-w-4xl">
        <Link to="/" className="text-blue-400 hover:text-blue-300 text-sm mb-4 inline-block">&larr; Back to missions</Link>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!mission) {
    return <div className="text-gray-500">Loading...</div>;
  }

  const statusColor: Record<string, string> = {
    proposed: 'text-blue-400',
    running: 'text-yellow-400',
    completed: 'text-green-400',
    failed: 'text-red-400',
    cancelled: 'text-gray-500',
  };

  const logLevelIcon: Record<string, string> = {
    info: 'text-blue-400',
    progress: 'text-yellow-400',
    error: 'text-red-400',
    result: 'text-green-400',
  };

  return (
    <div className="max-w-4xl">
      <Link to="/" className="text-blue-400 hover:text-blue-300 text-sm mb-4 inline-block">&larr; Back to missions</Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className={`text-sm font-semibold uppercase ${statusColor[mission.status] ?? 'text-gray-400'}`}>
            {mission.status}
          </span>
          {mission.duration_ms && (
            <span className="text-xs text-gray-500">{Math.round(mission.duration_ms / 1000)}s</span>
          )}
          {mission.agent_id && (
            <span className="text-xs text-gray-600">Agent: {mission.agent_id}</span>
          )}
        </div>
        <h1 className="text-xl font-bold text-gray-100">{mission.goal}</h1>
        <p className="text-xs text-gray-500 mt-1">
          ID: {mission.id} | Created: {new Date(mission.created_at * 1000).toLocaleString()}
        </p>
      </div>

      {/* Actions */}
      {mission.status === 'proposed' && (
        <div className="flex gap-3 mb-6">
          <button
            onClick={handleApprove}
            className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded-lg text-sm font-medium transition-colors"
          >
            Approve & Execute
          </button>
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {(mission.status === 'running') && (
        <div className="flex gap-3 mb-6">
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-red-800 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel Mission
          </button>
        </div>
      )}

      {error && <p className="mb-4 text-red-400 text-sm">{error}</p>}

      {/* Plan */}
      {mission.plan && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Plan</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-300 mb-3">{mission.plan.reasoning}</p>
            {mission.plan.subtasks.map((st, i) => (
              <div key={i} className="flex items-center gap-2 py-1 text-sm">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  st.status === 'completed' ? 'bg-green-500' :
                  st.status === 'running' ? 'bg-yellow-500' :
                  st.status === 'failed' ? 'bg-red-500' : 'bg-gray-500'
                }`} />
                <span className="text-gray-300">{st.description}</span>
                <span className="text-xs text-gray-600 ml-auto">{st.agent_id}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Result */}
      {mission.result && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Result</h2>
          <pre className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-sm text-gray-300 whitespace-pre-wrap overflow-auto max-h-96">
            {mission.result}
          </pre>
        </section>
      )}

      {/* Logs */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Logs ({logs.length})
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-lg divide-y divide-gray-800">
          {logs.map((log) => (
            <div key={log.id} className="px-4 py-2 flex items-start gap-3 text-sm">
              <span className="text-xs text-gray-500 whitespace-nowrap mt-0.5">
                {new Date(log.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={`mt-0.5 ${logLevelIcon[log.level] ?? 'text-gray-400'}`}>
                {log.level === 'info' ? 'i' : log.level === 'progress' ? '>' : log.level === 'error' ? '!' : '*'}
              </span>
              <span className="text-gray-300 flex-1">{log.message}</span>
              {log.agent_id && (
                <span className="text-xs text-gray-600">{log.agent_id}</span>
              )}
            </div>
          ))}
          {logs.length === 0 && (
            <p className="px-4 py-3 text-gray-500 text-sm">No logs yet</p>
          )}
        </div>
      </section>
    </div>
  );
}
