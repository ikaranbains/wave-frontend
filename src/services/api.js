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

export async function getMessagesApi(conversationId, signal) {
  try {
    const response = await apiClient.get(`/messages/${conversationId}`, { signal });
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

export async function getPushPublicKeyApi() {
  try {
    const response = await apiClient.get('/push/public-key');
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to read push configuration'));
  }
}

export async function savePushSubscriptionApi(subscription) {
  try {
    const response = await apiClient.post('/push/subscribe', { subscription });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to enable push notifications'));
  }
}

export async function deletePushSubscriptionApi(endpoint) {
  try {
    const response = await apiClient.post('/push/unsubscribe', { endpoint });
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
