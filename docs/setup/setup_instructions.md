## 🚀 Setup Instructions

### Prerequisites

- Docker (version 20.10+)
- Docker Compose (version 2.0+)
- Git

### Quick Start

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd question-maker
   ```

2. **Create environment file**

   ```bash
   cp .env.example .env
   # Edit .env with your preferred ports and API keys
   ```

3. **Start the application**

   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Frontend: http://localhost
   - Backend API: http://localhost/api
   - MinIO Console: http://localhost:9001
   - PostgreSQL: Enter in terminal 
   ```docker-compose exec db psql -U postgres -d eduquery -c "\dt"```

### Custom Port Configuration

To use custom ports, update your `.env` file:

```env
POSTGRES_PORT=5433
NGINX_PORT=8080
MINIO_PORT=9002
MINIO_CONSOLE_PORT=9003
```

Then restart: `docker-compose up -d`

### Environment Variables

```env
# Port Configuration
POSTGRES_PORT=5432
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
NGINX_PORT=80

# Database Configuration
POSTGRES_DB=eduquery
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# MinIO Configuration
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin

# Backend Configuration
SECRET_KEY=change-me

# AI API Keys (Optional)
GROQ_API_KEY=
OPENAI_API_KEY=
DEEPSEEK_API_KEY=

# LMS Integration (Optional)
CANVAS_API_URL=
CANVAS_API_KEY=
MOODLE_API_URL=
MOODLE_API_KEY=
```
