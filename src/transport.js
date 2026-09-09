/** HTTP client for the local sandbox. Errors carry the HTTP status. */
export function createClient(base = '') {
  async function call(route, data) {
    const response = await fetch(`${base}/api${route}`, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const value = await response.json();
    if (!response.ok) throw Object.assign(new Error(value.error || 'Transport failed'), { status: response.status });
    return value;
  }
  const key = encodeURIComponent;
  return {
    listRequests: () => call('/requests'), request: value => call('/requests', value),
    acknowledge: id => call(`/requests/${key(id)}/ack`, {}), complete: id => call(`/requests/${key(id)}/complete`, {}),
    simulateTimeout: id => call(`/requests/${key(id)}/timeout`, {}), routeMI: value => call('/mi', value),
    createProfile: (id, preferences) => call('/profiles', { id, preferences }), getProfile: id => call(`/profiles/${key(id)}`),
    updateProfile: (id, preferences, expectedVersion) => call(`/profiles/${key(id)}/update`, { preferences, expectedVersion }),
    revokeProfile: (id, expectedVersion) => call(`/profiles/${key(id)}/revoke`, { expectedVersion }),
    exportProfile: id => call(`/profiles/${key(id)}/export`), importProfile: value => call('/profiles/import', typeof value === 'string' ? JSON.parse(value) : value)
  };
}
