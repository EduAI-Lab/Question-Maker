# EduQuery.ai - AI-Powered Question Generation Platform

A modern, full-stack application for generating educational questions using AI. Built with Node.js/Express backend and React frontend with TypeScript.

## 🚀 Features

- **AI-Powered Question Generation**: Support for multiple AI providers (Groq, OpenAI, DeepSeek)
- **Question Management**: Create, edit, delete, and organize questions
- **Class Organization**: Organize questions by classes/courses
- **File Upload**: Upload documents to generate questions automatically
- **Question Classification**: Automatic difficulty and Bloom's taxonomy classification
- **Modern UI**: Clean, responsive interface with dark/light theme support
- **Authentication**: Secure JWT-based authentication
- **Docker Support**: Easy deployment with Docker and Docker Compose

## 🏗️ Architecture

### Backend (Node.js/Express)
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Sequelize ORM
- **Authentication**: JWT + bcrypt
- **AI Integration**: Multiple AI providers with fallback support
- **Security**: Helmet, CORS, rate limiting

### Frontend (React/TypeScript)
- **Framework**: React 18 with TypeScript
- **Routing**: React Router 7
- **UI Components**: Radix UI with Tailwind CSS
- **State Management**: Custom hooks with React Query
- **Theme**: Dark/light mode support
- **Build Tool**: Vite

## 📁 Project Structure

```
eduquery-ai/
├── app/
│   ├── backend/                 # Node.js/Express API
│   │   ├── src/
│   │   │   ├── config/         # Configuration files
│   │   │   ├── models/         # Database models
│   │   │   ├── services/       # Business logic
│   │   │   ├── routes/         # API routes
│   │   │   └── middleware/     # Express middleware
│   │   ├── package.json
│   │   └── Dockerfile
│   └── frontend/               # React application
│       ├── src/
│       │   ├── components/     # React components
│       │   ├── pages/          # Page components
│       │   ├── hooks/          # Custom hooks
│       │   ├── services/       # API services
│       │   └── types/          # TypeScript types
│       ├── package.json
│       └── Dockerfile
├── docker-compose.yml          # Production setup
├── docker-compose.dev.yml      # Development setup
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- PostgreSQL (if running locally)

### Option 1: Docker Compose (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd eduquery-ai
   ```

2. **Set up environment variables**
   ```bash
   # Copy the environment file
   cp .env.example .env
   
   # Edit the file with your API keys
   nano .env
   ```

3. **Start the application**
   ```bash
   # Development
   docker-compose -f docker-compose.dev.yml up -d
   
   # Production
   docker-compose up -d
   ```

4. **Access the application**
   - Frontend: http://localhost:3000 (production) or http://localhost:5173 (development)
   - Backend API: http://localhost:8000

### Option 2: Local Development

1. **Environment Setup**
   ```bash
   # Copy and configure the environment file
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Backend Setup**
   ```bash
   cd app/backend
   npm install
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd app/frontend
   npm install
   npm run dev
   ```

4. **Database Setup**
   - Install PostgreSQL
   - Create a database named `eduquery`
   - Update `DATABASE_URL` in the root `.env` file

## 🔧 Configuration

### Environment Variables

#### Single .env File (Project Root)
```env
# ===========================================
# SHARED CONFIGURATION
# ===========================================
NODE_ENV=development
APP_NAME=EduQuery.ai
APP_VERSION=1.0.0

# ===========================================
# BACKEND CONFIGURATION
# ===========================================
PORT=8000
DATABASE_URL=postgresql://postgres:password@postgres:5432/eduquery
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
GROQ_API_KEY=your-groq-api-key
OPENAI_API_KEY=your-openai-api-key
DEEPSEEK_API_KEY=your-deepseek-api-key

# ===========================================
# FRONTEND CONFIGURATION
# ===========================================
VITE_API_URL=http://localhost:8000
VITE_APP_NAME=EduQuery.ai
VITE_APP_VERSION=1.0.0
```

**Note**: Frontend variables are prefixed with `VITE_` and are exposed to the browser. Backend variables are server-side only.

## 📚 API Documentation

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Questions
- `GET /api/questions` - Get all questions
- `POST /api/questions` - Create a question
- `GET /api/questions/:id` - Get specific question
- `PUT /api/questions/:id` - Update question
- `DELETE /api/questions/:id` - Delete question
- `POST /api/questions/generate` - Generate questions with AI
- `POST /api/questions/approve` - Approve generated questions

### Classes
- `GET /api/classes` - Get all classes
- `POST /api/classes` - Create a class
- `GET /api/classes/:id` - Get specific class
- `PUT /api/classes/:id` - Update class
- `DELETE /api/classes/:id` - Delete class


## 🛠️ Development

### Backend Development
```bash
cd app/backend
npm run dev          # Start development server
npm test            # Run tests
npm run lint        # Lint code
```

### Frontend Development
```bash
cd app/frontend
npm run dev         # Start development server
npm run build       # Build for production
npm run preview     # Preview production build
```

### Database Migrations
```bash
cd app/backend
# The database will be automatically synced in development mode
```

## 🐳 Docker Commands

### Quick Commands (Recommended)
```bash
# Development
npm run dev:up          # Start development containers
npm run dev:down        # Stop development containers
npm run dev:restart     # Restart development containers
npm run dev:logs        # View development logs
npm run dev:build       # Rebuild and start development containers

# Production
npm run prod:up         # Start production containers
npm run prod:down       # Stop production containers
```

### Full Docker Commands
```bash
# Development
docker-compose -f docker-compose.dev.yml up -d
docker-compose -f docker-compose.dev.yml down

# Production
docker-compose up -d
docker-compose down

# View logs
docker-compose logs -f [service-name]

# Rebuild services
docker-compose build [service-name]
```

## 🧪 Testing

```bash
# Backend tests
cd app/backend
npm test

# Frontend tests
cd app/frontend
npm test
```

## 📦 Deployment

### Production Deployment

1. **Set up environment variables**
2. **Build and start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

3. **Configure reverse proxy** (Nginx/Apache)
4. **Set up SSL certificates**
5. **Configure monitoring and logging**

### Environment-specific Configurations

- **Development**: Hot reloading, debug logging
- **Production**: Optimized builds, security headers, rate limiting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API endpoints

## 🔄 Changelog

### v1.0.0
- Initial release
- Node.js/Express backend
- React frontend with TypeScript
- AI question generation
- Class management
- Docker containerization
