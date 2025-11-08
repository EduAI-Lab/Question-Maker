// CRITICAL: Load environment variables FIRST before any imports that depend on them
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from the project root (3 levels up from scripts/populateDatabase.js)
const projectRoot = join(__dirname, '../../../');
const envPath = join(projectRoot, '.env');

// Check if .env file exists
if (!existsSync(envPath)) {
  console.error('❌ Error: .env file not found!');
  console.error(`   Expected location: ${envPath}`);
  console.error(`   Project root: ${projectRoot}`);
  console.error('\n   Please create a .env file in the project root directory with DATABASE_URL defined.');
  process.exit(1);
}

// Load environment variables
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('❌ Error loading .env file:', result.error.message);
  process.exit(1);
}

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL is not set in .env file');
  console.error(`   .env file location: ${envPath}`);
  console.error('   Please ensure DATABASE_URL is defined in your .env file.');
  process.exit(1);
}

// If running locally (not in Docker), replace 'postgres' hostname with 'localhost'
// Docker service names only work inside Docker containers
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('@postgres:')) {
  const isDocker = process.env.DOCKER === 'true' || process.env.COMPOSE_PROJECT_NAME;
  
  if (!isDocker) {
    console.log('ℹ️  Running locally - replacing "postgres" hostname with "localhost"');
    process.env.DATABASE_URL = process.env.DATABASE_URL.replace('@postgres:', '@localhost:');
    console.log(`   Using DATABASE_URL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
  }
}

// Import bcrypt (doesn't depend on env vars)
import bcrypt from 'bcryptjs';

// Dynamically import modules that depend on environment variables
// This ensures DATABASE_URL is modified before database.js is loaded
const dbModule = await import('../src/config/database.js');
const schemaModule = await import('../src/schema/index.js');
const { sequelize } = dbModule;
const { User, Course, Topics, Question_Metadata, Assessments, Variants } = schemaModule;

const populateDatabase = async () => {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Sync database schema
    await sequelize.sync({ force: false });
    console.log('Database schema synced.');

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('Clearing existing data...');
    await Variants.destroy({ where: {} });
    await Question_Metadata.destroy({ where: {} });
    await Assessments.destroy({ where: {} });
    await Topics.destroy({ where: {} });
    await Course.destroy({ where: {} });
    await User.destroy({ where: {} });
    console.log('Existing data cleared.');

    // 1. Create Users
    console.log('Creating users...');
    const hashedPassword = await bcrypt.hash('password', 10);
    const users = await User.bulkCreate([
      {
        email: 'a@mail.com',
        passwordHash: hashedPassword
      },
      {
        email: 'b@mail.com',
        passwordHash: hashedPassword
      },
      {
        email: 'c@mail.com',
        passwordHash: hashedPassword
      }
    ]);
    console.log(`Created ${users.length} users.`);

    // 2. Create Courses
    console.log('Creating courses...');
    const courses = await Course.bulkCreate([
      {
        name: 'Machine Architecture',
        code: 'COSC 211',
        userId: users[0].id
      },
      {
        name: 'Computer Programming II',
        code: 'COSC 121',
        userId: users[0].id
      }
    ]);
    console.log(`Created ${courses.length} courses.`);

    // 3. Create Topics
    console.log('Creating topics...');
    const topics = await Topics.bulkCreate([
      // COSC 211 topics
      { name: 'Instruction Set Architectures', courseId: courses[0].id },
      { name: 'Pipeline Design', courseId: courses[0].id },
      { name: 'Cache Coherence Strategies', courseId: courses[0].id },
      { name: 'Memory Hierarchy', courseId: courses[0].id },
      { name: 'Parallel Execution Models', courseId: courses[0].id },
      { name: 'Performance Benchmarking', courseId: courses[0].id },
      
      // COSC 121 topics
      { name: 'Object-Oriented Design', courseId: courses[1].id },
      { name: 'Data Structures Fundamentals', courseId: courses[1].id },
      { name: 'Algorithm Analysis', courseId: courses[1].id },
      { name: 'Testing and Debugging', courseId: courses[1].id },
      { name: 'File I/O and Persistence', courseId: courses[1].id },
      { name: 'Recursion Patterns', courseId: courses[1].id }
    ]);
    console.log(`Created ${topics.length} topics.`);

    // 4. Create Assessments
    console.log('Creating assessments...');
    const assessments = await Assessments.bulkCreate([
      {
        type: 'Midterm',
        name: 'Midterm Exam 1',
        semester: 'Fall 2024'
      },
      {
        type: 'Final',
        name: 'Final Exam',
        semester: 'Fall 2024'
      },
      {
        type: 'Quiz',
        name: 'Quiz 1',
        semester: 'Fall 2024'
      },
      {
        type: 'Assignment',
        name: 'Assignment 1',
        semester: 'Fall 2024'
      },
      {
        type: 'Lab',
        name: 'Lab 1',
        semester: 'Fall 2024'
      }
    ]);
    console.log(`Created ${assessments.length} assessments.`);

    // 5. Create Question_Metadata
    console.log('Creating question metadata...');
    const questionMetadata = await Question_Metadata.bulkCreate([
      // COSC 211 - Machine Architecture questions
      {
        description: 'Understanding instruction set architectures',
        type: 'MCQ',
        courseId: courses[0].id,
        primaryTopicId: topics[0].id,
        questionOrder: { [assessments[0].id]: 1, [assessments[2].id]: 1 }
      },
      {
        description: 'Pipeline design principles',
        type: 'SA',
        courseId: courses[0].id,
        primaryTopicId: topics[1].id,
        questionOrder: { [assessments[0].id]: 2 }
      },
      {
        description: 'Cache coherence strategies',
        type: 'MCQ',
        courseId: courses[0].id,
        primaryTopicId: topics[2].id,
        questionOrder: { [assessments[0].id]: 3 }
      },
      {
        description: 'Memory hierarchy design',
        type: 'SA',
        courseId: courses[0].id,
        primaryTopicId: topics[3].id,
        questionOrder: { [assessments[1].id]: 1 }
      },
      {
        description: 'Parallel execution models',
        type: 'MCQ',
        courseId: courses[0].id,
        primaryTopicId: topics[4].id,
        questionOrder: { [assessments[1].id]: 2 }
      },
      {
        description: 'Performance benchmarking techniques',
        type: 'SA',
        courseId: courses[0].id,
        primaryTopicId: topics[5].id,
        questionOrder: { [assessments[1].id]: 3 }
      },
      // COSC 121 - Computer Programming II questions
      {
        description: 'Object-oriented design principles',
        type: 'MCQ',
        courseId: courses[1].id,
        primaryTopicId: topics[6].id,
        questionOrder: { [assessments[0].id]: 1 }
      },
      {
        description: 'Data structures fundamentals',
        type: 'SA',
        courseId: courses[1].id,
        primaryTopicId: topics[7].id,
        questionOrder: { [assessments[0].id]: 2, [assessments[1].id]: 1 }
      },
      {
        description: 'Algorithm analysis and complexity',
        type: 'MCQ',
        courseId: courses[1].id,
        primaryTopicId: topics[8].id,
        questionOrder: { [assessments[0].id]: 3 }
      },
      {
        description: 'Testing and debugging strategies',
        type: 'SA',
        courseId: courses[1].id,
        primaryTopicId: topics[9].id,
        questionOrder: { [assessments[1].id]: 2 }
      },
      {
        description: 'File I/O and persistence',
        type: 'MCQ',
        courseId: courses[1].id,
        primaryTopicId: topics[10].id,
        questionOrder: { [assessments[1].id]: 3 }
      },
      {
        description: 'Recursion patterns and implementation',
        type: 'SA',
        courseId: courses[1].id,
        primaryTopicId: topics[11].id,
        questionOrder: { [assessments[2].id]: 1 }
      }
    ]);
    console.log(`Created ${questionMetadata.length} question metadata entries.`);

    // 6. Create Variants
    console.log('Creating variants...');
    const variants = await Variants.bulkCreate([
      // Variants for questionMetadata[0] - Instruction Set Architectures
      {
        questionText: 'What is the primary difference between RISC and CISC instruction set architectures?\nA) RISC has more instructions\nB) CISC has simpler instructions\nC) RISC uses simpler, fixed-length instructions\nD) CISC is always faster',
        difficulty: 'medium',
        reasoningLevel: 'factual',
        questionMetadataId: questionMetadata[0].id,
        assessmentId: assessments[0].id,
        answer: 'C) RISC uses simpler, fixed-length instructions'
      },
      {
        questionText: 'Which instruction set architecture typically has a larger number of addressing modes?\nA) RISC\nB) CISC\nC) Both have the same\nD) Neither uses addressing modes',
        difficulty: 'easy',
        reasoningLevel: 'factual',
        questionMetadataId: questionMetadata[0].id,
        assessmentId: assessments[2].id,
        answer: 'B) CISC'
      },
      
      // Variants for questionMetadata[1] - Pipeline Design
      {
        questionText: 'Explain the concept of pipeline hazards and describe the three main types of hazards in pipelined processors.',
        difficulty: 'hard',
        reasoningLevel: 'analytical',
        questionMetadataId: questionMetadata[1].id,
        assessmentId: assessments[0].id,
        answer: 'Pipeline hazards are situations that prevent the next instruction from executing in its designated clock cycle. The three main types are: structural hazards (resource conflicts), data hazards (dependencies between instructions), and control hazards (branch instructions).'
      },
      
      // Variants for questionMetadata[2] - Cache Coherence
      {
        questionText: 'Which cache coherence protocol uses write-invalidate strategy?\nA) MSI\nB) MESI\nC) MOESI\nD) All of the above',
        difficulty: 'medium',
        reasoningLevel: 'analytical',
        questionMetadataId: questionMetadata[2].id,
        assessmentId: assessments[0].id,
        answer: 'D) All of the above'
      },
      
      // Variants for questionMetadata[3] - Memory Hierarchy
      {
        questionText: 'Describe the memory hierarchy and explain why it is designed in this way. Include the typical levels from fastest to slowest.',
        difficulty: 'medium',
        reasoningLevel: 'analytical',
        questionMetadataId: questionMetadata[3].id,
        assessmentId: assessments[1].id,
        answer: 'Memory hierarchy consists of registers (fastest), cache (L1, L2, L3), main memory (RAM), and secondary storage (disk). It is designed to balance speed and cost, with faster but smaller memory closer to the CPU.'
      },
      
      // Variants for questionMetadata[4] - Parallel Execution Models
      {
        questionText: 'What is the difference between SIMD and MIMD parallel execution models?\nA) SIMD uses multiple data streams\nB) MIMD uses single instruction stream\nC) SIMD executes same instruction on multiple data, MIMD executes different instructions\nD) They are the same',
        difficulty: 'medium',
        reasoningLevel: 'analytical',
        questionMetadataId: questionMetadata[4].id,
        assessmentId: assessments[1].id,
        answer: 'C) SIMD executes same instruction on multiple data, MIMD executes different instructions'
      },
      
      // Variants for questionMetadata[5] - Performance Benchmarking
      {
        questionText: 'Explain the difference between throughput and latency in performance benchmarking. Provide an example scenario where each is more important.',
        difficulty: 'hard',
        reasoningLevel: 'analytical',
        questionMetadataId: questionMetadata[5].id,
        assessmentId: assessments[1].id,
        answer: 'Throughput measures the amount of work completed per unit time, while latency measures the time to complete a single task. Throughput is important for batch processing, latency is critical for real-time systems.'
      },
      
      // Variants for questionMetadata[6] - Object-Oriented Design
      {
        questionText: 'Which OOP principle allows a class to inherit properties and methods from another class?\nA) Encapsulation\nB) Inheritance\nC) Polymorphism\nD) Abstraction',
        difficulty: 'easy',
        reasoningLevel: 'factual',
        questionMetadataId: questionMetadata[6].id,
        assessmentId: assessments[0].id,
        answer: 'B) Inheritance'
      },
      
      // Variants for questionMetadata[7] - Data Structures Fundamentals
      {
        questionText: 'Implement a stack data structure with push, pop, and peek operations.',
        difficulty: 'medium',
        reasoningLevel: 'application',
        questionMetadataId: questionMetadata[7].id,
        assessmentId: assessments[0].id,
        answer: 'class Stack { constructor() { this.items = []; } push(item) { this.items.push(item); } pop() { return this.items.pop(); } peek() { return this.items[this.items.length - 1]; } }'
      },
      {
        questionText: 'What is the time complexity of inserting an element at the beginning of a linked list?\nA) O(n)\nB) O(log n)\nC) O(1)\nD) O(n²)',
        difficulty: 'easy',
        reasoningLevel: 'factual',
        questionMetadataId: questionMetadata[7].id,
        assessmentId: assessments[1].id,
        answer: 'C) O(1)'
      },
      
      // Variants for questionMetadata[8] - Algorithm Analysis
      {
        questionText: 'What is the Big-O time complexity of binary search on a sorted array?\nA) O(n)\nB) O(log n)\nC) O(n log n)\nD) O(n²)',
        difficulty: 'easy',
        reasoningLevel: 'factual',
        questionMetadataId: questionMetadata[8].id,
        assessmentId: assessments[0].id,
        answer: 'B) O(log n)'
      },
      
      // Variants for questionMetadata[9] - Testing and Debugging
      {
        questionText: 'Explain the difference between unit testing and integration testing. When would you use each approach?',
        difficulty: 'medium',
        reasoningLevel: 'analytical',
        questionMetadataId: questionMetadata[9].id,
        assessmentId: assessments[1].id,
        answer: 'Unit testing tests individual components in isolation, while integration testing tests how multiple components work together. Use unit tests during development to catch bugs early, and integration tests to verify system behavior.'
      },
      
      // Variants for questionMetadata[10] - File I/O and Persistence
      {
        questionText: 'What is the difference between text mode and binary mode when opening files?\nA) Text mode is faster\nB) Binary mode handles line endings automatically\nC) Text mode handles line endings, binary mode reads raw bytes\nD) They are identical',
        difficulty: 'medium',
        reasoningLevel: 'analytical',
        questionMetadataId: questionMetadata[10].id,
        assessmentId: assessments[1].id,
        answer: 'C) Text mode handles line endings, binary mode reads raw bytes'
      },
      
      // Variants for questionMetadata[11] - Recursion Patterns
      {
        questionText: 'Write a recursive function to calculate the factorial of a number n.',
        difficulty: 'medium',
        reasoningLevel: 'application',
        questionMetadataId: questionMetadata[11].id,
        assessmentId: assessments[2].id,
        answer: 'function factorial(n) { if (n <= 1) return 1; return n * factorial(n - 1); }'
      }
    ]);
    console.log(`Created ${variants.length} variants.`);

    // Create some variant references (self-referencing)
    console.log('Creating variant references...');
    if (variants.length >= 2) {
      // Make variant[1] reference variant[0] (they're variants of the same question)
      await Variants.update(
        { referenceId: variants[0].id },
        { where: { id: variants[1].id } }
      );
      console.log('Created variant reference.');
    }

    console.log('\n✅ Database population completed successfully!');
    console.log(`\nSummary:`);
    console.log(`- Users: ${users.length}`);
    console.log(`- Courses: ${courses.length}`);
    console.log(`- Topics: ${topics.length}`);
    console.log(`- Assessments: ${assessments.length}`);
    console.log(`- Question Metadata: ${questionMetadata.length}`);
    console.log(`- Variants: ${variants.length}`);

  } catch (error) {
    console.error('Error populating database:', error);
    throw error;
  } finally {
    await sequelize.close();
    console.log('\nDatabase connection closed.');
  }
};

// Run the script
populateDatabase()
  .then(() => {
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

