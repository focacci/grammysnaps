# Database Migration Script Debugging Guide

## 🐛 Migration Script Issues Fixed

### ✅ **Issues Resolved:**

1. **Missing Node.js types** - Added proper imports
2. **Better error handling** - More detailed error messages
3. **Environment variable validation** - Clear feedback on missing variables
4. **Connection debugging** - Shows connection details for troubleshooting
5. **Graceful cleanup** - Properly closes database connections

### 🚀 **How to Use the Migration Script**

#### Option 1: Local PostgreSQL Database

1. **Set up local PostgreSQL**:

   ```bash
   # Install PostgreSQL (macOS)
   brew install postgresql

   # Install PostgreSQL (Ubuntu)
   sudo apt-get install postgresql postgresql-contrib

   # Start PostgreSQL service
   brew services start postgresql  # macOS
   sudo service postgresql start   # Ubuntu
   ```

2. **Create database and user**:

   ```sql
   sudo -u postgres psql
   CREATE DATABASE grammysnaps_dev;
   CREATE USER grammysnaps_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE grammysnaps_dev TO grammysnaps_user;
   \q
   ```

3. **Create `.env` file** in the `api/` directory:

   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Run migration**:
   ```bash
   npm run migrate
   ```

#### Option 2: Docker PostgreSQL (Recommended for Testing)

1. **Run the test script**:

   ```bash
   npm run test-migrate
   ```

   This will:

   - Start a PostgreSQL container
   - Run the migration
   - Clean up automatically

#### Option 3: AWS RDS (Production)

When deploying to AWS, the migration will run automatically via ECS with environment variables from Parameter Store.

### 🔍 **Debugging Common Issues**

#### Issue: "Missing required environment variables"

**Solution**: Create a `.env` file in the `api/` directory:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=grammysnaps_dev
DB_USER=your_username
DB_PASSWORD=your_password
NODE_ENV=development
```

#### Issue: "Connection refused" or "Connection timeout"

**Solutions**:

1. **Check if PostgreSQL is running**:

   ```bash
   # Check if PostgreSQL is running
   brew services list | grep postgresql  # macOS
   sudo service postgresql status        # Ubuntu
   ```

2. **Check connection settings**:

   ```bash
   # Test connection manually
   psql -h localhost -p 5432 -U your_username -d grammysnaps_dev
   ```

3. **Check firewall/network settings**

#### Issue: "Authentication failed"

**Solutions**:

1. **Verify credentials** in `.env` file
2. **Check PostgreSQL user permissions**:
   ```sql
   sudo -u postgres psql
   \du  -- List users and their permissions
   ```

#### Issue: "Database does not exist"

**Solution**: Create the database first:

```sql
sudo -u postgres psql
CREATE DATABASE grammysnaps_dev;
```

### 🧪 **Testing the Migration**

#### Manual Testing with Docker:

```bash
# Start test database
docker run --name test-db -d \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=test \
  -p 5432:5432 \
  postgres:16

# Set environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=test
export DB_USER=test
export DB_PASSWORD=test

# Run migration
npm run migrate

# Verify tables were created
docker exec -it test-db psql -U test -d test -c "\dt"

# Cleanup
docker stop test-db && docker rm test-db
```

### 📝 **Migration Script Features**

#### Environment Variable Loading:

- Automatically loads `.env` file if present
- Graceful fallback if dotenv not available
- Clear validation and error messages

#### Connection Details:

- Shows connection information for debugging
- Masked password for security
- Connection status feedback

#### Error Handling:

- Detailed error messages
- Stack traces for debugging
- Graceful cleanup on failure

#### Schema Features:

- UUID support with `uuid-ossp` extension
- Proper foreign key relationships
- Indexes for performance
- Automatic `updated_at` triggers
- Comprehensive table structure for the application

### 🔄 **Running Migration in Different Environments**

#### Development:

```bash
npm run migrate
```

#### Testing:

```bash
npm run test-migrate
```

#### AWS ECS (Production):

```bash
aws ecs run-task \
  --cluster grammysnaps-cluster \
  --task-definition grammysnaps-api \
  --overrides '{
    "containerOverrides": [{
      "name": "api",
      "command": ["npm", "run", "migrate"]
    }]
  }'
```

### 🛠️ **Troubleshooting Commands**

```bash
# Check if migration script can be executed
npm run migrate --dry-run

# Check database connection
psql postgresql://user:password@host:port/database

# List all tables after migration
psql -d your_database -c "\dt"

# Check specific table structure
psql -d your_database -c "\d users"

# View migration logs
docker logs container_name  # For Docker deployments
aws logs tail /ecs/grammysnaps-api  # For AWS ECS
```

The migration script is now much more robust and provides clear feedback for debugging any issues you might encounter!
