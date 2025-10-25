# CI/CD Pipeline Documentation

This document describes the GitHub Actions CI/CD pipeline for the Question Maker application.

## Pipeline Overview

The CI/CD pipeline consists of three separate workflows that run based on different branch triggers to ensure code quality, security, and successful deployment.

## Branch Strategy

```
feature/* → dev → deploy → main
    ↓        ↓       ↓        ↓
  lint/test integration staging production
```

- **`feature/*`** - Development work (linting + testing)
- **`dev`** - Integration branch (testing)
- **`deploy`** - Deployment branch (staging environment)
- **`main`** - Production releases (stable releases only)

## Workflow Files

### 1. Feature Branch CI (`feature-ci.yml`)
- **Triggers**: Push to `feature/*` branches, PRs to `dev`
- **Purpose**: Quick feedback on code quality
- **Jobs**:
  - `lint-and-test` - Linting, testing, security audits
  - `build-and-test-docker` - Docker build validation (PR only)

### 2. Deploy to Staging (`deploy.yml`)
- **Triggers**: Push to `deploy` branch, manual trigger
- **Purpose**: Deploy to staging environment for testing
- **Jobs**:
  - `lint-and-test` - Code quality checks
  - `build-and-test-docker` - Docker validation
  - `deploy-staging` - Deploy to UBC server (staging)

### 3. Production Release (`main.yml`)
- **Triggers**: Push to `main` branch, manual trigger
- **Purpose**: Deploy to production environment
- **Jobs**:
  - `lint-and-test` - Code quality checks
  - `build-and-test-docker` - Docker validation
  - `deploy-production` - Deploy to UBC server (production)

## Workflow Triggers

| Branch | Workflow | Environment | Purpose |
|--------|----------|-------------|---------|
| `feature/*` | `feature-ci.yml` | CI only | Code quality |
| `dev` | `feature-ci.yml` | CI only | Integration testing |
| `deploy` | `deploy.yml` | Staging | Pre-production testing |
| `main` | `main.yml` | Production | Stable releases |

## Jobs Description

### Lint and Test Job
- **Purpose**: Code quality and security enforcement
- **Actions**:
  - ESLint code analysis
  - Unit test execution (Jest + Vitest)
  - Security audit (npm audit)
  - Dependency caching for performance

### Build and Test Docker Job
- **Purpose**: Container build validation
- **Actions**:
  - Docker image builds
  - Docker Compose configuration validation
  - Container startup testing (staging only)
  - Service health verification

### Deploy Jobs
- **Purpose**: Automated deployment to UBC server
- **Actions**:
  - SSH deployment to UBC server
  - Docker Compose orchestration
  - Health check verification
  - Deployment notifications

## Required Secrets

Configure these secrets in your GitHub repository settings:

### Repository Secrets
- `UBC_SERVER_SSH_KEY`: SSH private key for UBC server access
- `DATABASE_URL`: Database connection string
- `OPENAI_API_KEY`: OpenAI API key for AI features
- `EDUAI_API_KEY`: EduAI API key for educational AI features
- `PERSONAL_ACCESS_TOKEN`: GitHub Personal Access Token

### Automatic Secrets
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

## Environment Variables

- `NODE_VERSION`: '20.x' (Node.js version)

## Deployment Process

### Feature Development Flow
1. **Create feature branch**: `git checkout -b feature/new-feature`
2. **Develop and commit**: Make changes, commit to feature branch
3. **Automatic CI**: Linting and testing run automatically
4. **Create PR**: Merge to `dev` branch for integration testing

### Staging Deployment Flow
1. **Merge to deploy**: `git checkout deploy && git merge dev`
2. **Push to deploy**: `git push origin deploy`
3. **Automatic staging**: Deploy to staging environment
4. **Test in staging**: Verify functionality in staging
5. **Health checks**: Pipeline validates deployment success

### Production Release Flow
1. **Merge to main**: `git checkout main && git merge deploy`
2. **Push to main**: `git push origin main`
3. **Automatic production**: Deploy to production environment
4. **Health checks**: Pipeline validates production deployment
5. **Release notification**: Success notification with release info

## Monitoring and Debugging

### View Pipeline Status
- GitHub Actions tab in repository
- Individual workflow logs and outputs
- Real-time execution monitoring

### Common Issues
1. **Build Failures**: Check Dockerfile syntax and dependencies
2. **Test Failures**: Review test output and coverage reports
3. **Deployment Issues**: Check SSH key configuration and server access
4. **Health Check Failures**: Verify application endpoints and server status

### Log Locations
- **GitHub Actions**: Repository Actions tab
- **Server Logs**: `docker compose logs` on UBC server
- **Container Logs**: Individual service logs via Docker

## Performance Optimizations

- **Dependency Caching**: npm packages cached between runs
- **Docker Layer Caching**: Image layers cached for faster builds
- **Parallel Execution**: Jobs run in parallel where possible
- **Workflow Separation**: Different workflows for different purposes

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
4. **Staging First**: Always test in staging before production
5. **Monitoring**: Regular health check monitoring
6. **Documentation**: Keep deployment docs updated

## Troubleshooting

### Pipeline Failures
1. Check workflow logs for specific error messages
2. Verify secret configurations
3. Test Docker builds locally
4. Validate SSH connectivity

### Deployment Issues
1. Check server resource availability
2. Verify container health status
3. Review application logs
4. Test database connectivity

This pipeline ensures reliable, secure, and automated deployment of the Question Maker application with proper staging and production environments.