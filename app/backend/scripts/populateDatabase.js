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
        type: 'Quiz',
        name: 'Quiz 2',
        semester: 'Fall 2024'
      },
      {
        type: 'Quiz',
        name: 'Quiz 3',
        semester: 'Fall 2024'
      },
      {
        type: 'Assignment',
        name: 'Assignment 1',
        semester: 'Fall 2024'
      },
      {
        type: 'Assignment',
        name: 'Assignment 2',
        semester: 'Fall 2024'
      },
      {
        type: 'Lab',
        name: 'Lab 1',
        semester: 'Fall 2024'
      },
      {
        type: 'Lab',
        name: 'Lab 2',
        semester: 'Fall 2024'
      },
      {
        type: 'Midterm',
        name: 'Midterm Exam 2',
        semester: 'Winter 2025'
      }
    ]);
    console.log(`Created ${assessments.length} assessments.`);

    // 5. Create Question_Metadata (100 questions)
    console.log('Creating question metadata...');
    
    // Helper function to generate question order for assessments
    const generateQuestionOrder = (questionIndex, totalQuestions) => {
      const order = {};
      // Distribute questions across assessments
      const assessmentIndex = questionIndex % assessments.length;
      const questionNum = Math.floor(questionIndex / assessments.length) + 1;
      order[assessments[assessmentIndex].id] = questionNum;
      // Some questions appear in multiple assessments
      if (questionIndex % 3 === 0 && assessmentIndex + 1 < assessments.length) {
        order[assessments[assessmentIndex + 1].id] = questionNum;
      }
      return order;
    };

    // Generate questions for COSC 211 (Machine Architecture) - 50 questions
    const cosc211Questions = [];
    const cosc211Topics = topics.slice(0, 6); // First 6 topics are COSC 211
    const cosc211QuestionTypes = ['MCQ', 'SA', 'LA'];
    const cosc211Descriptions = [
      // Instruction Set Architectures (8 questions)
      'Understanding instruction set architectures',
      'RISC vs CISC architecture comparison',
      'Instruction formats and encoding',
      'Addressing modes in instruction sets',
      'Instruction set design principles',
      'Load-store architecture concepts',
      'Instruction pipelining basics',
      'Instruction-level parallelism',
      // Pipeline Design (9 questions)
      'Pipeline design principles',
      'Pipeline stages and throughput',
      'Pipeline hazards identification',
      'Data forwarding techniques',
      'Branch prediction strategies',
      'Pipeline optimization methods',
      'Superscalar pipeline design',
      'Out-of-order execution',
      'Pipeline stall handling',
      // Cache Coherence (8 questions)
      'Cache coherence strategies',
      'MESI protocol implementation',
      'Cache consistency models',
      'Snooping vs directory protocols',
      'Write-back vs write-through caches',
      'Cache replacement policies',
      'False sharing prevention',
      'Cache performance optimization',
      // Memory Hierarchy (9 questions)
      'Memory hierarchy design',
      'Cache memory organization',
      'Virtual memory concepts',
      'Page replacement algorithms',
      'TLB (Translation Lookaside Buffer)',
      'Memory access patterns',
      'Cache locality principles',
      'Memory bandwidth optimization',
      'Multi-level cache design',
      // Parallel Execution Models (8 questions)
      'Parallel execution models',
      'SIMD vs MIMD architectures',
      'Vector processing units',
      'Multithreading concepts',
      'Symmetric multiprocessing',
      'Distributed memory systems',
      'Shared memory architectures',
      'GPU computing fundamentals',
      // Performance Benchmarking (8 questions)
      'Performance benchmarking techniques',
      'CPU performance metrics',
      'Cache performance analysis',
      'Memory bandwidth measurement',
      'Benchmark suite design',
      'Performance profiling tools',
      'Amdahl\'s law application',
      'Scalability analysis'
    ];

    for (let i = 0; i < 50; i++) {
      const topicIndex = i % cosc211Topics.length;
      const typeIndex = i % cosc211QuestionTypes.length;
      cosc211Questions.push({
        description: cosc211Descriptions[i] || `COSC 211 Question ${i + 1}`,
        type: cosc211QuestionTypes[typeIndex],
        courseId: courses[0].id,
        primaryTopicId: cosc211Topics[topicIndex].id,
        questionOrder: generateQuestionOrder(i, 50)
      });
    }

    // Generate questions for COSC 121 (Computer Programming II) - 50 questions
    const cosc121Questions = [];
    const cosc121Topics = topics.slice(6, 12); // Last 6 topics are COSC 121
    const cosc121QuestionTypes = ['MCQ', 'SA', 'LA'];
    const cosc121Descriptions = [
      // Object-Oriented Design (9 questions)
      'Object-oriented design principles',
      'Class inheritance and composition',
      'Polymorphism implementation',
      'Encapsulation concepts',
      'Design patterns application',
      'Interface vs abstract classes',
      'SOLID principles',
      'UML class diagrams',
      'Object relationships',
      // Data Structures Fundamentals (9 questions)
      'Data structures fundamentals',
      'Array vs linked list comparison',
      'Stack and queue operations',
      'Binary tree traversal',
      'Hash table implementation',
      'Graph representation methods',
      'Priority queue concepts',
      'Tree balancing techniques',
      'Data structure selection criteria',
      // Algorithm Analysis (8 questions)
      'Algorithm analysis and complexity',
      'Big-O notation calculation',
      'Time vs space complexity trade-offs',
      'Recursive algorithm analysis',
      'Sorting algorithm comparison',
      'Search algorithm efficiency',
      'Dynamic programming concepts',
      'Greedy algorithm design',
      // Testing and Debugging (8 questions)
      'Testing and debugging strategies',
      'Unit test design',
      'Integration testing approaches',
      'Test-driven development',
      'Debugging techniques',
      'Code coverage metrics',
      'Exception handling patterns',
      'Assertion usage',
      // File I/O and Persistence (8 questions)
      'File I/O and persistence',
      'File reading and writing',
      'Serialization concepts',
      'JSON data handling',
      'Database connectivity basics',
      'File format selection',
      'Error handling in I/O',
      'Stream processing',
      // Recursion Patterns (8 questions)
      'Recursion patterns and implementation',
      'Recursive vs iterative solutions',
      'Tail recursion optimization',
      'Recursive data structures',
      'Backtracking algorithms',
      'Divide and conquer patterns',
      'Recursive tree algorithms',
      'Memoization techniques'
    ];

    for (let i = 0; i < 50; i++) {
      const topicIndex = i % cosc121Topics.length;
      const typeIndex = i % cosc121QuestionTypes.length;
      cosc121Questions.push({
        description: cosc121Descriptions[i] || `COSC 121 Question ${i + 1}`,
        type: cosc121QuestionTypes[typeIndex],
        courseId: courses[1].id,
        primaryTopicId: cosc121Topics[topicIndex].id,
        questionOrder: generateQuestionOrder(i + 50, 50)
      });
    }

    const questionMetadata = await Question_Metadata.bulkCreate([
      ...cosc211Questions,
      ...cosc121Questions
    ]);
    console.log(`Created ${questionMetadata.length} question metadata entries.`);

    // 6. Create Variants (at least 1 per question, some have multiple)
    console.log('Creating variants...');
    
    // Helper function to generate question text and answer based on question metadata
    const generateVariant = (qMeta, assessmentId, variantNum = 0) => {
      const difficulties = ['easy', 'medium', 'hard'];
      const reasoningLevels = ['factual', 'analytical', 'application'];
      const difficulty = difficulties[qMeta.id % difficulties.length];
      const reasoningLevel = reasoningLevels[qMeta.id % reasoningLevels.length];
      
      let questionText, answer;
      
      if (qMeta.type === 'MCQ') {
        // Generate MCQ questions
        const questionTemplates = [
          `What is the primary concept related to ${qMeta.description.toLowerCase()}?\nA) Option A\nB) Option B\nC) Option C\nD) Option D`,
          `Which statement best describes ${qMeta.description.toLowerCase()}?\nA) First option\nB) Second option\nC) Third option\nD) Fourth option`,
          `In the context of ${qMeta.description.toLowerCase()}, which is correct?\nA) Answer A\nB) Answer B\nC) Answer C\nD) Answer D`
        ];
        questionText = questionTemplates[variantNum % questionTemplates.length];
        answer = 'B) Option B'; // Default answer
      } else if (qMeta.type === 'LA') {
        // Generate LA (Long Answer) questions
        const questionTemplates = [
          `Discuss ${qMeta.description.toLowerCase()} in depth, including key trade-offs, examples, and its impact on system design.`,
          `Provide a detailed explanation of ${qMeta.description.toLowerCase()}, covering motivations, methodology, and real-world applications.`,
          `Evaluate ${qMeta.description.toLowerCase()} with supporting arguments, counterpoints, and a concise conclusion.`
        ];
        questionText = questionTemplates[variantNum % questionTemplates.length];
        answer = `Comprehensive answer for ${qMeta.description}. Include context, detailed reasoning, comparative analysis, and practical implications.`;
      } else {
        // Generate SA (Short Answer) questions
        const questionTemplates = [
          `Explain ${qMeta.description.toLowerCase()}.`,
          `Describe the key concepts of ${qMeta.description.toLowerCase()}.`,
          `What are the main principles behind ${qMeta.description.toLowerCase()}?`,
          `How does ${qMeta.description.toLowerCase()} work?`,
          `Provide an example of ${qMeta.description.toLowerCase()}.`
        ];
        questionText = questionTemplates[variantNum % questionTemplates.length];
        answer = `Sample answer for ${qMeta.description}. This would contain detailed explanation of the concept, including key points, examples, and relevant details.`;
      }
      
      return {
        questionText,
        difficulty,
        reasoningLevel,
        questionMetadataId: qMeta.id,
        assessmentId,
        answer
      };
    };

    // Generate variants for all questions
    const variantsToCreate = [];
    
    for (let i = 0; i < questionMetadata.length; i++) {
      const qMeta = questionMetadata[i];
      
      // Each question gets at least 1 variant
      // Distribute variants across assessments
      const primaryAssessment = assessments[i % assessments.length];
      variantsToCreate.push(generateVariant(qMeta, primaryAssessment.id, 0));
      
      // Some questions get additional variants (about 30% get 2 variants)
      if (i % 3 === 0 && i < questionMetadata.length - 1) {
        const secondaryAssessment = assessments[(i + 1) % assessments.length];
        variantsToCreate.push(generateVariant(qMeta, secondaryAssessment.id, 1));
      }
    }

    const variants = await Variants.bulkCreate(variantsToCreate);
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
