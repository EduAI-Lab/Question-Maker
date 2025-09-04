# EduQuery.ai

An AI-powered question generation platform that helps educators create high-quality questions from documents and text content. Built with FastAPI, React, and Docker.

## 🚀 Features

- **Document Processing**: Upload and extract text from PDFs, Word documents, PowerPoint presentations, and more
- **AI Question Generation**: Generate questions using multiple AI providers (Groq, OpenAI, DeepSeek)
- **Smart Classification**: Automatic difficulty and Bloom's taxonomy level classification
- **Class Management**: Organize questions by classes and subjects
- **File Storage**: Secure file storage with MinIO
- **Vector Search**: pgvector integration for semantic search and embeddings
- **Modern UI**: Beautiful React frontend with Tailwind CSS

## 🛠️ Tech Stack

### Backend

- **FastAPI** - Modern Python web framework
- **PostgreSQL 15 + pgvector** - Primary database with vector search capabilities
- **MinIO** - Object storage for files
- **SQLAlchemy** - ORM for database operations
- **JWT** - Authentication
- **Transformers** - AI model for question classification
- **Multiple AI APIs** - Groq, OpenAI, DeepSeek for question generation

### Frontend

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Radix UI** - Component library
- **Axios** - HTTP client

### Infrastructure

- **Docker & Docker Compose** - Containerization
- **Nginx** - Reverse proxy
- **PostgreSQL 15 + pgvector** - Database with vector extensions
- **MinIO** - Object storage

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- [Docker](https://docs.docker.com/get-docker/) (version 20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (version 2.0+)
- [Git](https://git-scm.com/downloads)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd question-maker
```

### 2. Environment Setup

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
POSTGRES_DB=eduquery
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# MinIO Configuration
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin

# Backend Configuration
SECRET_KEY=change-me # IMPORTANT: Change this to a strong, random key

# AI API Keys (Optional, but required for AI features)
GROQ_API_KEY=
OPENAI_API_KEY=
DEEPSEEK_API_KEY=

# LMS Integration (Optional)
CANVAS_API_URL=
CANVAS_API_KEY=
MOODLE_API_URL=
MOODLE_API_KEY=
```

**Note**: You can get API keys from:

- [Groq](https://console.groq.com/) - Free tier available
- [OpenAI](https://platform.openai.com/) - Paid service
- [DeepSeek](https://platform.deepseek.com/) - Free tier available

### 3. Start the Application

```bash
# Start all services
docker-compose up -d

# View logs (optional)
docker-compose logs -f
```

### 4. Access the Application

- **Frontend**: http://localhost
- **Backend API**: http://localhost/api
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)

## 🔧 Development Setup

### Docker Development (Recommended)

The default `docker-compose up -d` runs in development mode with:

- Hot reload for frontend changes
- Volume mounting for source files
- `node_modules` stays in container for better performance
- pgvector extension enabled for vector search
- Automatic database initialization

### Local Development

#### Backend Development

```bash
# Navigate to backend directory
cd app/backend

# Install Python dependencies
pip install -r docker/backend/requirements.txt

# Run the development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Development

```bash
# Navigate to frontend directory
cd app/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## 📁 Project Structure

```
question-maker/
├── app/
│   ├── backend/                 # FastAPI backend source code
│   │   ├── main.py             # Main application file
│   │   ├── models.py           # Database models
│   │   ├── db/                 # Database initialization
│   │   │   └── init.sql        # pgvector setup and embeddings table
│   │   ├── utils/              # Utility functions
│   │   └── middleware/         # Authentication middleware
│   └── frontend/               # React frontend source code
│       ├── src/
│       │   ├── components/     # React components
│       │   ├── lib/           # Utility functions
│       │   └── main.tsx       # App entry point
│       ├── package.json       # Node dependencies
│       └── vite.config.ts     # Vite configuration
├── docker/                     # Docker configuration
│   ├── backend/               # Backend Dockerfiles and requirements
│   │   ├── Dockerfile         # Backend container
│   │   └── requirements.txt   # All Python dependencies
│   └── frontend/              # Frontend Dockerfiles
│       ├── Dockerfile         # Production build
│       └── Dockerfile.dev     # Development build
├── nginx/                     # Nginx configuration
├── docker-compose.yml         # Main Docker Compose file
├── .env.example              # Environment variables template
└── README.md                 # This file
```

## 🐳 Docker Services

The application consists of the following services:

### Database (PostgreSQL + pgvector)

- **Port**: 5432
- **Database**: eduquery
- **User**: postgres
- **Password**: postgres
- **Features**: Vector search, embeddings storage, automatic initialization

### MinIO (Object Storage)

- **API Port**: 9000
- **Console Port**: 9001
- **Access Key**: minioadmin
- **Secret Key**: minioadmin

### Backend (FastAPI)

- **Port**: 8000 (internal)
- **Features**: Question generation, file processing, authentication, AI integration

### Frontend (React + Vite)

- **Port**: 5173 (internal)
- **Features**: User interface, file upload, question management

### Nginx (Reverse Proxy)

- **Port**: 80
- **Features**: Routes requests to frontend/backend

## 🔑 API Endpoints

### Authentication

- `POST /api/register` - User registration
- `POST /api/login` - User login

### Questions

- `GET /api/questions` - Get user's questions
- `POST /api/questions` - Create a question
- `DELETE /api/questions/{id}` - Delete a question
- `POST /api/generate` - Generate questions from text
- `POST /api/upload` - Upload files and generate questions

### Classes

- `GET /api/classes` - Get user's classes
- `POST /api/classes` - Create a class
- `PUT /api/classes/{id}` - Update a class
- `DELETE /api/classes/{id}` - Delete a class

### Vector Search

- `POST /api/search` - Semantic search using embeddings
- `GET /api/embeddings` - Get stored embeddings

## 🛠️ Configuration

### Environment Variables

| Variable              | Description              | Default      |
| --------------------- | ------------------------ | ------------ |
| `POSTGRES_DB`         | PostgreSQL database name | `eduquery`   |
| `POSTGRES_USER`       | PostgreSQL username      | `postgres`   |
| `POSTGRES_PASSWORD`   | PostgreSQL password      | `postgres`   |
| `SECRET_KEY`          | JWT secret key           | `change-me`  |
| `MINIO_ROOT_USER`     | MinIO access key         | `minioadmin` |
| `MINIO_ROOT_PASSWORD` | MinIO secret key         | `minioadmin` |
| `GROQ_API_KEY`        | Groq API key             | Optional     |
| `OPENAI_API_KEY`      | OpenAI API key           | Optional     |
| `DEEPSEEK_API_KEY`    | DeepSeek API key         | Optional     |
| `CANVAS_API_URL`      | Canvas LMS API URL       | Optional     |
| `CANVAS_API_KEY`      | Canvas LMS API key       | Optional     |
| `MOODLE_API_URL`      | Moodle LMS API URL       | Optional     |
| `MOODLE_API_KEY`      | Moodle LMS API key       | Optional     |

### AI Model Configuration

The application supports multiple AI providers for question generation:

1. **Groq** (Recommended for free tier)

   - Model: `llama-3.3-70b-versatile`
   - Fast inference
   - Free tier available

2. **OpenAI**

   - Model: `gpt-4o-mini`
   - High quality responses
   - Paid service

3. **DeepSeek**
   - Model: `deepseek-coder`
   - Good for technical content
   - Free tier available

## 🚨 Troubleshooting

### Common Issues

1. **Port conflicts**

   ```bash
   # Check if ports are in use
   netstat -tulpn | grep :80
   netstat -tulpn | grep :5432

   # Stop conflicting services or change ports in docker-compose.yml
   ```

2. **Database connection issues**

   ```bash
   # Check if PostgreSQL is running
   docker-compose ps db

   # View database logs
   docker-compose logs db

   # Check if pgvector extension is loaded
   docker-compose exec db psql -U postgres -d eduquery -c "\dx"
   ```

3. **MinIO connection issues**

   ```bash
   # Check MinIO status
   docker-compose ps minio

   # Access MinIO console at http://localhost:9001
   ```

4. **Frontend not loading**

   ```bash
   # Check if Vite dev server is running
   docker-compose logs frontend

   # Restart frontend service
   docker-compose restart frontend
   ```

5. **Database initialization issues**

   ```bash
   # Check if init.sql ran successfully
   docker-compose exec db psql -U postgres -d eduquery -c "\dt"

   # If embeddings table is missing, restart with fresh database
   docker-compose down
   docker volume rm question-maker_postgres_data
   docker-compose up -d
   ```

### Reset Everything

```bash
# Stop all services
docker-compose down

# Remove all containers, networks, and volumes
docker-compose down -v --remove-orphans

# Remove all images (optional)
docker system prune -a

# Start fresh
docker-compose up -d
```

## 📝 Usage

1. **Register/Login**: Create an account or login to access the platform
2. **Create Classes**: Organize your questions by creating classes for different subjects
3. **Upload Documents**: Upload PDFs, Word docs, or PowerPoint files
4. **Generate Questions**: Let AI generate questions from your documents
5. **Review & Edit**: Review generated questions and make adjustments
6. **Organize**: Assign questions to classes and add tags for better organization
7. **Search**: Use semantic search to find similar questions using vector embeddings

## 🏗️ Architecture

This application uses a **monolithic architecture** optimized for development and small to medium teams:

- **Single Backend Container**: All functionality (AI, file processing, authentication) in one service
- **Simple Deployment**: One docker-compose file for all services
- **Easy Development**: All code in one place, easier to debug and maintain
- **Lower Resource Usage**: No inter-service communication overhead
- **Fast Startup**: All services start together

### Future Scalability

When the application grows, this monolithic architecture can be easily split into microservices:

- File Processing Service
- AI Service
- Question Service
- User Service
- Storage Service

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [troubleshooting section](#-troubleshooting)
2. Search existing [GitHub issues](https://github.com/your-repo/issues)
3. Create a new issue with detailed information about your problem

## 🔮 Roadmap

- [x] Basic question generation
- [x] Document processing (PDF, DOCX, PPTX)
- [x] Vector search with pgvector
- [x] Multiple AI provider support
- [x] Class management
- [ ] Question templates and customization
- [ ] Export questions to various formats (PDF, Word, etc.)
- [ ] Advanced analytics and reporting
- [ ] Collaborative features for teams
- [ ] Mobile app support
- [ ] LMS integration (Canvas, Moodle)
- [ ] Real-time collaboration
- [ ] Advanced AI features (AISA, evaluation metrics)
