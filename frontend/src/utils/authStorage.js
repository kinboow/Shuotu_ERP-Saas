export function parseStoredJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

export function saveAuthSession(data = {}) {
  const currentState = getStoredAuthState();

  if (data.accessToken) {
    localStorage.setItem('token', data.accessToken);
  }

  if (data.refreshToken) {
    localStorage.setItem('refreshToken', data.refreshToken);
  }

  if (data.user) {
    localStorage.setItem('user', JSON.stringify(data.user));
  }

  localStorage.setItem('permissions', JSON.stringify(data.permissions ?? currentState.permissions ?? []));
  localStorage.setItem('enterprises', JSON.stringify(data.enterprises ?? currentState.enterprises ?? []));
  localStorage.setItem('currentEnterprise', JSON.stringify(data.currentEnterprise ?? currentState.currentEnterprise ?? null));
  localStorage.setItem('pendingJoinRequests', JSON.stringify(data.pendingJoinRequests ?? currentState.pendingJoinRequests ?? []));
  localStorage.setItem('requiresEnterpriseSelection', JSON.stringify(data.requiresEnterpriseSelection ?? currentState.requiresEnterpriseSelection ?? false));
}

export function clearAuthSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('permissions');
  localStorage.removeItem('enterprises');
  localStorage.removeItem('currentEnterprise');
  localStorage.removeItem('pendingJoinRequests');
  localStorage.removeItem('requiresEnterpriseSelection');
}

export function getStoredAuthState() {
  return {
    token: localStorage.getItem('token'),
    refreshToken: localStorage.getItem('refreshToken'),
    user: parseStoredJson('user', null),
    permissions: parseStoredJson('permissions', []),
    enterprises: parseStoredJson('enterprises', []),
    currentEnterprise: parseStoredJson('currentEnterprise', null),
    pendingJoinRequests: parseStoredJson('pendingJoinRequests', []),
    requiresEnterpriseSelection: parseStoredJson('requiresEnterpriseSelection', false)
  };
}
