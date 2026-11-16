// Centralized API Configuration
// Resolves dynamically from localStorage, Vite environment variable, or defaults to http://localhost:5000

const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('api_url') || localStorage.getItem('API_URL');
    if (stored) {
      return stored.replace(/\/+$/, '');
    }
  }

  // Check Vite environment variable if configured
  if (import.meta.env && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }

  return "http://localhost:5000";
};

export const API_URL = getBaseUrl();

/**
 * Resolve the active authenticated user ID for the current browser tab.
 * Prefers tab-scoped sessionStorage so opening another portal in a second tab
 * does not overwrite this tab's identity.
 */
export const getActiveUserId = (): string => {
  if (typeof window === 'undefined') return '1';
  return (
    sessionStorage.getItem('pharma_userId') ||
    localStorage.getItem('pharma_userId') ||
    localStorage.getItem('userId') ||
    '1'
  );
};
