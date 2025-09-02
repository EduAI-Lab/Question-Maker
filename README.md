# EduQuery.ai

An AI-powered question generation platform that helps educators create high-quality questions from documents and text content. Built with FastAPI, React, and Docker.

## 🚀 Features

- **Document Processing**: Upload and extract text from PDFs, Word documents, PowerPoint presentations, and more
- **AI Question Generation**: Generate questions using multiple AI providers (Groq, OpenAI, DeepSeek)
- **Smart Classification**: Automatic difficulty and Bloom's taxonomy level classification
- **Class Management**: Organize questions by classes and subjects
- **File Storage**: Secure file storage with MinIO
- **Modern UI**: Beautiful React frontend with Tailwind CSS

## 🛠️ Tech Stack

### Backend

- **FastAPI** - Modern Python web framework
- **PostgreSQL** - Primary database
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
- **PostgreSQL 15** - Database
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
DATABASE_URL=postgresql://postgres:postgres@db:5432/eduquery
SECRET_KEY=your-secret-key-here

# MinIO Configuration
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# AI API Keys (Optional - at least one is recommended)
GROQ_API_KEY=your-groq-api-key
OPENAI_API_KEY=your-openai-api-key
DEEPSEEK_API_KEY=your-deepseek-api-key
```

**Note**: You can get API keys from:

- [Groq](https://console.groq.com/) - Free tier available
- [OpenAI](https://platform.openai.com/) - Paid service
- [DeepSeek](https://platform.deepseek.com/) - Free tier available

### 3. Start the Application

```bash
# Development mode (with hot reload)
docker-compose up -d

# Production mode (optimized build)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# View logs (optional)
docker-compose logs -f
```

### 4. Access the Application

- **Frontend**: http://localhost
- **Backend API**: http://localhost/api
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)

## 🔧 Development Setup

### Option 1: Docker Development (Recommended)

The default `docker-compose up -d` runs in development mode with:
- Hot reload for frontend changes
- Volume mounting for source files
- `node_modules` stays in container for better performance

### Option 2: Local Development

#### Backend Development

```bash
# Navigate to backend directory
cd app/backend

# Install Python dependencies
pip install -r requirements.txt

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

### Production Build

```bash
# Build and run in production mode
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## 📁 Project Structure

```
question-maker/
├── app/
│   ├── backend/                 # FastAPI backend
│   │   ├── main.py             # Main application file
│   │   ├── models.py           # Database models
│   │   ├── requirements.txt    # Python dependencies
│   │   ├── Dockerfile          # Backend container config
│   │   ├── utils/              # Utility functions
│   │   └── middleware/         # Authentication middleware
│   └── frontend/               # React frontend
│       ├── src/
│       │   ├── components/     # React components
│       │   ├── lib/           # Utility functions
│       │   └── main.tsx       # App entry point
│       ├── package.json       # Node dependencies
│       └── vite.config.ts     # Vite configuration
├── nginx/                      # Nginx configuration
├── docker-compose.yml          # Docker services
└── README.md                   # This file
```

## 🐳 Docker Services

The application consists of the following services:

### Database (PostgreSQL)

- **Port**: 5432
- **Database**: eduquery
- **User**: postgres
- **Password**: postgres

### MinIO (Object Storage)

- **API Port**: 9000
- **Console Port**: 9001
- **Access Key**: minioadmin
- **Secret Key**: minioadmin

### Backend (FastAPI)

- **Port**: 8000 (internal)
- **Features**: Question generation, file processing, authentication

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

## 🛠️ Configuration

### Environment Variables

| Variable           | Description                  | Default                                           |
| ------------------ | ---------------------------- | ------------------------------------------------- |
| `DATABASE_URL`     | PostgreSQL connection string | `postgresql://postgres:postgres@db:5432/eduquery` |
| `SECRET_KEY`       | JWT secret key               | `change-me`                                       |
| `MINIO_ENDPOINT`   | MinIO server endpoint        | `minio:9000`                                      |
| `MINIO_ACCESS_KEY` | MinIO access key             | `minioadmin`                                      |
| `MINIO_SECRET_KEY` | MinIO secret key             | `minioadmin`                                      |
| `GROQ_API_KEY`     | Groq API key                 | Optional                                          |
| `OPENAI_API_KEY`   | OpenAI API key               | Optional                                          |
| `DEEPSEEK_API_KEY` | DeepSeek API key             | Optional                                          |

### AI Model Configuration

The application supports multiple AI providers for question generation:

1. **Groq** (Recommended for free tier)

   - Model: `llama-3.3-70b-versatile`
   - Fast inference
   - Free tier available

2. **OpenAI**

   - Model: `o3-mini`
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

- [ ] Question templates and customization
- [ ] Export questions to various formats (PDF, Word, etc.)
- [ ] Advanced analytics and reporting
- [ ] Collaborative features for teams
- [ ] Mobile app support
- [ ] Integration with LMS platforms
