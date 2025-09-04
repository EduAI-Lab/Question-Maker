# EduQuery.ai – Current Architecture (Monolithic)

![Current System Architecture](images/current-system-architecture.png)

_Simplified monolithic architecture optimized for development and small to medium teams._

---

## Architecture Components

### **1. User Layer**
- Teachers upload educational documents.
- Create/manage classes and exams.
- Review AI-generated questions and validation results.

### **2. Reverse Proxy Layer**
- **Nginx** serving as the single entry point.
- Routes `/` → Frontend, `/api` → Backend.
- Handles CORS and static asset serving.

### **3. Frontend Layer**
- **React 18 + TypeScript SPA** (bundled with Vite).
- Tailwind CSS + Radix UI components.
- Real-time UI updates with streaming progress from backend.
- Communicates only through the Reverse Proxy.

### **4. Backend Layer (Monolithic)**
- **FastAPI (Python)** handling all business logic in a single service.
- Integrated functionality:
  - Authentication (JWT within backend).
  - File processing (PDF, DOCX, PPTX, OCR).
  - AI question generation and validation.
  - Data persistence and retrieval.
  - All microservices functionality in one container.

### **5. Data Layer**
- **PostgreSQL 15**:
  - Users, classes, exams, generated questions, validation metrics.
  - Standard relational data storage.
- **MinIO**:
  - Stores uploaded documents and related assets.
  - Object storage for file management.

---

## Data Flow

1. **Document Upload** → Reverse Proxy → Backend → File Processing → Extracted text stored.
2. **AI Processing** → Backend generates questions using integrated AI services.
3. **Data Storage** → Backend stores all data in PostgreSQL and MinIO.
4. **User Interface** → Frontend displays results and manages interactions.
5. **File Management** → MinIO handles document storage and retrieval.

---

## Key Benefits of Monolithic Architecture

- 🚀 **Simple Deployment**: Single docker-compose file for all services.
- �� **Easy Development**: All code in one place, easier to debug and maintain.
- 📦 **Lower Resource Usage**: No inter-service communication overhead.
- 🎯 **Perfect for Small Teams**: Reduced complexity and faster development cycles.
- ⚡ **Fast Startup**: All services start together, no dependency chains.

---

## Technology Stack Summary

| Layer                | Technology                                   | Purpose                                |
| -------------------- | -------------------------------------------- | -------------------------------------- |
| **Reverse Proxy**    | Nginx                                        | Routing, CORS, static serving          |
| **Frontend**         | React 18 + TypeScript + Vite                 | User interface and interactions        |
| **Backend**          | FastAPI (Python)                             | All business logic and API endpoints   |
| **File Processing**  | PyPDF2, python-docx, python-pptx, Tesseract  | Document parsing and OCR               |
| **Database**         | PostgreSQL 15                                | Structured data storage                |
| **File Storage**     | MinIO                                        | Document and media storage             |
| **Authentication**   | JWT (within backend)                         | User security and access control       |
| **Containerization** | Docker + Docker Compose                      | Development and deployment             |

---

## Current Services

### **Backend Service**
- **File Processing**: PDF, DOCX, PPTX parsing and OCR
- **AI Integration**: Groq, OpenAI, DeepSeek API clients
- **Question Generation**: MCQ, Short Answer, Essay generation
- **Authentication**: JWT-based user management
- **Data Management**: PostgreSQL and MinIO integration

### **Frontend Service**
- **React SPA**: Modern UI with TypeScript
- **Component Library**: Tailwind CSS + Radix UI
- **API Integration**: Axios for backend communication
- **Real-time Updates**: Streaming progress indicators

### **Database Service**
- **PostgreSQL 15**: Primary data storage
- **Schema Management**: SQLAlchemy ORM
- **Data Persistence**: Users, classes, questions, files

### **Storage Service**
- **MinIO**: Object storage for uploaded files
- **File Management**: Document upload and retrieval
- **Media Handling**: PDF, DOCX, PPTX storage

---

## Future Scalability Path

When the application grows, this monolithic architecture can be easily split into microservices:

1. **File Processing Service** → Extract document processing
2. **AI Service** → Extract AI question generation
3. **Question Service** → Extract question management
4. **User Service** → Extract authentication and user management
5. **Storage Service** → Extract file management

The current monolithic approach provides a solid foundation that can evolve into microservices as needed.

---