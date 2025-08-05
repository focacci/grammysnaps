/**
 * AWS Secrets Manager Helper for Node.js Applications
 *
 * This utility provides easy access to secrets stored in AWS Secrets Manager
 * with fallback to environment variables for local development.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

interface DatabaseSecrets {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  database_url: string;
}

interface AwsCredentials {
  access_key_id: string;
  secret_access_key: string;
  region: string;
  s3_bucket_name: string;
}

interface AppSecrets {
  cors_origins: string;
  vite_api_url: string;
  vite_node_env: string;
  invite_key: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  google_client_id?: string;
  google_client_secret?: string;
  stripe_secret_key?: string;
}

class SecretsManager {
  private client: SecretsManagerClient;
  private projectName: string;
  private environment: string;
  private region: string;
  private cache: Map<string, any> = new Map();

  constructor(
    options: {
      projectName?: string;
      environment?: string;
      region?: string;
    } = {}
  ) {
    this.projectName =
      options.projectName || process.env.PROJECT_NAME || "grammysnaps";
    this.environment = options.environment || process.env.NODE_ENV || "dev";
    this.region = options.region || process.env.AWS_REGION || "us-east-2";

    this.client = new SecretsManagerClient({ region: this.region });
  }

  /**
   * Get a secret from AWS Secrets Manager with caching
   */
  private async getSecret<T = any>(secretName: string): Promise<T> {
    const cacheKey = `${this.projectName}-${this.environment}-${secretName}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: cacheKey,
      });

      const response = await this.client.send(command);

      if (!response.SecretString) {
        throw new Error(`Secret ${cacheKey} has no string value`);
      }

      const secret = JSON.parse(response.SecretString);
      this.cache.set(cacheKey, secret);

      return secret;
    } catch (error) {
      console.error(`Failed to retrieve secret ${cacheKey}:`, error);
      throw error;
    }
  }

  /**
   * Get JWT secret
   */
  async getJwtSecret(): Promise<string> {
    // Fallback to environment variable for local development
    if (process.env.JWT_SECRET) {
      return process.env.JWT_SECRET;
    }

    try {
      const response = await this.client.send(
        new GetSecretValueCommand({
          SecretId: `${this.projectName}-${this.environment}-jwt-secret`,
        })
      );

      return response.SecretString || "";
    } catch (error) {
      console.error("Failed to retrieve JWT secret:", error);
      throw error;
    }
  }

  /**
   * Get database configuration
   */
  async getDatabaseConfig(): Promise<DatabaseSecrets> {
    // Fallback to environment variables for local development
    if (process.env.DATABASE_URL) {
      return {
        host: process.env.DB_HOST || "",
        port: parseInt(process.env.DB_PORT || "5432"),
        database: process.env.DB_NAME || "",
        username: process.env.DB_USER || "",
        password: process.env.DB_PASSWORD || "",
        database_url: process.env.DATABASE_URL,
      };
    }

    return this.getSecret<DatabaseSecrets>("database-secrets");
  }

  /**
   * Get AWS credentials
   */
  async getAwsCredentials(): Promise<AwsCredentials> {
    // Fallback to environment variables for local development
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      return {
        access_key_id: process.env.AWS_ACCESS_KEY_ID,
        secret_access_key: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || this.region,
        s3_bucket_name: process.env.S3_BUCKET_NAME || "",
      };
    }

    return this.getSecret<AwsCredentials>("aws-credentials");
  }

  /**
   * Get application configuration secrets
   */
  async getAppConfig(): Promise<AppSecrets> {
    // Fallback to environment variables for local development
    if (process.env.CORS_ORIGINS) {
      return {
        cors_origins: process.env.CORS_ORIGINS,
        vite_api_url: process.env.VITE_API_URL || "",
        vite_node_env: process.env.VITE_NODE_ENV || "development",
        invite_key: process.env.INVITE_KEY || "",
        smtp_host: process.env.SMTP_HOST,
        smtp_port: process.env.SMTP_PORT
          ? parseInt(process.env.SMTP_PORT)
          : undefined,
        smtp_user: process.env.SMTP_USER,
        smtp_password: process.env.SMTP_PASSWORD,
        google_client_id: process.env.GOOGLE_CLIENT_ID,
        google_client_secret: process.env.GOOGLE_CLIENT_SECRET,
        stripe_secret_key: process.env.STRIPE_SECRET_KEY,
      };
    }

    return this.getSecret<AppSecrets>("app-secrets");
  }

  /**
   * Get invite key for family invitations
   */
  async getInviteKey(): Promise<string> {
    // Fallback to environment variable for local development
    if (process.env.INVITE_KEY) {
      return process.env.INVITE_KEY;
    }

    const appConfig = await this.getAppConfig();
    return appConfig.invite_key;
  }

  /**
   * Initialize all secrets and return configuration object
   */
  async initialize(): Promise<{
    jwt: string;
    database: DatabaseSecrets;
    aws: AwsCredentials;
    app: AppSecrets;
    inviteKey: string;
  }> {
    try {
      const [jwt, database, aws, app, inviteKey] = await Promise.all([
        this.getJwtSecret(),
        this.getDatabaseConfig(),
        this.getAwsCredentials(),
        this.getAppConfig(),
        this.getInviteKey(),
      ]);

      return { jwt, database, aws, app, inviteKey };
    } catch (error) {
      console.error("Failed to initialize secrets:", error);
      throw error;
    }
  }

  /**
   * Clear the cache (useful for testing or credential rotation)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const secretsManager = new SecretsManager();

// Export class for custom instances
export { SecretsManager };

// Example usage:
/*
import { secretsManager } from './secrets-manager';

// Initialize all secrets at app startup
const config = await secretsManager.initialize();

// Use specific secrets
const jwtSecret = await secretsManager.getJwtSecret();
const dbConfig = await secretsManager.getDatabaseConfig();
const awsCredentials = await secretsManager.getAwsCredentials();
const appConfig = await secretsManager.getAppConfig();
const inviteKey = await secretsManager.getInviteKey();

// Setup database connection
const databaseUrl = dbConfig.database_url;

// Setup JWT authentication
const jwt = require('jsonwebtoken');
const token = jwt.sign(payload, jwtSecret);

// Generate family invitation code
const invitationCode = generateInviteCode(inviteKey, familyId);

// Setup S3 client
const s3Client = new S3Client({
  region: awsCredentials.region,
  credentials: {
    accessKeyId: awsCredentials.access_key_id,
    secretAccessKey: awsCredentials.secret_access_key,
  },
});

// Parse CORS origins
const corsOrigins = JSON.parse(appConfig.cors_origins);
*/
