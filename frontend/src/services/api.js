const API_BASE = '/api';

export function getStoredToken() {
  return localStorage.getItem('disk_session_token') || '';
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem('disk_session_token', token);
  } else {
    localStorage.removeItem('disk_session_token');
  }
}

async function request(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Set default JSON Content-Type only if not sending FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Clear expired credentials
    setStoredToken('');
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    const errorData = await response.json().catch(() => ({}));
    const msg = typeof errorData.detail === 'string' ? errorData.detail : 'Session expired. Please re-authenticate.';
    throw new Error(msg);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: `Error: ${response.statusText}` }));
    let message = 'Request failed';
    if (typeof errorData.detail === 'string') {
      message = errorData.detail;
    } else if (Array.isArray(errorData.detail)) {
      message = errorData.detail.map(e => `${e.loc ? e.loc.filter(x => x !== 'body').join('.') + ': ' : ''}${e.msg}`).join('; ');
    } else if (errorData.detail && typeof errorData.detail === 'object') {
      message = errorData.detail.message || errorData.detail.msg || JSON.stringify(errorData.detail);
    } else if (typeof errorData.message === 'string') {
      message = errorData.message;
    } else {
      message = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(message);
  }

  // Handle binary / empty content
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await response.json();
  }
  return response;
}

export const api = {
  // Auth
  async getSetupStatus() {
    return request('/auth/status');
  },
  async setupFirstAdmin(username) {
    return request('/auth/setup-admin', {
      method: 'POST',
      body: JSON.stringify({ username, role: 'admin' }),
    });
  },
  async login(key) {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ key }),
    });
    setStoredToken(res.session_token);
    return res;
  },
  async logout() {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken('');
    }
  },
  async getMe() {
    return request('/auth/me');
  },

  // Files
  async listFiles({ path = '', category = null, search = '', sortBy = 'name', sortOrder = 'asc', limit = 60, offset = 0, disk = null }) {
    const params = new URLSearchParams();
    if (path) params.set('path', path);
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    if (sortBy) params.set('sort_by', sortBy);
    if (sortOrder) params.set('sort_order', sortOrder);
    if (limit) params.set('limit', limit);
    if (offset) params.set('offset', offset);
    if (disk) params.set('disk', disk);
    return request(`/files?${params.toString()}`);
  },

  getDownloadUrl(path, disk = null, inline = false) {
    const token = getStoredToken();
    let url = `${API_BASE}/files/download?path=${encodeURIComponent(path)}&token=${encodeURIComponent(token)}`;
    if (disk) url += `&disk=${encodeURIComponent(disk)}`;
    if (inline) url += `&inline=true`;
    return url;
  },

  getThumbnailUrl(path, disk = null) {
    const token = getStoredToken();
    let url = `${API_BASE}/files/thumbnail?path=${encodeURIComponent(path)}&token=${encodeURIComponent(token)}`;
    if (disk) url += `&disk=${encodeURIComponent(disk)}`;
    return url;
  },

  async downloadZip(paths, disk = null) {
    const token = getStoredToken();
    const res = await fetch(`${API_BASE}/files/download-zip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ paths, disk }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'ZIP generation failed');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `disk_archive_${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return blob;
  },

  async uploadDirect(targetPath, file, onProgress = null, disk = null) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('target_path', targetPath);
      if (disk) formData.append('disk', disk);

      xhr.open('POST', `${API_BASE}/files/upload`);
      const token = getStoredToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.detail || 'Upload failed'));
          } catch {
            reject(new Error(`Upload error ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });
  },

  // Chunked upload for large multi-GB files
  async uploadChunked(file, targetPath = '', onProgress = null, disk = null) {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunkBlob = file.slice(start, end);

      const formData = new FormData();
      formData.append('upload_id', uploadId);
      formData.append('chunk_index', i.toString());
      formData.append('total_chunks', totalChunks.toString());
      formData.append('filename', file.name);
      formData.append('target_path', targetPath);
      if (disk) formData.append('disk', disk);
      formData.append('chunk', chunkBlob, file.name);

      await request('/files/upload-chunk', {
        method: 'POST',
        body: formData,
      });

      if (onProgress) {
        const percent = Math.round(((i + 1) / totalChunks) * 100);
        onProgress(percent);
      }
    }
    return { completed: true, filename: file.name };
  },

  async mkdir(currentPath, folderName, disk = null) {
    return request('/files/mkdir', {
      method: 'POST',
      body: JSON.stringify({ current_path: currentPath, folder_name: folderName, disk }),
    });
  },

  async rename(oldPath, newName, disk = null) {
    return request('/files/rename', {
      method: 'PATCH',
      body: JSON.stringify({ old_path: oldPath, new_name: newName, disk }),
    });
  },

  async deleteItems(paths, disk = null) {
    return request('/files/delete', {
      method: 'POST',
      body: JSON.stringify({ paths, disk }),
    });
  },

  // System & Diagnostics
  async getSystemStatus(disk = null) {
    const url = disk ? `/system/status?disk=${encodeURIComponent(disk)}` : '/system/status';
    return request(url);
  },
  async getExternalDisks() {
    return request('/system/external-disks');
  },
  async refreshExternalDisks() {
    return request('/system/external-disks/refresh', { method: 'POST' });
  },
  async selectExternalDisk(driveLetter) {
    return request('/system/external-disks/select', {
      method: 'POST',
      body: JSON.stringify({ drive_letter: driveLetter }),
    });
  },
  async getTunnelStatus() {
    return request('/tunnel/status');
  },
  async startTunnel(token = null) {
    return request('/tunnel/start', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },
  async stopTunnel() {
    return request('/tunnel/stop', {
      method: 'POST',
    });
  },
  async getNetworkDetails() {
    return request('/system/network');
  },
  async toggleRemoteMode(enabled) {
    return request('/admin/remote-mode', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  },

  // Admin User Management
  async getUsers() {
    return request('/admin/users');
  },
  async createUser(username, role = 'user') {
    return request('/admin/users', {
      method: 'POST',
      body: JSON.stringify({ username, role }),
    });
  },
  async revokeUserKey(userId) {
    return request(`/admin/users/${userId}/revoke`, {
      method: 'POST',
    });
  },
  async deleteUser(userId) {
    return request(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  },
  async getAuditLogs(limit = 100, offset = 0) {
    return request(`/admin/audit-logs?limit=${limit}&offset=${offset}`);
  },
};
