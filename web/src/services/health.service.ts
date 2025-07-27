import authService from "./auth.service";

export interface HealthStatus {
  api: {
    connected: boolean;
    latency?: number;
    error?: string;
  };
  auth: {
    isLoggedIn: boolean;
    tokenValid?: boolean;
  };
  timestamp: string;
}

class HealthService {
  private static instance: HealthService;
  private lastCheck: HealthStatus | null = null;
  private checkInterval: number | null = null;

  static getInstance(): HealthService {
    if (!HealthService.instance) {
      HealthService.instance = new HealthService();
    }
    return HealthService.instance;
  }

  // Get current health status
  async getHealthStatus(): Promise<HealthStatus> {
    const [apiStatus] = await Promise.all([authService.getConnectionStatus()]);

    const isLoggedIn = authService.isLoggedIn();
    let tokenValid = false;

    if (isLoggedIn) {
      try {
        const authHeader = await authService.getAuthHeader();
        tokenValid = authHeader !== null;
      } catch {
        tokenValid = false;
      }
    }

    const status: HealthStatus = {
      api: apiStatus,
      auth: {
        isLoggedIn,
        tokenValid,
      },
      timestamp: new Date().toISOString(),
    };

    this.lastCheck = status;
    return status;
  }

  // Get last cached status
  getLastStatus(): HealthStatus | null {
    return this.lastCheck;
  }

  // Start periodic health checks
  startMonitoring(intervalMs: number = 30000): void {
    if (this.checkInterval) {
      this.stopMonitoring();
    }

    this.checkInterval = window.setInterval(() => {
      this.getHealthStatus().catch((error) => {
        console.error("Health check failed:", error);
      });
    }, intervalMs);

    // Do initial check
    this.getHealthStatus().catch((error) => {
      console.error("Initial health check failed:", error);
    });
  }

  // Stop periodic health checks
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // Check if API is currently experiencing issues
  hasApiIssues(): boolean {
    if (!this.lastCheck) return false;

    return (
      !this.lastCheck.api.connected ||
      (this.lastCheck.api.latency !== undefined &&
        this.lastCheck.api.latency > 5000)
    );
  }

  // Check if authentication is having issues
  hasAuthIssues(): boolean {
    if (!this.lastCheck) return false;

    return this.lastCheck.auth.isLoggedIn && !this.lastCheck.auth.tokenValid;
  }
}

export default HealthService.getInstance();
