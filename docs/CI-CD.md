# CI/CD Pipeline Documentation

This document describes the GitHub Actions CI/CD pipeline for the Question Maker application.

## Pipeline Overview

The CI/CD pipeline consists of several jobs that run in parallel and sequence to ensure code quality, security, and successful deployment.

## Workflow Triggers

- **Push to main**: Triggers full pipeline including production deployment
- **Push to dev**: Triggers staging deployment
- **Push to feature branches**: Triggers CI checks only
- **Pull Requests**: Triggers CI checks and Docker testing
- **Manual trigger**: Available via GitHub Actions UI

## Jobs Description

### 1. Linting Jobs (`lint-backend`, `lint-frontend`)
- **Purpose**: Code quality and style enforcement
- **Triggers**: All events
- **Matrix**: Node.js 18.x and 20.x
- **Actions**:
  - ESLint code analysis
  - Prettier formatting checks
  - Dependency caching for performance

### 2. Testing Jobs (`test-backend`, `test-frontend`)
- **Purpose**: Automated testing and coverage reporting
- **Triggers**: All events
- **Matrix**: Node.js 18.x and 20.x
- **Actions**:
  - Unit test execution
  - Coverage report generation
  - Codecov integration for coverage tracking

### 3. Docker Testing (`build-and-test-docker`)
- **Purpose**: Container build validation
- **Triggers**: Pull requests only
- **Actions**:
  - Docker image builds
  - Docker Compose configuration validation
  - Container startup testing
  - Service health verification

### 4. Security Audit (`security-audit`)
- **Purpose**: Dependency vulnerability scanning
- **Triggers**: Pull requests only
- **Actions**:
  - npm audit for backend dependencies
  - npm audit for frontend dependencies
  - Moderate+ severity vulnerability detection

### 5. Database Migration (`database-migration`)
- **Purpose**: Database schema updates
- **Triggers**: Push to main only
- **Dependencies**: Linting and testing jobs
- **Actions**:
  - Sequelize migration execution
  - Migration status verification
  - Production database updates

### 6. Production Deployment (`deploy-production`)
- **Purpose**: Automated production deployment
- **Triggers**: Push to main only
- **Dependencies**: All CI jobs + database migration
- **Actions**:
  - Docker image building and pushing to GitHub Container Registry
  - SSH deployment to UBC server
  - Health check verification
  - Container orchestration

### 7. Staging Deployment (`deploy-staging`)
- **Purpose**: Development environment testing
- **Triggers**: Push to dev branch only
- **Dependencies**: CI jobs (no database migration)
- **Actions**:
  - Development Docker Compose testing
  - Container validation
  - Deployment notification

## Required Secrets

Configure these secrets in your GitHub repository settings:

### Repository Secrets
- `UBC_SERVER_SSH_KEY`: SSH private key for UBC server access
- `DATABASE_URL`: Production database connection string

### Automatic Secrets
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

## Environment Variables

- `NODE_VERSION`: '20.x' (default Node.js version)
- `DOCKER_REGISTRY`: 'ghcr.io' (GitHub Container Registry)

## Docker Registry

Images are pushed to GitHub Container Registry:
- `ghcr.io/[repository]/question-maker-backend`
- `ghcr.io/[repository]/question-maker-frontend`

## Deployment Process

### Production Deployment (main branch)
1. **Code Quality**: Linting and testing
2. **Security**: Vulnerability scanning
3. **Database**: Migration execution
4. **Build**: Docker image creation
5. **Registry**: Image push to GHCR
6. **Deploy**: SSH to UBC server
7. **Verify**: Health check validation

### Staging Deployment (dev branch)
1. **Code Quality**: Linting and testing
2. **Security**: Vulnerability scanning
3. **Test**: Development environment validation
4. **Notify**: Deployment completion

## Monitoring and Debugging

### View Pipeline Status
- GitHub Actions tab in repository
- Individual job logs and outputs
- Real-time execution monitoring

### Common Issues
1. **Build Failures**: Check Dockerfile syntax and dependencies
2. **Test Failures**: Review test output and coverage reports
3. **Deployment Issues**: Check SSH key configuration and server access
4. **Migration Errors**: Verify database connection and migration scripts

### Log Locations
- **GitHub Actions**: Repository Actions tab
- **Server Logs**: `docker compose logs` on UBC server
- **Container Logs**: Individual service logs via Docker

## Performance Optimizations

- **Dependency Caching**: npm packages cached between runs
- **Docker Layer Caching**: Image layers cached for faster builds
- **Parallel Execution**: Jobs run in parallel where possible
- **Matrix Strategy**: Multiple Node.js versions tested efficiently

## Security Considerations

- **Secret Management**: Sensitive data stored in GitHub Secrets
- **SSH Key Rotation**: Regular key updates recommended
- **Dependency Scanning**: Automated vulnerability detection
- **Container Security**: Minimal base images and non-root users

## Rollback Procedures

### Automatic Rollback
- Failed health checks prevent deployment completion
- Previous container versions remain available

### Manual Rollback
```bash
# SSH to UBC server
ssh ssaada08@questionmaker.ok.ubc.ca

# Navigate to project
cd /srv/www/questionmaker.ok.ubc.ca

# Rollback to previous version
git checkout [previous-commit]
docker compose down
docker compose up -d
```

## Best Practices

1. **Branch Protection**: Require CI checks before merging to main
2. **Code Reviews**: Mandatory PR reviews for production changes
3. **Testing**: Comprehensive test coverage before deployment
4. **Monitoring**: Regular health check monitoring
5. **Documentation**: Keep deployment docs updated

## Troubleshooting

### Pipeline Failures
1. Check job logs for specific error messages
2. Verify secret configurations
3. Test Docker builds locally
4. Validate SSH connectivity

### Deployment Issues
1. Check server resource availability
2. Verify container health status
3. Review application logs
4. Test database connectivity

This pipeline ensures reliable, secure, and automated deployment of the Question Maker application.

