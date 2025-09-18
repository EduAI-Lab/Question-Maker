# Database Schema

The application uses Sequelize ORM with the following four main tables:

## 1. Users Table (users)
- `id` (INTEGER, PRIMARY KEY, AUTO_INCREMENT)
- `email` (STRING, NOT NULL, UNIQUE) - with email validation
- `password_hash` (STRING, NOT NULL) - hashed password
- `created_at` (DATE, NOT NULL, DEFAULT NOW)
- `updated_at` (DATE, NOT NULL, DEFAULT NOW)

## 2. Classes Table (classes)
- `id` (INTEGER, PRIMARY KEY, AUTO_INCREMENT)
- `user_id` (INTEGER, NOT NULL, FOREIGN KEY → users.id)
- `name` (STRING, NOT NULL) - class name
- `subject` (STRING, NOT NULL) - subject area
- `course_code` (STRING, NULLABLE) - course code
- `semester` (STRING, NULLABLE) - semester info
- `year` (INTEGER, NULLABLE) - academic year
- `description` (TEXT, NULLABLE) - class description
- `department` (STRING, NULLABLE) - department
- `created_at` (DATE, NOT NULL, DEFAULT NOW)
- `updated_at` (DATE, NOT NULL, DEFAULT NOW)

## 3. Questions Table (questions)
- `id` (INTEGER, PRIMARY KEY, AUTO_INCREMENT)
- `user_id` (INTEGER, NOT NULL, FOREIGN KEY → users.id)
- `class_id` (INTEGER, NULLABLE, FOREIGN KEY → classes.id)
- `content` (TEXT, NOT NULL) - question content
- `difficulty` (ENUM: 'easy', 'medium', 'hard', DEFAULT 'medium')
- `bloom_level` (ENUM: 'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create', DEFAULT 'understand')
- `created_at` (DATE, NOT NULL, DEFAULT NOW)
- `updated_at` (DATE, NOT NULL, DEFAULT NOW)

## 4. Drafts Table (drafts)
- `id` (INTEGER, PRIMARY KEY, AUTO_INCREMENT)
- `user_id` (INTEGER, NOT NULL, FOREIGN KEY → users.id)
- `class_id` (INTEGER, NULLABLE, FOREIGN KEY → classes.id)
- `content` (TEXT, NOT NULL) - draft content
- `status` (ENUM: 'draft', 'published', 'archived', DEFAULT 'draft')
- `last_edited` (DATE, NOT NULL, DEFAULT NOW)
- `created_at` (DATE, NOT NULL, DEFAULT NOW)
- `updated_at` (DATE, NOT NULL, DEFAULT NOW)

## Relationships

- **User** → **Questions**: One-to-Many (a user can have many questions)
- **User** → **Classes**: One-to-Many (a user can have many classes)
- **User** → **Drafts**: One-to-Many (a user can have many drafts)
- **Class** → **Questions**: One-to-Many (a class can have many questions)
- **Class** → **Drafts**: One-to-Many (a class can have many drafts)

## Key Features

- All tables use **snake_case** for database column names but **camelCase** for JavaScript properties
- **Timestamps** are automatically managed (created_at, updated_at)
- **Foreign key constraints** are properly defined
- **Enum validation** for difficulty levels and Bloom's taxonomy levels
- **Email validation** for user registration
- Questions can optionally belong to a class (class_id is nullable)
- Drafts support different statuses for workflow management
