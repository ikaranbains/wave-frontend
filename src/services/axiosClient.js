import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export function getApiErrorMessage(error, fallbackMessage = 'Request failed') {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.error ||
      error.response?.data?.details?.[0]?.message ||
      (error.code === 'ECONNABORTED' ? 'Backend server request timed out' : null) ||
      error.message ||
      fallbackMessage
    );
  }

  return error instanceof Error ? error.message : fallbackMessage;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('pingme:unauthorized'));
    }

    return Promise.reject(error);
  }
);
