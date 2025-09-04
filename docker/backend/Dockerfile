# Lightweight Backend Container (Default)
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# System deps: tesseract, poppler, Java (for Tika), and basic build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr poppler-utils default-jre \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements
COPY docker/backend/requirements.txt ./requirements.txt

# Install Python deps
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy backend code
COPY app/backend/ ./

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
