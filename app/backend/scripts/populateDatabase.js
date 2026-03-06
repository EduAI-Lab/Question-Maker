/**
 * Seeds the application database with sample users, courses, topics, assessments, and variants.
 * Loads environment variables from the project root and normalizes the DATABASE_URL for local vs Docker runs before touching Sequelize.
 */
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

// If running on host (not in Docker), replace 'postgres' with 'localhost' and use host-published port.
// Docker publishes postgres as 55432:5432 in production; from the host we must use 55432.
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('@postgres:')) {
  const isDocker = process.env.DOCKER === 'true' || process.env.COMPOSE_PROJECT_NAME;
  if (!isDocker) {
    const hostPort = process.env.POSTGRES_HOST_PORT || '55432';
    console.log(`ℹ️  Running on host - connecting to localhost:${hostPort} (set POSTGRES_HOST_PORT if different)`);
    process.env.DATABASE_URL = process.env.DATABASE_URL.replace('@postgres:5432', `@localhost:${hostPort}`);
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
const {
  User,
  Course,
  Topics,
  Question_Metadata,
  Assessments,
  Variants,
  SectionVariants,
  AssessmentSections,
  CanvasIntegration,
  CanvasCourseMapping
} = schemaModule;

/**
 * Connects to the database, clears existing records, and inserts the predefined seed dataset.
 * Emits progress logs for each stage so developers can verify connection, schema sync, and entity creation.
 */
const populateDatabase = async () => {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Sync database schema
    await sequelize.sync({ force: false });
    console.log('Database schema synced.');

    // Clear existing data (optional - comment out if you want to keep existing data)
    // Order matters: clear tables that reference others first (child tables before parent).
    console.log('Clearing existing data...');
    await SectionVariants.destroy({ where: {} });
    await Variants.destroy({ where: {} });
    await AssessmentSections.destroy({ where: {} });
    await Question_Metadata.destroy({ where: {} });
    await Assessments.destroy({ where: {} });
    await Topics.destroy({ where: {} });
    await CanvasCourseMapping.destroy({ where: {} });
    await CanvasIntegration.destroy({ where: {} });
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
      },
      {
        name: 'Introduction to Statistics',
        code: 'STUDY1',
        userId: users[0].id
      },
      {
        name: 'Discrete Math',
        code: 'STUDY3',
        userId: users[0].id
      },
      {
        name: 'Introduction to Psychology',
        code: 'STUDY2',
        userId: users[0].id
      },
      {
        name: 'Introduction to Nursing',
        code: 'STUDY4',
        userId: users[0].id
      },
      {
        name: 'Scientific Research Methods',
        code: 'STUDY5',
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
      { name: 'Other', courseId: courses[0].id },
      
      // COSC 121 topics
      { name: 'Object-Oriented Design', courseId: courses[1].id },
      { name: 'Data Structures Fundamentals', courseId: courses[1].id },
      { name: 'Algorithm Analysis', courseId: courses[1].id },
      { name: 'Testing and Debugging', courseId: courses[1].id },
      { name: 'File I/O and Persistence', courseId: courses[1].id },
      { name: 'Recursion Patterns', courseId: courses[1].id },
      { name: 'Other', courseId: courses[1].id },

      // Introduction to Statistics topics
      { name: 'Probability', courseId: courses[2].id },
      { name: 'Random Variables', courseId: courses[2].id },
      { name: 'Expectation', courseId: courses[2].id },
      { name: 'Other', courseId: courses[2].id },

      // Discrete Math topics
      { name: 'Logic and proofs', courseId: courses[3].id },
      { name: 'Graph theory', courseId: courses[3].id },
      { name: 'Other', courseId: courses[3].id },

      // Introduction to Psychology topics
      { name: 'Introduction', courseId: courses[4].id },
      { name: 'Human brain', courseId: courses[4].id },
      { name: 'Social learning', courseId: courses[4].id },
      { name: 'Other', courseId: courses[4].id },

      // Introduction to Nursing topics
      { name: 'Determinants of Health & Health‑Equity', courseId: courses[5].id },
      { name: 'Trauma', courseId: courses[5].id },
      { name: 'Health promotion', courseId: courses[5].id },
      { name: 'Other', courseId: courses[5].id },

      // Scientific Research Methods topics
      { name: 'Research design', courseId: courses[6].id },
      { name: 'Data collection and analysis', courseId: courses[6].id },
      { name: 'Ethics in research', courseId: courses[6].id },
      { name: 'Other', courseId: courses[6].id }
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

    // One empty "Practice Exam" per course
    const practiceExams = await Assessments.bulkCreate(
      courses.map((c) => ({
        courseId: c.id,
        type: 'Quiz',
        name: 'Practice Exam',
        semester: 'Fall 2026'
      }))
    );
    console.log(`Created ${assessments.length} assessments and ${practiceExams.length} Practice Exam(s).`);

    // 5. Create Question_Metadata – 5 real questions per course for all 7 courses
    console.log('Creating question metadata...');
    
    const generateQuestionOrder = (questionIndex, totalQuestions) => {
      const order = {};
      const assessmentIndex = questionIndex % assessments.length;
      const questionNum = Math.floor(questionIndex / assessments.length) + 1;
      order[assessments[assessmentIndex].id] = questionNum;
      if (questionIndex % 3 === 0 && assessmentIndex + 1 < assessments.length) {
        order[assessments[assessmentIndex + 1].id] = questionNum;
      }
      return order;
    };

    // 5 real questions per course: { description, type, questionText, answer, topicIndex, choices?, correctAnswer? }
    // topicIndex = index into this course's topic slice (Instruction Set Architectures=0, Pipeline Design=1, etc.)
    const QUESTIONS_PER_COURSE = 5;
    const seedQuestionsByCourse = [
      // Machine Architecture (COSC 211): Instruction Set Architectures, Pipeline Design, Cache Coherence, Memory Hierarchy, Parallel Execution, Performance Benchmarking, Other
      [
        {
          description: 'RISC vs CISC instruction sets',
          type: 'SA',
          topicIndex: 0,
          questionText:
            'What is the main difference between RISC and CISC instruction set architectures? Give one advantage of each.',
          answer:
            'RISC uses a small, fixed set of simple instructions and relies on load-store design; CISC uses complex, variable-length instructions that can perform multiple operations. RISC advantages: simpler pipelining, lower power. CISC advantages: denser code, fewer instructions per program.'
        },
        {
          description: 'Pipeline hazards and forwarding',
          type: 'LA',
          topicIndex: 1,
          questionText:
            'Explain pipeline hazards (data and control). How does data forwarding reduce stalls in a pipeline?',
          answer:
            'Data hazards occur when an instruction needs a result not yet written back. Control hazards occur on branches. Data forwarding (bypassing) sends results from later pipeline stages back to earlier stages so dependent instructions can proceed without waiting for write-back, reducing stalls.'
        },
        {
          description: 'TLB and virtual memory',
          type: 'MCQ',
          topicIndex: 3,
          questionText: 'What is the role of the TLB (Translation Lookaside Buffer) in virtual memory?',
          answer: 'B',
          choices: [
            { letter: 'A', text: 'It stores the full page table' },
            {
              letter: 'B',
              text: 'It caches recent virtual-to-physical address translations to speed up memory access'
            },
            { letter: 'C', text: 'It replaces the page table' },
            { letter: 'D', text: 'It holds swapped-out pages' }
          ],
          correctAnswer: 'B'
        },
        {
          description: 'Pipeline depth trade-offs',
          type: 'MCQ',
          topicIndex: 1,
          questionText: 'What is a drawback of making a pipeline very deep (many stages)?',
          answer: 'C',
          choices: [
            { letter: 'A', text: 'Clock frequency must decrease' },
            { letter: 'B', text: 'Instruction-level parallelism is reduced' },
            { letter: 'C', text: 'Branch mispredictions become more expensive' },
            { letter: 'D', text: 'Structural hazards are eliminated' }
          ],
          correctAnswer: 'C'
        },
        {
          description: 'Cache hit rate and performance',
          type: 'MCQ',
          topicIndex: 3,
          questionText: 'Which change is most likely to increase cache hit rate?',
          answer: 'A',
          choices: [
            { letter: 'A', text: 'Increasing temporal and spatial locality in the program' },
            { letter: 'B', text: 'Reducing cache size' },
            { letter: 'C', text: 'Randomizing memory accesses' },
            { letter: 'D', text: 'Disabling write-back caching' }
          ],
          correctAnswer: 'A'
        }
      ],
      // Computer Programming II (COSC 121): Object-Oriented Design, Data Structures, Algorithm Analysis, Testing and Debugging, File I/O, Recursion Patterns, Other
      [
        {
          description: 'Arrays vs linked lists',
          type: 'SA',
          topicIndex: 1,
          questionText:
            'Compare arrays and linked lists. When would you choose a linked list over an array?',
          answer:
            'Arrays offer O(1) access by index and contiguous memory; linked lists allow O(1) insert/delete at head and dynamic size without reallocation. Choose a linked list when insertions/deletions are frequent and random access by index is not the main operation.'
        },
        {
          description: 'Recursion and binary search',
          type: 'SA',
          topicIndex: 5,
          questionText:
            'Write or describe a recursive implementation of binary search. What is the base case?',
          answer:
            'Base case: when the search range is empty (low > high) return not found, or when the middle element equals the target return its index. Recursive case: compare target to middle; recurse on left or right half accordingly. Time complexity O(log n).'
        },
        {
          description: 'Unit testing and TDD',
          type: 'MCQ',
          topicIndex: 3,
          questionText: 'In test-driven development (TDD), when do you write the unit tests?',
          answer: 'B',
          choices: [
            { letter: 'A', text: 'After the code is complete' },
            { letter: 'B', text: 'Before writing the implementation code' },
            { letter: 'C', text: 'Only for bug fixes' },
            { letter: 'D', text: 'Only for public methods' }
          ],
          correctAnswer: 'B'
        },
        {
          description: 'Time complexity of operations',
          type: 'MCQ',
          topicIndex: 2,
          questionText: 'What is the average time complexity of searching an unsorted array of n elements?',
          answer: 'C',
          choices: [
            { letter: 'A', text: 'O(1)' },
            { letter: 'B', text: 'O(log n)' },
            { letter: 'C', text: 'O(n)' },
            { letter: 'D', text: 'O(n log n)' }
          ],
          correctAnswer: 'C'
        },
        {
          description: 'Exception handling semantics',
          type: 'MCQ',
          topicIndex: 3,
          questionText: 'In most languages, what happens to code after a thrown exception that is not caught in the same function?',
          answer: 'D',
          choices: [
            { letter: 'A', text: 'It continues executing normally' },
            { letter: 'B', text: 'It is skipped but local variables remain valid' },
            { letter: 'C', text: 'Only finally blocks run; the rest continues' },
            { letter: 'D', text: 'It is skipped and control jumps to the nearest matching catch handler up the call stack' }
          ],
          correctAnswer: 'D'
        }
      ],
      // Introduction to Statistics (STUDY1): Probability, Random Variables, Expectation, Other
      [
        {
          description: 'Interpreting the p-value',
          type: 'SA',
          topicIndex: 0,
          questionText:
            'In hypothesis testing, how do you interpret a p-value of 0.03? Should you reject the null hypothesis at significance level 0.05?',
          answer:
            'The p-value is the probability of observing the sample data (or more extreme) if the null hypothesis is true. A p-value of 0.03 means there is a 3% chance of such a result under the null. At α = 0.05, we reject the null hypothesis because p < α.'
        },
        {
          description: 'Mean vs median for skewed data',
          type: 'SA',
          topicIndex: 1,
          questionText:
            'Why might the median be preferred over the mean when describing the center of a skewed distribution?',
          answer:
            'The mean is pulled in the direction of the skew by extreme values; the median is resistant to outliers and better represents the typical value in a skewed distribution.'
        },
        {
          description: 'Central limit theorem',
          type: 'MCQ',
          topicIndex: 2,
          questionText: 'What does the Central Limit Theorem state?',
          answer: 'C',
          choices: [
            { letter: 'A', text: 'All distributions are normal' },
            { letter: 'B', text: 'The sample mean approaches the population mean as n increases' },
            {
              letter: 'C',
              text:
                'The sampling distribution of the sample mean approaches a normal distribution as n increases, regardless of the population distribution'
            },
            {
              letter: 'D',
              text: 'Standard deviation decreases with sample size only for normal populations'
            }
          ],
          correctAnswer: 'C'
        },
        {
          description: 'Law of large numbers',
          type: 'MCQ',
          topicIndex: 0,
          questionText: 'What does the Law of Large Numbers say about sample means?',
          answer: 'B',
          choices: [
            { letter: 'A', text: 'They always equal the population mean for any sample size' },
            { letter: 'B', text: 'They converge to the population mean as sample size increases' },
            { letter: 'C', text: 'They become more variable as sample size increases' },
            { letter: 'D', text: 'They are unrelated to the population mean' }
          ],
          correctAnswer: 'B'
        },
        {
          description: 'Interpreting confidence intervals',
          type: 'MCQ',
          topicIndex: 2,
          questionText: 'A 95% confidence interval for a mean is (10, 14). Which is the best interpretation?',
          answer: 'A',
          choices: [
            {
              letter: 'A',
              text: 'In repeated samples, 95% of such intervals would contain the true population mean'
            },
            { letter: 'B', text: 'There is a 95% chance that the sample mean is between 10 and 14' },
            { letter: 'C', text: 'The probability that the true mean is exactly 12 is 95%' },
            { letter: 'D', text: '95% of individual observations fall between 10 and 14' }
          ],
          correctAnswer: 'A'
        }
      ],
      // Discrete Math (STUDY3): Logic and proofs, Graph theory, Other
      [
        {
          description: 'Direct proof and contrapositive',
          type: 'SA',
          topicIndex: 0,
          questionText:
            'Prove: If n² is even, then n is even. Use either a direct proof or proof by contrapositive.',
          answer:
            'Proof by contrapositive: Assume n is odd. Then n = 2k + 1 for some integer k. So n² = 4k² + 4k + 1 = 2(2k² + 2k) + 1, which is odd. So if n is odd then n² is odd; equivalently, if n² is even then n is even.'
        },
        {
          description: 'Handshaking lemma',
          type: 'SA',
          topicIndex: 1,
          questionText:
            'State the handshaking lemma for a graph. Use it to explain why a graph cannot have an odd number of vertices of odd degree.',
          answer:
            'Handshaking lemma: The sum of all vertex degrees equals twice the number of edges. So the sum of degrees is even. If we had an odd number of odd-degree vertices, the sum of their degrees would be odd, and adding even-degree vertices keeps it odd—contradiction. So the number of odd-degree vertices must be even.'
        },
        {
          description: 'Euler circuit',
          type: 'MCQ',
          topicIndex: 1,
          questionText: 'When does a graph have an Euler circuit?',
          answer: 'B',
          choices: [
            { letter: 'A', text: 'When it is connected' },
            {
              letter: 'B',
              text: 'When every vertex has even degree and the graph is connected'
            },
            { letter: 'C', text: 'When it has no odd-degree vertices' },
            { letter: 'D', text: 'When it is a complete graph' }
          ],
          correctAnswer: 'B'
        },
        {
          description: 'Tree properties',
          type: 'MCQ',
          topicIndex: 0,
          questionText: 'Which statement is true for any finite tree with n vertices?',
          answer: 'C',
          choices: [
            { letter: 'A', text: 'It has exactly n edges' },
            { letter: 'B', text: 'It has at most n - 2 edges' },
            { letter: 'C', text: 'It has exactly n - 1 edges' },
            { letter: 'D', text: 'It must be complete' }
          ],
          correctAnswer: 'C'
        },
        {
          description: 'Graph connectivity',
          type: 'MCQ',
          topicIndex: 1,
          questionText: 'A connected graph with no cycles is called:',
          answer: 'A',
          choices: [
            { letter: 'A', text: 'A tree' },
            { letter: 'B', text: 'A clique' },
            { letter: 'C', text: 'A bipartite graph' },
            { letter: 'D', text: 'A multigraph' }
          ],
          correctAnswer: 'A'
        }
      ],
      // Introduction to Psychology (STUDY2): Introduction, Human brain, Social learning, Other
      [
        {
          description: 'Brain structures and function',
          type: 'SA',
          topicIndex: 1,
          questionText:
            'Name three major structures of the human brain and briefly state one function of each.',
          answer:
            'E.g. Frontal lobe: executive function, planning, decision-making. Hippocampus: formation of long-term memories. Amygdala: emotion processing, especially fear. (Other valid: cerebellum—motor control; occipital lobe—vision; etc.)'
        },
        {
          description: 'Classical vs operant conditioning',
          type: 'SA',
          topicIndex: 0,
          questionText:
            'How does classical conditioning differ from operant conditioning? Give a brief example of each.',
          answer:
            'Classical conditioning pairs a neutral stimulus with an unconditioned stimulus to produce a learned response (e.g. Pavlov’s dog salivating to a bell). Operant conditioning strengthens or weakens behavior by consequences—reinforcement or punishment (e.g. a rat pressing a lever for food).'
        },
        {
          description: 'Bandura and social learning',
          type: 'MCQ',
          topicIndex: 2,
          questionText: 'According to Bandura’s social learning theory, learning can occur through:',
          answer: 'B',
          choices: [
            { letter: 'A', text: 'Reinforcement only' },
            {
              letter: 'B',
              text: 'Observation and imitation of others, without direct reinforcement'
            },
            { letter: 'C', text: 'Classical conditioning only' },
            { letter: 'D', text: 'Biological maturation only' }
          ],
          correctAnswer: 'B'
        },
        {
          description: 'Stages of sleep',
          type: 'MCQ',
          topicIndex: 1,
          questionText: 'Which stage of sleep is most closely associated with vivid dreaming?',
          answer: 'D',
          choices: [
            { letter: 'A', text: 'Stage 1 (light sleep)' },
            { letter: 'B', text: 'Stage 2 (spindle stage)' },
            { letter: 'C', text: 'Stage 3 (slow-wave sleep)' },
            { letter: 'D', text: 'REM sleep' }
          ],
          correctAnswer: 'D'
        },
        {
          description: 'Types of reinforcement',
          type: 'MCQ',
          topicIndex: 2,
          questionText: 'Giving a child a sticker every time they complete homework is an example of:',
          answer: 'A',
          choices: [
            { letter: 'A', text: 'Positive reinforcement' },
            { letter: 'B', text: 'Negative reinforcement' },
            { letter: 'C', text: 'Positive punishment' },
            { letter: 'D', text: 'Negative punishment' }
          ],
          correctAnswer: 'A'
        }
      ],
      // Introduction to Nursing (STUDY4): Determinants of Health & Health‑Equity, Trauma, Health promotion, Other
      [
        {
          description: 'Clinical assessment and vital signs',
          type: 'SA',
          topicIndex: 1,
          questionText:
            'List the main steps of a basic clinical assessment. Why are vital signs (e.g. temperature, pulse, blood pressure) important in this process?',
          answer:
            'Steps typically include: health history, physical examination, vital signs, and documentation. Vital signs provide objective data on current physiological state and help identify instability, response to treatment, or need for escalation.'
        },
        {
          description: 'Patient safety and medication',
          type: 'SA',
          topicIndex: 0,
          questionText:
            'Describe at least two principles of patient safety that apply during medication administration.',
          answer:
            'E.g. Right patient, right drug, right dose, right route, right time (five rights); checking allergies; double-checking high-alert medications; clear documentation; patient education about the medication.'
        },
        {
          description: 'Health promotion role',
          type: 'MCQ',
          topicIndex: 2,
          questionText: 'Which best describes the nurse’s role in health promotion?',
          answer: 'B',
          choices: [
            { letter: 'A', text: 'Only treating acute illness' },
            {
              letter: 'B',
              text: 'Educating and supporting patients to adopt healthy behaviors and prevent disease'
            },
            { letter: 'C', text: 'Prescribing medications only' },
            { letter: 'D', text: 'Replacing the physician in primary care' }
          ],
          correctAnswer: 'B'
        },
        {
          description: 'Standard precautions',
          type: 'MCQ',
          topicIndex: 0,
          questionText: 'Standard precautions (e.g. hand hygiene, gloves) are applied to:',
          answer: 'C',
          choices: [
            { letter: 'A', text: 'Only patients with known infections' },
            { letter: 'B', text: 'Only high-risk procedures' },
            { letter: 'C', text: 'All patients, regardless of diagnosis' },
            { letter: 'D', text: 'Only patients in isolation rooms' }
          ],
          correctAnswer: 'C'
        },
        {
          description: 'Therapeutic communication',
          type: 'MCQ',
          topicIndex: 2,
          questionText:
            'Which nursing action best demonstrates therapeutic communication with a patient who is anxious?',
          answer: 'D',
          choices: [
            { letter: 'A', text: 'Changing the subject to distract the patient' },
            { letter: 'B', text: 'Giving advice and telling the patient what to do' },
            {
              letter: 'C',
              text: 'Explaining that their feelings are not realistic and should stop'
            },
            { letter: 'D', text: 'Using open-ended questions and active listening' }
          ],
          correctAnswer: 'D'
        }
      ],
      // Scientific Research Methods (STUDY5): Research design, Data collection and analysis, Ethics in research, Other
      [
        {
          description: 'Qualitative vs quantitative design',
          type: 'SA',
          topicIndex: 0,
          questionText:
            'What is the main difference between qualitative and quantitative research design? When might a researcher choose a qualitative approach?',
          answer:
            'Quantitative research uses numerical data and statistical analysis; qualitative research uses non-numerical data (e.g. interviews, text) and thematic analysis. Choose qualitative when exploring meanings, context, or when little is known and the goal is to generate hypotheses or understand experience in depth.'
        },
        {
          description: 'Informed consent in research',
          type: 'SA',
          topicIndex: 2,
          questionText:
            'What must be ensured to obtain valid informed consent from research participants?',
          answer:
            'Participants must be given clear information about the purpose, procedures, risks, benefits, and right to withdraw; they must understand this information and consent voluntarily without coercion; consent should be documented (e.g. signed form) and the process ongoing, not one-time.'
        },
        {
          description: 'Reliability and validity',
          type: 'MCQ',
          topicIndex: 1,
          questionText: 'Why are reliability and validity important in data collection?',
          answer: 'B',
          choices: [
            { letter: 'A', text: 'They are only important in qualitative research' },
            {
              letter: 'B',
              text:
                'Reliability ensures consistency of measurement; validity ensures we are measuring what we intend to measure'
            },
            { letter: 'C', text: 'They are the same concept' },
            { letter: 'D', text: 'They only matter in experiments' }
          ],
          correctAnswer: 'B'
        },
        {
          description: 'Sampling methods',
          type: 'MCQ',
          topicIndex: 1,
          questionText:
            'Which sampling method gives every member of the population an equal chance of being selected?',
          answer: 'A',
          choices: [
            { letter: 'A', text: 'Simple random sampling' },
            { letter: 'B', text: 'Convenience sampling' },
            { letter: 'C', text: 'Purposive sampling' },
            { letter: 'D', text: 'Snowball sampling' }
          ],
          correctAnswer: 'A'
        },
        {
          description: 'Control groups',
          type: 'MCQ',
          topicIndex: 0,
          questionText: 'The main purpose of a control group in an experiment is to:',
          answer: 'C',
          choices: [
            { letter: 'A', text: 'Increase sample size without cost' },
            { letter: 'B', text: 'Guarantee randomization' },
            { letter: 'C', text: 'Provide a baseline for comparison with the treatment group' },
            { letter: 'D', text: 'Eliminate the need for replication' }
          ],
          correctAnswer: 'C'
        }
      ]
    ];

    // Topic ranges per course: [startIndex, endIndex) in topics array (matches order in Topics.bulkCreate above)
    const courseTopicRanges = [
      [0, 7],   // COSC 211: 6 + Other
      [7, 14],  // COSC 121: 6 + Other
      [14, 18], // STUDY1: 3 + Other
      [18, 21], // STUDY3: 2 + Other
      [21, 25], // STUDY2: 3 + Other
      [25, 29], // STUDY4: 3 + Other
      [29, 33]  // STUDY5: 3 + Other
    ];

    const allQuestionMeta = [];
    let globalQuestionIndex = 0;

    for (let c = 0; c < courses.length; c++) {
      const [topicStart, topicEnd] = courseTopicRanges[c];
      const courseTopics = topics.slice(topicStart, topicEnd);
      const courseQuestions = seedQuestionsByCourse[c];

      for (let i = 0; i < QUESTIONS_PER_COURSE; i++) {
        const q = courseQuestions[i];
        const topicIndex = Math.min(q.topicIndex ?? i % courseTopics.length, courseTopics.length - 1);
        allQuestionMeta.push({
          description: q.description,
          type: q.type,
          courseId: courses[c].id,
          primaryTopicId: courseTopics[topicIndex].id,
          questionOrder: generateQuestionOrder(globalQuestionIndex, courses.length * QUESTIONS_PER_COURSE)
        });
        globalQuestionIndex++;
      }
    }

    const questionMetadata = await Question_Metadata.bulkCreate(allQuestionMeta);
    const seedQuestionTexts = seedQuestionsByCourse.flat();
    console.log(`Created ${questionMetadata.length} question metadata entries.`);

    // 6. Create Variants (at least 1 per question) using seeded question text, choices, and answers when available
    console.log('Creating variants...');
    
    const generateVariant = (qMeta, assessmentId, variantNum = 0, seedOverride = null) => {
      const difficulties = ['easy', 'medium', 'hard'];
      const reasoningLevels = ['factual', 'analytical', 'application'];
      const difficulty = difficulties[qMeta.id % difficulties.length];
      const reasoningLevel = reasoningLevels[qMeta.id % reasoningLevels.length];
      
      let questionText;
      let answer = null;
      let choices = null;

      // Prefer explicit seed override when provided
      if (seedOverride && seedOverride.questionText && seedOverride.answer) {
        questionText = seedOverride.questionText;
      
      if (qMeta.type === 'MCQ') {
          // For seeded MCQs we expect structured choices + correctAnswer
          if (Array.isArray(seedOverride.choices) && seedOverride.correctAnswer) {
            choices = seedOverride.choices.map((c) => ({
              letter: c.letter,
              text: c.text
            }));
            answer = seedOverride.correctAnswer;
          } else {
            // Backwards compatibility: try to parse answer like "B) Option B"
            const parsed = String(seedOverride.answer).trim();
            const match = /^([A-Z])\)/.exec(parsed);
            answer = match ? match[1] : parsed;
          }
        } else {
          // SA / LA keep full-text answer
          answer = seedOverride.answer;
        }
      } else {
        // No seed override: generate generic content
        if (qMeta.type === 'MCQ') {
          questionText = `What is the primary concept related to ${qMeta.description.toLowerCase()}?`;
          choices = [
            { letter: 'A', text: 'Option A' },
            { letter: 'B', text: 'Option B' },
            { letter: 'C', text: 'Option C' },
            { letter: 'D', text: 'Option D' }
          ];
          answer = 'B';
        } else if (qMeta.type === 'LA') {
          questionText = `Discuss ${qMeta.description.toLowerCase()} in depth.`;
          answer = `Answer for ${qMeta.description}.`;
        } else {
          questionText = `Explain ${qMeta.description.toLowerCase()}.`;
          answer = `Sample answer for ${qMeta.description}.`;
        }
      }

      const base = {
        questionText,
        difficulty,
        reasoningLevel,
        questionMetadataId: qMeta.id,
        assessmentId,
        answer
      };

      return qMeta.type === 'MCQ' && Array.isArray(choices)
        ? { ...base, choices }
        : base;
    };

    const variantsToCreate = [];
    for (let i = 0; i < questionMetadata.length; i++) {
      const qMeta = questionMetadata[i];
      const primaryAssessment = assessments[i % assessments.length];
      const seedOverride = seedQuestionTexts[i] || null;
      variantsToCreate.push(generateVariant(qMeta, primaryAssessment.id, 0, seedOverride));
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
