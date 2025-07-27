interface User {
  id: string;
  email: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  birthday?: string;
  families: string[];
  created_at: string;
  updated_at: string;
  profilePicture?: string;
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
  private static instance: AuthService;

  private refreshPromise: Promise<boolean> | null = null;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
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
    const response = await fetch("http://localhost:3000/auth/login", {
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
        await fetch("http://localhost:3000/auth/logout", {
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
      const response = await fetch("http://localhost:3000/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

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

    // Try to use current token first
    try {
      const response = await fetch("http://localhost:3000/auth/validate", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        return `Bearer ${accessToken}`;
      }
    } catch (error) {
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
      const response = await fetch("http://localhost:3000/auth/validate", {
        headers: {
          Authorization: authHeader,
        },
      });

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

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // If we get 401, try to refresh token once
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
}

export default AuthService.getInstance();
