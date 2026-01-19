# Question Maker - System Description

This document describes the unique features of the Question Maker system, an AI-powered educational platform for creating, managing, and deploying assessment questions and assignments.

> **System Overview Diagram**: See [System Overview Diagram](diagrams/system-overview.md) for a visual representation of system components and flows.

## Table of Contents

1. [RAG Course-Aware Context](#rag-course-aware-context)
2. [Question Management](#question-management)
3. [Assignment/Quiz Management](#assignmentquiz-management)
4. [Canvas LMS Integration](#canvas-lms-integration)
5. [AI/LLM Integration](#aillm-integration)

---

## RAG Course-Aware Context

The system implements **Retrieval-Augmented Generation (RAG)** to ground all AI responses in course-specific materials. This unique feature ensures AI-generated content aligns with actual course materials, minimizing hallucinations.

### Key Features

- **Course-Specific Vector Database**: Each course maintains its own PGVector index with isolated embeddings
- **Automatic Context Retrieval**: All AI requests automatically include relevant course material context
- **Source Citations**: Responses include citations showing which documents informed the generation
- **Multi-Provider RAG**: Works seamlessly with Ollama, Google Gemini, and OpenAI while maintaining course context

### Use Cases

- **Course-Aware Question Generation**: Questions are generated using relevant course material sections
- **Contextual Chat**: Chat responses are grounded in actual course documents
- **Smart Question Extraction**: PDF imports use course context for better topic assignment and categorization

---

## Question Management

### AI-Assisted Question Generation

- **RAG-Enhanced Generation**: Questions are generated using course material context via RAG
- **Automatic Metadata**: AI assigns difficulty, Bloom's taxonomy level, reasoning level, and topics
- **Answer Generation**: AI generates correct answers for all question types (MCQ, SA, LA)
- **Multi-Provider Support**: Works with Ollama, Google Gemini, and OpenAI

### Human-in-the-Loop Review

- **Draft System**: All AI-generated questions are saved as drafts requiring instructor review
- **Batch Review**: Multiple questions can be reviewed and approved simultaneously
- **Export Gating**: System prevents export until all drafts are finalized

### PDF Import with OCR and AI Review

- **OCR Processing**: Extracts text from PDFs (pdfjs-dist) and images (Tesseract.js)
- **AI-Powered Extraction**: Uses course-aware RAG to extract questions with metadata
- **Intelligent Topic Assignment**: Automatically assigns primary and secondary topics based on course structure
- **Review Interface**: Instructors review, edit, and approve extracted questions before saving
- **Assessment Integration**: Extracted questions can be directly added to assessments with automatic section creation

### Question Variants

- **AI Variant Generation**: Generate variants of existing questions using AI
- **Variant Selection**: Select specific variants when building assessments

---

## Assignment/Quiz Management

### Topic-Based Question Selection with Exclusion

- **Primary Topics**: Select topics that must be included in the assessment
- **Secondary Topics**: Select topics that may be included
- **Excluded Topics**: Explicitly exclude specific topics from appearing in the assessment
- **Section-Level Filters**: Each section can have its own topic inclusion/exclusion rules

### Intelligent Question Matching

- **Multi-Criteria Filtering**: Questions matched by primary/secondary topics, difficulty, reasoning level, and type
- **Exclusion Enforcement**: Questions with excluded topics are automatically filtered out
- **Variant Selection**: Choose which variant of a question to use in each section
- **Visual Matching Interface**: Browse and select questions that match section criteria

### Assessment Structure

- **Section-Based Organization**: Assessments organized into logical sections
- **Per-Section Configuration**: Each section has independent topic, difficulty, and reasoning filters
- **Question Distribution**: Configure difficulty and reasoning level distributions across sections

---

## Canvas LMS Integration

### Assessment Export to Canvas

- **Direct Export**: Export assessments directly to Canvas courses as quizzes
- **Question Conversion**: Automatically converts MCQ, SA, and LA questions to Canvas format
- **Section Preservation**: Maintains question ordering and section structure
- **Draft Validation**: Prevents export until all question drafts are finalized
- **Course Mapping**: Maps local courses to Canvas courses for future exports

---

## AI/LLM Integration

### Multi-Provider Support

- **Ollama (Local)**: Privacy-focused local AI with no API costs
- **Google Gemini**: Fast, cost-effective question generation
- **OpenAI**: High-quality question generation

### EduAI Service Integration

- **RAG-Enhanced Requests**: All AI requests automatically include course context via RAG
- **Streaming Support**: Real-time response streaming for chat interactions
- **Structured Output**: Enforces structured JSON responses for question generation

### Unique Features

- **Course-Aware Generation**: All AI operations use course material context
- **Provider Selection**: Users can select AI provider per request
- **Client-Side API Keys**: Provider API keys managed in browser (except Canvas)
