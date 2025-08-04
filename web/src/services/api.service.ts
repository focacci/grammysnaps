import { env } from "../utils/environment";

// API configuration using environment service
const API_BASE_URL = env.getApiUrl();

// Utility functions for API endpoints
export const getApiEndpoint = (path: string): string => {
  return env.getApiEndpoint(path);
};

// Get environment information
export const getEnvironment = () => ({
  apiUrl: env.getApiUrl(),
  environment: env.getEnvironment(),
  isStaging: env.isStaging(),
  isProduction: env.isProduction(),
  isDevelopment: env.isDevelopment(),
});

// Enhanced fetch wrapper with environment-aware configuration
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const url = env.getApiEndpoint(endpoint);

  // Add default headers
  const defaultHeaders: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Add additional options for development
  const requestOptions: RequestInit = {
    ...options,
    headers: defaultHeaders,
  };

  // Add timeout in development for debugging
  if (env.isDevelopment()) {
    console.log(`API Request: ${options.method || "GET"} ${url}`);
  }

  return fetch(url, requestOptions);
};

export { API_BASE_URL };
