/**
 * Frontend Environment Configuration
 *
 * This utility handles environment variables for the React/Vite frontend application.
 * In production, these are injected by the build process and available as import.meta.env.
 * In development, they're loaded from .env files.
 */

interface FrontendConfig {
  API_URL: string;
  NODE_ENV: string;
  IS_PRODUCTION: boolean;
  IS_STAGING: boolean;
  IS_DEVELOPMENT: boolean;
}

class FrontendEnvironment {
  private config: FrontendConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): FrontendConfig {
    // In Vite, environment variables are available as import.meta.env
    // These are injected at build time from the container environment
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const nodeEnv =
      import.meta.env.VITE_NODE_ENV || import.meta.env.MODE || "development";

    return {
      API_URL: apiUrl,
      NODE_ENV: nodeEnv,
      IS_STAGING: nodeEnv === "staging",
      IS_PRODUCTION: nodeEnv === "production",
      IS_DEVELOPMENT: nodeEnv === "development" || nodeEnv === "local",
    };
  }

  /**
   * Get the API base URL
   */
  getApiUrl(): string {
    return this.config.API_URL;
  }

  /**
   * Get the current environment
   */
  getEnvironment(): string {
    return this.config.NODE_ENV;
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.config.IS_PRODUCTION;
  }

  /**
   * Check if running in staging
   */
  isStaging(): boolean {
    return this.config.IS_STAGING;
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.config.IS_DEVELOPMENT;
  }

  /**
   * Get full configuration object
   */
  getConfig(): FrontendConfig {
    return { ...this.config };
  }

  /**
   * Get API endpoint URL
   */
  getApiEndpoint(path: string): string {
    const baseUrl = this.getApiUrl().replace(/\/$/, ""); // Remove trailing slash
    const endpoint = path.startsWith("/") ? path : `/${path}`;
    return `${baseUrl}/api${endpoint}`;
  }

  /**
   * Log configuration (for debugging)
   */
  logConfig(): void {
    if (this.isDevelopment()) {
      console.log("Frontend Configuration:", {
        API_URL: this.config.API_URL,
        NODE_ENV: this.config.NODE_ENV,
        IS_PRODUCTION: this.config.IS_PRODUCTION,
        IS_DEVELOPMENT: this.config.IS_DEVELOPMENT,
      });
    }
  }
}

// Export singleton instance
export const env = new FrontendEnvironment();

// Export class for testing
export { FrontendEnvironment };

// Usage examples:
/*
import { env } from './environment';

// Log config in development
env.logConfig();

// Get API URL for requests
const apiUrl = env.getApiUrl();
const loginEndpoint = env.getApiEndpoint('/auth/login');

// Environment checks
if (env.isProduction()) {
  // Production-only code
}

if (env.isDevelopment()) {
  // Development-only code
}

// Make API calls
fetch(env.getApiEndpoint('/users'))
  .then(response => response.json())
  .then(data => console.log(data));
*/
