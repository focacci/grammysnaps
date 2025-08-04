import { getApiEndpoint } from "./api.service";

interface User {
  id: string;
  email: string;
  first_name: string | null;
  middle_name?: string | null;
  last_name: string | null;
  birthday?: string | null;
  families: string[];
  created_at: string;
  updated_at: string;
  profile_picture_url?: string | null;
  profile_picture_thumbnail_url?: string | null;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

class AuthService {
  private static readonly ACCESS_TOKEN_KEY = "access_token";
  private static readonly REFRESH_TOKEN_KEY = "refresh_token";
  private static readonly USER_KEY = "user";
  private static readonly REQUEST_TIMEOUT = 10000; // 10 seconds timeout
  private static instance: AuthService;

  private refreshPromise: Promise<boolean> | null = null;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Log API calls for debugging
  private logApiCall(
    method: string,
    url: string,
    success: boolean,
    duration: number,
    error?: string
  ): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${method} ${url} - ${
      success ? "SUCCESS" : "FAILED"
    } (${duration}ms)`;

    if (success) {
      console.debug(logMessage);
    } else {
      console.error(`${logMessage} - Error: ${error || "Unknown error"}`);
    }
  }

  // Create a fetch wrapper with timeout and retry
  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    retries: number = 2
  ): Promise<Response> {
    const startTime = Date.now();
    const method = options.method || "GET";
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      AuthService.REQUEST_TIMEOUT
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      // Don't retry on successful responses or client errors (4xx)
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        this.logApiCall(
          method,
          url,
          response.ok,
          duration,
          response.ok ? undefined : `HTTP ${response.status}`
        );
        return response;
      }

      // Retry on server errors (5xx) if retries remaining
      if (retries > 0 && response.status >= 500) {
        console.warn(
          `Server error ${response.status}, retrying... (${retries} retries left)`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
        return this.fetchWithTimeout(url, options, retries - 1);
      }

      this.logApiCall(method, url, false, duration, `HTTP ${response.status}`);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (error instanceof Error && error.name === "AbortError") {
        this.logApiCall(method, url, false, duration, "Request timeout");
        throw new Error(
          "Request timeout - please check your network connection"
        );
      }

      // Retry on network errors if retries remaining
      if (retries > 0) {
        console.warn(
          `Network error, retrying... (${retries} retries left)`,
          error
        );
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
        return this.fetchWithTimeout(url, options, retries - 1);
      }

      this.logApiCall(
        method,
        url,
        false,
        duration,
        error instanceof Error ? error.message : "Unknown error"
      );
      throw error;
    }
  }

  // Store tokens securely
  private setTokens(tokens: AuthTokens): void {
    localStorage.setItem(AuthService.ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(AuthService.REFRESH_TOKEN_KEY, tokens.refreshToken);
  }

  private getAccessToken(): string | null {
    return localStorage.getItem(AuthService.ACCESS_TOKEN_KEY);
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem(AuthService.REFRESH_TOKEN_KEY);
  }

  // Check if token is likely expired (basic JWT parsing)
  private isTokenLikelyExpired(token: string): boolean {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return true;

      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);

      // Check if token expires within next 30 seconds
      return payload.exp && payload.exp - now < 30;
    } catch {
      return true; // If we can't parse it, assume it's expired
    }
  }

  private clearTokens(): void {
    localStorage.removeItem(AuthService.ACCESS_TOKEN_KEY);
    localStorage.removeItem(AuthService.REFRESH_TOKEN_KEY);
    localStorage.removeItem(AuthService.USER_KEY);
  }

  // Store user data
  setUser(user: User): void {
    localStorage.setItem(AuthService.USER_KEY, JSON.stringify(user));
  }

  getUser(): User | null {
    const userData = localStorage.getItem(AuthService.USER_KEY);
    if (!userData) return null;

    try {
      return JSON.parse(userData);
    } catch {
      return null;
    }
  }

  // Login method
  async login(email: string, password: string): Promise<User> {
    const response = await this.fetchWithTimeout(getApiEndpoint("/api/auth/login"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Login failed");
    }

    const data: LoginResponse = await response.json();

    // Store tokens and user data
    this.setTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    this.setUser(data.user);

    return data.user;
  }

  // Logout method
  async logout(): Promise<void> {
    const user = this.getUser();

    if (user) {
      try {
        await this.fetchWithTimeout(getApiEndpoint("/api/auth/logout"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId: user.id }),
        });
      } catch (error) {
        console.error("Logout API call failed:", error);
        // Continue with local logout even if API fails
      }
    }

    this.clearTokens();
  }

  // Refresh access token
  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return false;
    }

    try {
      const response = await this.fetchWithTimeout(
        getApiEndpoint("/api/auth/refresh"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken }),
        }
      );

      if (!response.ok) {
        this.clearTokens();
        return false;
      }

      const data: LoginResponse = await response.json();

      this.setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      this.setUser(data.user);

      return true;
    } catch (error) {
      console.error("Token refresh failed:", error);
      this.clearTokens();
      return false;
    }
  }

  // Get authorization header for API calls
  async getAuthHeader(): Promise<string | null> {
    let accessToken = this.getAccessToken();

    if (!accessToken) {
      return null;
    }

    // Check if token is likely expired before making validation request
    if (this.isTokenLikelyExpired(accessToken)) {
      console.debug("Token appears expired, attempting refresh");

      if (this.refreshPromise) {
        await this.refreshPromise;
      } else {
        this.refreshPromise = this.refreshAccessToken();
        const refreshSuccess = await this.refreshPromise;
        this.refreshPromise = null;

        if (!refreshSuccess) {
          return null;
        }
      }

      accessToken = this.getAccessToken();
      return accessToken ? `Bearer ${accessToken}` : null;
    }

    // Try to use current token first
    try {
      const response = await this.fetchWithTimeout(
        getApiEndpoint("/api/auth/validate"),
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        return `Bearer ${accessToken}`;
      }
    } catch {
      console.debug("Token validation failed, attempting refresh");
    }

    // If validation fails, try to refresh
    if (this.refreshPromise) {
      await this.refreshPromise;
    } else {
      this.refreshPromise = this.refreshAccessToken();
      const refreshSuccess = await this.refreshPromise;
      this.refreshPromise = null;

      if (!refreshSuccess) {
        return null;
      }
    }

    accessToken = this.getAccessToken();
    return accessToken ? `Bearer ${accessToken}` : null;
  }

  // Validate current session
  async validateSession(): Promise<User | null> {
    const authHeader = await this.getAuthHeader();
    if (!authHeader) {
      return null;
    }

    try {
      const response = await this.fetchWithTimeout(
        getApiEndpoint("/api/auth/validate"),
        {
          headers: {
            Authorization: authHeader,
          },
        }
      );

      if (!response.ok) {
        this.clearTokens();
        return null;
      }

      const data = await response.json();
      this.setUser(data.user);
      return data.user;
    } catch (error) {
      console.error("Session validation failed:", error);
      this.clearTokens();
      return null;
    }
  }

  // Make authenticated API calls
  async apiCall(url: string, options: RequestInit = {}): Promise<Response> {
    const authHeader = await this.getAuthHeader();

    if (!authHeader) {
      throw new Error("Not authenticated");
    }

    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
      Authorization: authHeader,
    };

    const response = await this.fetchWithTimeout(url, {
      ...options,
      headers,
    });

    // If we get 401, try to refresh token once
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (response.status === 401 && !(options.headers as any)?.["X-Retry"]) {
      const newAuthHeader = await this.getAuthHeader();
      if (newAuthHeader && newAuthHeader !== authHeader) {
        // Retry with new token
        return this.apiCall(url, {
          ...options,
          headers: {
            ...options.headers,
            "X-Retry": "true",
          },
        });
      }
    }

    return response;
  }

  // Check if user is logged in
  isLoggedIn(): boolean {
    return this.getAccessToken() !== null && this.getUser() !== null;
  }

  // Check API connectivity
  async checkConnectivity(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(getApiEndpoint("/api/health"), {
        method: "GET",
      });
      return response.ok;
    } catch (error) {
      console.error("API connectivity check failed:", error);
      return false;
    }
  }

  // Get connection status with details
  async getConnectionStatus(): Promise<{
    connected: boolean;
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();
    try {
      const response = await this.fetchWithTimeout(getApiEndpoint("/api/health"), {
        method: "GET",
      });
      const latency = Date.now() - startTime;

      if (response.ok) {
        return { connected: true, latency };
      } else {
        return { connected: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        connected: false,
        latency,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export default AuthService.getInstance();
