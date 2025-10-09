# CI/CD Pipeline Documentation

This project includes a comprehensive CI/CD pipeline that runs tests and checks for code quality on every push and pull request.

## Pipeline Overview

### Quick CI (`.github/workflows/quick-ci.yml`)
- Runs on every push to `main`/`develop` and PRs
- Fast feedback for developers
- Includes: linting, testing

### Comprehensive CI (`.github/workflows/comprehensive-ci.yml`)
- Runs weekly (Mondays at 2 AM) and can be triggered manually
- Full suite of checks including security audits and Docker builds
- Includes: linting, formatting, testing with coverage, security audit, Docker builds

### Main CI (`.github/workflows/ci.yml`)
- Runs on feature branches and PRs
- Matrix testing across Node.js versions (18.x, 20.x)
- Includes: linting, formatting, testing, coverage reports, Docker builds, security audits

## Available Scripts

### Root Level
```bash
npm run test              # Run all tests
npm run test:backend      # Run backend tests only
npm run test:frontend     # Run frontend tests only
npm run test:coverage     # Run tests with coverage
npm run lint              # Run linting for all projects
npm run lint:fix          # Fix linting issues automatically
npm run format            # Format code with Prettier
npm run format:check      # Check if code is formatted
npm run ci                # Run linting and tests (CI command)
```

### Backend (`app/backend/`)
```bash
npm test                  # Run Jest tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage     # Run tests with coverage
npm run lint              # Run ESLint
npm run lint:fix          # Fix ESLint issues
npm run format            # Format with Prettier
npm run format:check      # Check formatting
```

### Frontend (`app/frontend/`)
```bash
npm test                  # Run Vitest tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage
npm run test:ui           # Run tests with UI
npm run lint              # Run ESLint
npm run lint:fix          # Fix ESLint issues
npm run format            # Format with Prettier
npm run format:check      # Check formatting
```

## Test Structure

### Backend Tests
- Located in `app/tests/backend/`
- Uses Jest with Supertest for API testing
- Configuration: `app/backend/jest.config.js`
- Setup file: `app/tests/setup.js`

### Frontend Tests
- Located in `app/tests/frontend/`
- Uses Vitest with React Testing Library
- Configuration: `app/frontend/vitest.config.ts`
- Setup file: `app/frontend/src/test/setup.ts`

## Code Quality Tools

### ESLint
- Backend: `app/backend/.eslintrc.json`
- Frontend: `app/frontend/.eslintrc.json`
- Global ignore: `.eslintignore`

### Prettier
- Backend: `app/backend/.prettierrc.json`
- Frontend: `app/frontend/.prettierrc.json`
- Global ignore: `.prettierignore`

## Coverage Reports

Coverage reports are generated and can be uploaded to services like Codecov:
- Backend: `app/backend/coverage/lcov.info`
- Frontend: `app/frontend/coverage/lcov.info`

## Running Locally

To run the same checks locally that the CI pipeline runs:

```bash
# Install dependencies
npm install
cd app/backend && npm install
cd ../frontend && npm install

# Run all checks
npm run ci

# Or run individually
npm run lint
npm run test
npm run format:check
```

## Troubleshooting

### Common Issues

1. **ESLint errors**: Run `npm run lint:fix` to auto-fix issues
2. **Prettier formatting**: Run `npm run format` to format code
3. **Test failures**: Check test files in `app/tests/` directory
4. **Docker build failures**: Ensure Docker is running and Dockerfiles are valid

### Environment Setup

Make sure you have:
- Node.js 18.x or 20.x
- npm (comes with Node.js)
- Docker (for Docker-related CI jobs)

## Contributing

When contributing to this project:

1. Make sure all tests pass: `npm run test`
2. Ensure code is properly formatted: `npm run format`
3. Fix any linting issues: `npm run lint:fix`
4. The CI pipeline will run automatically on your PR
5. Address any CI failures before requesting review
