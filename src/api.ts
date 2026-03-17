const BASE = '/api';

async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

export const api = {
  listMissions: () => fetchJson<{ missions: unknown[] }>('/missions'),
  getMission: (id: string) => fetchJson<{ mission: unknown; logs: unknown[] }>(`/missions/${id}`),
  createMission: (goal: string) => fetchJson<{ mission: unknown; classification: unknown }>('/missions', {
    method: 'POST',
    body: JSON.stringify({ goal }),
  }),
  approveMission: (id: string) => fetchJson<{ message: string }>(`/missions/${id}/approve`, { method: 'POST' }),
  cancelMission: (id: string) => fetchJson<{ message: string }>(`/missions/${id}/cancel`, { method: 'POST' }),
  listAgents: () => fetchJson<{ agents: unknown[] }>('/agents'),
  getStatus: () => fetchJson<unknown>('/status'),
};
