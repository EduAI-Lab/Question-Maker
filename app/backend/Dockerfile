FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# System deps: tesseract, poppler, Java (for Tika), and basic build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr poppler-utils default-jre \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# Keep this relative because the code imports assume running from backend dir
WORKDIR /app/app/backend

COPY app/backend/requirements.txt ./requirements.txt

# Install Python deps (torch is heavy; this uses CPU wheels from PyPI)
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy backend
COPY app/backend/ ./
# Ensure utils and models are in this context (they are within backend)

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]