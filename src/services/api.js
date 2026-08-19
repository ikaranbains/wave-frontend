import { apiClient, getApiErrorMessage } from './axiosClient';

export async function loginApi(email, password) {
  try {
    const response = await apiClient.post(
      '/auth/login',
      { email, password },
      { requiresAuth: false }
    );
    return response.data;
  } catch (error) {
    const loginError = new Error(getApiErrorMessage(error, 'Login failed'));
    loginError.retryAfter = Number(error.response?.headers?.['retry-after'] || 0);
    throw loginError;
  }
}

export async function signupApi(name, email, password) {
  try {
    const response = await apiClient.post(
      '/auth/signup',
      { name, email, password },
      { requiresAuth: false }
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Signup failed'));
  }
}

export async function resetPasswordApi(email, backupCode, password) {
  try {
    const response = await apiClient.post(
      '/auth/reset-password',
      { email, backupCode, password },
      { requiresAuth: false }
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Password reset failed'));
  }
}

export async function getMeApi() {
  try {
    const response = await apiClient.get('/auth/me');
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to fetch user session'));
  }
}

export async function logoutApi() {
  try {
    await apiClient.post('/auth/logout');
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to sign out'));
  }
}

export async function getUsersApi(search, signal) {
  try {
    const response = await apiClient.get('/users', {
      params: search ? { search } : undefined,
      signal,
    });
    return response.data;
  } catch (error) {
    if (error.code === 'ERR_CANCELED') throw error;
    throw new Error(getApiErrorMessage(error, 'Failed to fetch directory contacts'));
  }
}

export async function getConversationsApi(signal) {
  try {
    const response = await apiClient.get('/conversations', { signal });
    return response.data;
  } catch (error) {
    if (error.code === 'ERR_CANCELED') throw error;
    throw new Error(getApiErrorMessage(error, 'Failed to fetch conversations'));
  }
}

/**
 * One page of thread history, newest page first. Pass the oldest loaded message's
 * createdAt and id as `before`/`beforeId` to walk further back.
 */
export async function getMessagesApi(conversationId, signal, { limit, before, beforeId } = {}) {
  try {
    const params = {};
    if (limit) params.limit = limit;
    if (before) {
      params.before = before;
      if (beforeId) params.beforeId = beforeId;
    }

    const response = await apiClient.get(`/messages/${conversationId}`, { signal, params });
    return response.data;
  } catch (error) {
    if (error.code === 'ERR_CANCELED') throw error;
    throw new Error(getApiErrorMessage(error, 'Failed to fetch messages'));
  }
}

export async function updateSettingsApi(settings) {
  try {
    const response = await apiClient.patch('/users/me/settings', settings);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to save settings'));
  }
}

export async function startConversationApi(targetUserId) {
  try {
    const response = await apiClient.post('/conversations/start', { targetUserId });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to start conversation'));
  }
}

export async function uploadFileApi(file, onUploadProgress) {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post('/uploads', formData, {
      onUploadProgress: (progressEvent) => {
        if (!progressEvent.total || !onUploadProgress) return;
        onUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to upload file'));
  }
}

export async function signupWithProfileApi({ name, email, password, bio, photo }) {
  try {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('password', password);
    if (bio) formData.append('statusMessage', bio);
    if (photo) formData.append('file', photo);
    const response = await apiClient.post('/auth/signup', formData, { requiresAuth: false });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Signup failed'));
  }
}

export async function uploadAvatarApi(file, onUploadProgress) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/users/me/avatar', formData, {
      onUploadProgress: (progressEvent) => {
        if (!progressEvent.total || !onUploadProgress) return;
        onUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to update profile photo'));
  }
}

export async function deleteMessageApi(messageId) {
  try {
    const response = await apiClient.delete(`/messages/${messageId}`);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to delete message'));
  }
}

/** HTTP send path — used when the socket is unavailable (offline outbox replay). */
export async function sendMessageApi(payload) {
  try {
    const response = await apiClient.post('/messages', payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to send message'));
  }
}

/** Batch replay path for the offline outbox (maximum 10 messages per request). */
export async function sendMessagesBatchApi(messages) {
  try {
    const response = await apiClient.post('/messages/batch', { messages });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to send queued messages'));
  }
}

export async function getPushPublicKeyApi() {
  try {
    const response = await apiClient.get('/push/public-key');
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to read push configuration'));
  }
}

export async function savePushTokenApi(token) {
  try {
    const response = await apiClient.post('/push/subscribe', { token });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to enable push notifications'));
  }
}

export async function deletePushTokenApi(token) {
  try {
    const response = await apiClient.post('/push/unsubscribe', { token });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to disable push notifications'));
  }
}

export async function getCallTokenApi(conversationId) {
  try {
    const response = await apiClient.post('/calls/token', { conversationId });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to join the call'));
  }
}
