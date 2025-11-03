/**
 * Seed script to add 50 basic computer programming questions to the database
 * 
 * Usage:
 *   npm run seed:questions
 * 
 * This script will:
 * - Use an existing user or create a test user if none exists
 * - Create a "Computer Programming" course if it doesn't exist
 * - Create 11 topics covering various programming concepts
 * - Create 50 questions with variants covering different difficulty levels and reasoning types
 * 
 * Questions cover topics:
 * - Variables and Data Types
 * - Control Structures
 * - Functions
 * - Arrays and Lists
 * - Object-Oriented Programming
 * - Data Structures
 * - Algorithms
 * - Error Handling
 * - Strings
 * - Memory Management
 * - Programming Concepts
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Match the same logic as settings.js - go 3 levels up from src/config to project root
// From scripts/seedQuestions.js: 1 level up = backend, 2 levels up = app, 3 levels up = project root
const projectRoot = path.resolve(__dirname, '../../../');

// Load .env from project root (same as settings.js does)
const envPath = path.join(projectRoot, '.env');
console.log(`Loading .env from: ${envPath}`);

const envLoaded = dotenv.config({ path: envPath });

// Also try backend directory as fallback
if (envLoaded.error || !process.env.DATABASE_URL) {
  const backendEnvPath = path.join(__dirname, '../.env');
  console.log(`Trying fallback location: ${backendEnvPath}`);
  dotenv.config({ path: backendEnvPath });
}

// Also try current working directory as last resort
if (!process.env.DATABASE_URL) {
  console.log(`Trying current working directory: ${process.cwd()}`);
  dotenv.config();
}

// Check if DATABASE_URL is loaded (even if dotenv reported an error)
if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL not found in environment variables.');
  console.error('\nChecked locations:');
  console.error(`  1. ${backendEnvPath}`);
  console.error(`  2. ${projectRootEnvPath}`);
  console.error(`  3. Current working directory: ${process.cwd()}`);
  console.error('\nPlease ensure:');
  console.error('  - A .env file exists in one of the locations above');
  console.error('  - The .env file contains: DATABASE_URL=your_connection_string');
  if (envLoaded.error) {
    console.error(`\n  Error details: ${envLoaded.error.message}`);
  }
  process.exit(1);
}

console.log('✅ Environment variables loaded successfully');
console.log(`   DATABASE_URL found (length: ${process.env.DATABASE_URL?.length || 0} characters)`);

// Create sequelize instance first
import { Sequelize, DataTypes } from 'sequelize';

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Define models directly in the script to avoid circular dependencies
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'password_hash'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true
});

const Course = sequelize.define('Course', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { notEmpty: true }
  },
  code: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  tableName: 'courses',
  timestamps: true,
  underscored: true
});

const Topics = sequelize.define('Topics', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { notEmpty: true }
  },
  courseId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'course_id'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  tableName: 'topics',
  timestamps: true,
  underscored: true
});

const Question_Metadata = sequelize.define('Question_Metadata', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('MCQ', 'SA'),
    allowNull: false
  },
  courseId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'course_id'
  },
  primaryTopicId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'primary_topic_id'
  },
  questionOrder: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'question_order'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  tableName: 'question_metadata',
  timestamps: true,
  underscored: true
});

const Variants = sequelize.define('Variants', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  questionText: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'question_text',
    validate: { notEmpty: true }
  },
  difficulty: {
    type: DataTypes.ENUM('easy', 'medium', 'hard'),
    allowNull: false,
    defaultValue: 'medium'
  },
  reasoningLevel: {
    type: DataTypes.ENUM('factual', 'analytical', 'application'),
    allowNull: false,
    defaultValue: 'factual',
    field: 'reasoning_level'
  },
  questionMetadataId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'question_metadata_id'
  },
  assessmentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'assessment_id'
  },
  secondaryTopicsId: {
    type: DataTypes.ARRAY(DataTypes.INTEGER),
    allowNull: true,
    defaultValue: [],
    field: 'secondary_topics_id'
  },
  referenceId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'reference_id'
  },
  answer: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  tableName: 'variants',
  timestamps: true,
  underscored: true
});

// 50 basic computer programming questions
const questions = [
  {
    description: "What is a variable in programming?",
    questionText: "What is a variable in programming?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Variables and Data Types',
    answer: 'A variable is a named storage location that holds a value that can be changed during program execution.'
  },
  {
    description: "What is the difference between == and === in JavaScript?",
    questionText: "What is the difference between == and === in JavaScript?",
    difficulty: 'medium',
    reasoningLevel: 'analytical',
    type: 'MCQ',
    topic: 'Variables and Data Types',
    answer: '== performs type coercion (converts types), while === checks both value and type without coercion.'
  },
  {
    description: "Explain the concept of a constant variable.",
    questionText: "Explain the concept of a constant variable.",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'SA',
    topic: 'Variables and Data Types',
    answer: 'A constant is a variable whose value cannot be changed after it is initialized.'
  },
  {
    description: "What are the primitive data types in most programming languages?",
    questionText: "What are the primitive data types in most programming languages?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Variables and Data Types',
    answer: 'Common primitive types include: integer, float/double, boolean, character, and string.'
  },
  {
    description: "What is type casting?",
    questionText: "What is type casting?",
    difficulty: 'medium',
    reasoningLevel: 'analytical',
    type: 'SA',
    topic: 'Variables and Data Types',
    answer: 'Type casting is the process of converting a value from one data type to another.'
  },
  {
    description: "What is an if statement used for?",
    questionText: "What is an if statement used for?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Control Structures',
    answer: 'An if statement is used to execute code conditionally based on a boolean expression.'
  },
  {
    description: "Write a for loop that prints numbers 1 to 10.",
    questionText: "Write a for loop that prints numbers 1 to 10.",
    difficulty: 'medium',
    reasoningLevel: 'application',
    type: 'SA',
    topic: 'Control Structures',
    answer: 'for (int i = 1; i <= 10; i++) { print(i); }'
  },
  {
    description: "What is the difference between a while loop and a do-while loop?",
    questionText: "What is the difference between a while loop and a do-while loop?",
    difficulty: 'medium',
    reasoningLevel: 'analytical',
    type: 'MCQ',
    topic: 'Control Structures',
    answer: 'A while loop checks the condition before executing, while a do-while loop executes at least once and checks the condition after.'
  },
  {
    description: "What is a switch statement?",
    questionText: "What is a switch statement?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Control Structures',
    answer: 'A switch statement allows a variable to be tested for equality against a list of values.'
  },
  {
    description: "Explain the break statement in loops.",
    questionText: "Explain the break statement in loops.",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'SA',
    topic: 'Control Structures',
    answer: 'The break statement terminates the loop immediately and transfers control to the statement following the loop.'
  },
  {
    description: "What is a function?",
    questionText: "What is a function?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Functions',
    answer: 'A function is a block of code that performs a specific task and can be called multiple times.'
  },
  {
    description: "What is the difference between a function parameter and an argument?",
    questionText: "What is the difference between a function parameter and an argument?",
    difficulty: 'medium',
    reasoningLevel: 'analytical',
    type: 'MCQ',
    topic: 'Functions',
    answer: 'A parameter is a variable in the function definition, while an argument is the actual value passed when calling the function.'
  },
  {
    description: "What is function overloading?",
    questionText: "What is function overloading?",
    difficulty: 'medium',
    reasoningLevel: 'analytical',
    type: 'SA',
    topic: 'Functions',
    answer: 'Function overloading allows multiple functions with the same name but different parameters.'
  },
  {
    description: "What is recursion?",
    questionText: "What is recursion?",
    difficulty: 'medium',
    reasoningLevel: 'analytical',
    type: 'MCQ',
    topic: 'Functions',
    answer: 'Recursion is when a function calls itself to solve a problem by breaking it into smaller subproblems.'
  },
  {
    description: "Write a recursive function to calculate factorial.",
    questionText: "Write a recursive function to calculate factorial of n.",
    difficulty: 'hard',
    reasoningLevel: 'application',
    type: 'SA',
    topic: 'Functions',
    answer: 'function factorial(n) { if (n <= 1) return 1; return n * factorial(n - 1); }'
  },
  {
    description: "What is an array?",
    questionText: "What is an array?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Arrays and Lists',
    answer: 'An array is a data structure that stores a collection of elements of the same type in contiguous memory locations.'
  },
  {
    description: "What is the time complexity of accessing an element in an array by index?",
    questionText: "What is the time complexity of accessing an element in an array by index?",
    difficulty: 'medium',
    reasoningLevel: 'analytical',
    type: 'MCQ',
    topic: 'Arrays and Lists',
    answer: 'O(1) - constant time, because arrays use direct indexing.'
  },
  {
    description: "What is the difference between an array and a linked list?",
    questionText: "What is the difference between an array and a linked list?",
    difficulty: 'medium',
    reasoningLevel: 'analytical',
    type: 'SA',
    topic: 'Arrays and Lists',
    answer: 'Arrays have fixed size and contiguous memory, while linked lists have dynamic size and non-contiguous memory with pointers.'
  },
  {
    description: "What is array indexing?",
    questionText: "What is array indexing?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Arrays and Lists',
    answer: 'Array indexing is the process of accessing elements in an array using their position (usually starting from 0).'
  },
  {
    description: "Explain the concept of a two-dimensional array.",
    questionText: "Explain the concept of a two-dimensional array.",
    difficulty: 'medium',
    reasoningLevel: 'analytical',
    type: 'SA',
    topic: 'Arrays and Lists',
    answer: 'A two-dimensional array is an array of arrays, representing a table or matrix with rows and columns.'
  },
  {
    description: "What is object-oriented programming (OOP)?",
    questionText: "What is object-oriented programming (OOP)?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Object-Oriented Programming',
    answer: 'OOP is a programming paradigm based on objects that contain data (attributes) and code (methods).'
  },
  {
    description: "What are the four pillars of OOP?",
    questionText: "What are the four pillars of OOP?",
    difficulty: 'medium',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Object-Oriented Programming',
    answer: 'Encapsulation, Inheritance, Polymorphism, and Abstraction.'
  },
  {
    description: "What is inheritance?",
    questionText: "What is inheritance?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Object-Oriented Programming',
    answer: 'Inheritance allows a class to inherit properties and methods from another class.'
  },
  {
    description: "What is polymorphism?",
    questionText: "What is polymorphism?",
    difficulty: 'medium',
    reasoningLevel: 'analytical',
    type: 'SA',
    topic: 'Object-Oriented Programming',
    answer: 'Polymorphism allows objects of different types to be treated as objects of a common type through a single interface.'
  },
  {
    description: "What is encapsulation?",
    questionText: "What is encapsulation?",
    difficulty: 'medium',
    reasoningLevel: 'analytical',
    type: 'MCQ',
    topic: 'Object-Oriented Programming',
    answer: 'Encapsulation is the bundling of data and methods that operate on that data within a single unit (class).'
  },
  {
    description: "What is a stack?",
    questionText: "What is a stack?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Data Structures',
    answer: 'A stack is a LIFO (Last In First Out) data structure where elements are added and removed from the top.'
  },
  {
    description: "What is a queue?",
    questionText: "What is a queue?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Data Structures',
    answer: 'A queue is a FIFO (First In First Out) data structure where elements are added at the rear and removed from the front.'
  },
  {
    description: "What is a binary tree?",
    questionText: "What is a binary tree?",
    difficulty: 'medium',
    reasoningLevel: 'analytical',
    type: 'SA',
    topic: 'Data Structures',
    answer: 'A binary tree is a tree data structure where each node has at most two children, referred to as left and right.'
  },
  {
    description: "What is a hash table?",
    questionText: "What is a hash table?",
    difficulty: 'medium',
    reasoningLevel: 'analytical',
    type: 'MCQ',
    topic: 'Data Structures',
    answer: 'A hash table is a data structure that uses a hash function to map keys to values for efficient lookup.'
  },
  {
    description: "What is the time complexity of binary search?",
    questionText: "What is the time complexity of binary search?",
    difficulty: 'medium',
    reasoningLevel: 'analytical',
    type: 'MCQ',
    topic: 'Algorithms',
    answer: 'O(log n) - logarithmic time complexity.'
  },
  {
    description: "What is linear search?",
    questionText: "What is linear search?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Algorithms',
    answer: 'Linear search is a simple algorithm that checks each element sequentially until the target is found.'
  },
  {
    description: "What is the time complexity of bubble sort?",
    questionText: "What is the time complexity of bubble sort?",
    difficulty: 'medium',
    reasoningLevel: 'analytical',
    type: 'MCQ',
    topic: 'Algorithms',
    answer: 'O(n²) - quadratic time complexity in the worst case.'
  },
  {
    description: "Explain the concept of Big O notation.",
    questionText: "Explain the concept of Big O notation.",
    difficulty: 'medium',
    reasoningLevel: 'analytical',
    type: 'SA',
    topic: 'Algorithms',
    answer: 'Big O notation describes the worst-case time or space complexity of an algorithm as a function of input size.'
  },
  {
    description: "What is a sorting algorithm?",
    questionText: "What is a sorting algorithm?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Algorithms',
    answer: 'A sorting algorithm arranges elements of a list in a particular order (ascending or descending).'
  },
  {
    description: "What is exception handling?",
    questionText: "What is exception handling?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Error Handling',
    answer: 'Exception handling is a mechanism to handle runtime errors and prevent program crashes.'
  },
  {
    description: "What is a try-catch block?",
    questionText: "What is a try-catch block?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Error Handling',
    answer: 'A try-catch block is used to catch and handle exceptions that may occur in the try block.'
  },
  {
    description: "What is debugging?",
    questionText: "What is debugging?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Error Handling',
    answer: 'Debugging is the process of finding and fixing errors (bugs) in code.'
  },
  {
    description: "What is a syntax error?",
    questionText: "What is a syntax error?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Error Handling',
    answer: 'A syntax error occurs when code violates the grammar rules of the programming language.'
  },
  {
    description: "What is a runtime error?",
    questionText: "What is a runtime error?",
    difficulty: 'medium',
    reasoningLevel: 'analytical',
    type: 'MCQ',
    topic: 'Error Handling',
    answer: 'A runtime error occurs during program execution, often due to invalid operations or data.'
  },
  {
    description: "What is a string?",
    questionText: "What is a string?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Strings',
    answer: 'A string is a sequence of characters, typically used to represent text.'
  },
  {
    description: "What is string concatenation?",
    questionText: "What is string concatenation?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Strings',
    answer: 'String concatenation is the operation of joining two or more strings together.'
  },
  {
    description: "What is a substring?",
    questionText: "What is a substring?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Strings',
    answer: 'A substring is a contiguous sequence of characters within a string.'
  },
  {
    description: "What is a pointer?",
    questionText: "What is a pointer?",
    difficulty: 'medium',
    reasoningLevel: 'analytical',
    type: 'MCQ',
    topic: 'Memory Management',
    answer: 'A pointer is a variable that stores the memory address of another variable.'
  },
  {
    description: "What is memory allocation?",
    questionText: "What is memory allocation?",
    difficulty: 'medium',
    reasoningLevel: 'analytical',
    type: 'SA',
    topic: 'Memory Management',
    answer: 'Memory allocation is the process of reserving memory space for variables and data structures.'
  },
  {
    description: "What is garbage collection?",
    questionText: "What is garbage collection?",
    difficulty: 'medium',
    reasoningLevel: 'analytical',
    type: 'MCQ',
    topic: 'Memory Management',
    answer: 'Garbage collection is the automatic process of reclaiming memory that is no longer in use.'
  },
  {
    description: "What is a compiler?",
    questionText: "What is a compiler?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Programming Concepts',
    answer: 'A compiler is a program that translates source code written in a high-level language into machine code.'
  },
  {
    description: "What is an interpreter?",
    questionText: "What is an interpreter?",
    difficulty: 'easy',
    reasoningLevel: 'factual',
    type: 'MCQ',
    topic: 'Programming Concepts',
    answer: 'An interpreter executes code directly without compiling it into machine code first.'
  }
];

async function seedQuestions() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    await sequelize.sync();
    console.log('Database connected successfully!');

    // Find an existing user or use the first available user
    let user = await User.findOne({ order: [['id', 'ASC']] });
    if (!user) {
      console.log('No users found. Creating test user...');
      user = await User.create({
        email: 'test@example.com',
        passwordHash: 'dummy_hash_for_seed'
      });
      console.log(`Created test user: ${user.email} (ID: ${user.id})`);
    } else {
      console.log(`Using existing user: ${user.email} (ID: ${user.id})`);
    }

    // Find or create a course
    let course = await Course.findOne({ 
      where: { userId: user.id, name: 'Computer Programming' } 
    });
    if (!course) {
      console.log('Creating Computer Programming course...');
      course = await Course.create({
        name: 'Computer Programming',
        code: 'CS101',
        userId: user.id
      });
    }
    console.log(`Using course: ${course.name} (ID: ${course.id})`);

    // Create topics based on question topics
    const topicNames = [
      'Variables and Data Types',
      'Control Structures',
      'Functions',
      'Arrays and Lists',
      'Object-Oriented Programming',
      'Data Structures',
      'Algorithms',
      'Error Handling',
      'Strings',
      'Memory Management',
      'Programming Concepts'
    ];

    const topicMap = {};
    for (const topicName of topicNames) {
      let topic = await Topics.findOne({ 
        where: { courseId: course.id, name: topicName } 
      });
      if (!topic) {
        topic = await Topics.create({
          name: topicName,
          courseId: course.id
        });
        console.log(`Created topic: ${topicName}`);
      }
      topicMap[topicName] = topic.id;
    }

    // Create questions and variants
    console.log('\nCreating questions...');
    let createdCount = 0;

    for (const q of questions) {
      const topicId = topicMap[q.topic] || topicMap['Programming Concepts'];
      
      // Create question metadata
      const questionMetadata = await Question_Metadata.create({
        description: q.description,
        type: q.type,
        courseId: course.id,
        primaryTopicId: topicId,
        questionOrder: {}
      });

      // Create variant
      await Variants.create({
        questionMetadataId: questionMetadata.id,
        questionText: q.questionText,
        difficulty: q.difficulty,
        reasoningLevel: q.reasoningLevel,
        answer: q.answer || null,
        assessmentId: null,
        secondaryTopicsId: [],
        referenceId: null
      });

      createdCount++;
      if (createdCount % 10 === 0) {
        console.log(`Created ${createdCount} questions...`);
      }
    }

    console.log(`\n✅ Successfully created ${createdCount} questions!`);
    console.log(`Course ID: ${course.id}`);
    console.log(`User ID: ${user.id}`);
    
    await sequelize.close();
    console.log('Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding questions:', error);
    await sequelize.close();
    process.exit(1);
  }
}

// Run the seed script
seedQuestions();

