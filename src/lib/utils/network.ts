/**
 * Network Analyzer Utility
 * Detects network status and provides user-friendly error messages
 */

export interface NetworkStatus {
  online: boolean;
  type: 'offline' | 'server-error' | 'timeout' | 'cors' | 'unknown';
  message: string;
  suggestion: string;
}

/**
 * Check if browser is online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Analyze fetch error and return user-friendly message
 */
export function analyzeNetworkError(error: unknown): NetworkStatus {
  const errorMsg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  
  // Check browser online status first
  if (!isOnline()) {
    return {
      online: false,
      type: 'offline',
      message: 'No Internet Connection',
      suggestion: 'Please check your internet connection and try again.',
    };
  }

  // Network/Fetch errors
  if (errorMsg.includes('failed to fetch') || errorMsg.includes('networkerror') || errorMsg.includes('network error')) {
    return {
      online: false,
      type: 'offline',
      message: 'Connection Failed',
      suggestion: 'Unable to reach the server. Check your internet connection or try again later.',
    };
  }

  // Timeout errors
  if (errorMsg.includes('timeout') || errorMsg.includes('timed out') || errorMsg.includes('aborted')) {
    return {
      online: true,
      type: 'timeout',
      message: 'Request Timeout',
      suggestion: 'The server is taking too long to respond. Please try again.',
    };
  }

  // CORS errors
  if (errorMsg.includes('cors') || errorMsg.includes('cross-origin')) {
    return {
      online: true,
      type: 'cors',
      message: 'Access Blocked',
      suggestion: 'The request was blocked by browser security. Try refreshing the page.',
    };
  }

  // Server errors (5xx)
  if (errorMsg.includes('500') || errorMsg.includes('502') || errorMsg.includes('503') || errorMsg.includes('504')) {
    return {
      online: true,
      type: 'server-error',
      message: 'Server Error',
      suggestion: 'Our server is having issues. Please try again in a few minutes.',
    };
  }

  // DNS/Connection refused
  if (errorMsg.includes('dns') || errorMsg.includes('enotfound') || errorMsg.includes('econnrefused')) {
    return {
      online: false,
      type: 'offline',
      message: 'Server Unreachable',
      suggestion: 'Cannot connect to the server. Check your internet or try again later.',
    };
  }

  // Default unknown error
  return {
    online: true,
    type: 'unknown',
    message: 'Something Went Wrong',
    suggestion: 'An unexpected error occurred. Please try again.',
  };
}

/**
 * Check if error is a network-related error
 */
export function isNetworkError(error: unknown): boolean {
  const status = analyzeNetworkError(error);
  return status.type === 'offline' || status.type === 'timeout' || status.type === 'server-error';
}

/**
 * Wrapper for fetch with network error handling
 */
export async function fetchWithNetworkCheck<T>(
  url: string,
  options?: RequestInit
): Promise<{ success: true; data: T } | { success: false; networkError: NetworkStatus }> {
  // Pre-check online status
  if (!isOnline()) {
    return {
      success: false,
      networkError: {
        online: false,
        type: 'offline',
        message: 'No Internet Connection',
        suggestion: 'Please check your internet connection and try again.',
      },
    };
  }

  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      // Server returned error status
      if (response.status >= 500) {
        return {
          success: false,
          networkError: {
            online: true,
            type: 'server-error',
            message: 'Server Error',
            suggestion: 'Our server is having issues. Please try again in a few minutes.',
          },
        };
      }
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      networkError: analyzeNetworkError(error),
    };
  }
}
