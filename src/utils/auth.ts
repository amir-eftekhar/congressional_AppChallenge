export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('No authentication token found');
    }
  
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };
  
    const response = await fetch(url, { ...options, headers });
  
    if (response.status === 401) {
      // Token is invalid or expired
      localStorage.removeItem('authToken');
      window.location.href = '/auth'; // Redirect to login page
      throw new Error('Authentication failed');
    }
  
    return response;
  };