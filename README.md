# Grammysnaps

A family photo sharing application built with Node.js, TypeScript, and React.

## Documentation

### [Models](./docs/models.md)

### [Routes](./docs/routes.md)

### [Secrets Management](./docs/secrets-management.md)

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL
- AWS CLI configured (for production deployment)

### Local Development

1. Clone the repository
2. Set up environment variables (see [Secrets Management](./docs/secrets-management.md))
3. Install dependencies: `npm install`
4. Start development: `npm run dev`

### Production Deployment

1. Configure AWS credentials
2. Set up secrets in AWS Secrets Manager
3. Deploy infrastructure: `cd aws-infrastructure && terraform apply`
4. Build and deploy containers via GitHub Actions
