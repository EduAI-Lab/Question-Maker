/**
 * Production-safe seed: adds sample questions (and topics/assessments if missing) to every
 * existing course. Does NOT clear or destroy any data.
 *
 * Usage (from project root): npm run seed:production
 * Or from app/backend: node scripts/seedProductionQuestions.js
 *
 * Requires: DATABASE_URL in .env (same as populate). Uses same postgres→localhost rewrite when not in Docker.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '../../../');
const envPath = join(projectRoot, '.env');

if (!existsSync(envPath)) {
  console.error('❌ .env not found at', envPath);
  process.exit(1);
}

const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('❌ Error loading .env:', result.error.message);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set in .env');
  process.exit(1);
}

if (process.env.DATABASE_URL.includes('@postgres:')) {
  const isDocker = process.env.DOCKER === 'true' || process.env.COMPOSE_PROJECT_NAME;
  if (!isDocker) {
    console.log('ℹ️  Replacing "postgres" host with "localhost"');
    process.env.DATABASE_URL = process.env.DATABASE_URL.replace('@postgres:', '@localhost:');
  }
}

const dbModule = await import('../src/config/database.js');
const schemaModule = await import('../src/schema/index.js');
const { sequelize } = dbModule;
const { Course, Topics, Question_Metadata, Assessments, Variants } = schemaModule;

/** Generic sample questions added to each course (SA, MCQ, LA) */
const SAMPLE_QUESTIONS = [
  {
    description: 'Key concept short answer',
    type: 'SA',
    questionText: 'In your own words, explain one important concept from this course and why it matters.',
    answer: 'Answers will vary. The concept should be correctly identified and a reasonable justification given.'
  },
  {
    description: 'Multiple choice sample',
    type: 'MCQ',
    questionText: 'Which of the following best describes applying course material in a new context?',
    answer: 'B',
    choices: [
      { letter: 'A', text: 'Memorizing definitions only' },
      { letter: 'B', text: 'Using concepts to analyze a new problem or situation' },
      { letter: 'C', text: 'Copying solutions from the textbook' },
      { letter: 'D', text: 'Skipping practice problems' }
    ],
    correctAnswer: 'B'
  },
  {
    description: 'Long answer sample',
    type: 'LA',
    questionText: 'Discuss how two main ideas from this course connect. Give an example to support your explanation.',
    answer: 'Answers will vary. The response should reference two course ideas and provide a concrete example.'
  }
];

const run = async () => {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Connected.\n');

    const courses = await Course.findAll({ order: [['id', 'ASC']] });
    if (!courses.length) {
      console.log('No courses found. Nothing to seed.');
      return;
    }

    console.log(`Found ${courses.length} course(s). Adding sample questions to each...\n`);

    let totalTopics = 0;
    let totalAssessments = 0;
    let totalQuestions = 0;
    let totalVariants = 0;

    for (const course of courses) {
      const courseLabel = `${course.name} (${course.code || course.id})`;
      console.log(`  Course: ${courseLabel}`);

      let topic = (await Topics.findOne({ where: { courseId: course.id }, order: [['id', 'ASC']] })) || null;
      if (!topic) {
        topic = await Topics.create({ name: 'General', courseId: course.id });
        totalTopics++;
        console.log(`    Created topic "General"`);
      }

      let assessment = (await Assessments.findOne({ where: { courseId: course.id }, order: [['id', 'ASC']] })) || null;
      if (!assessment) {
        assessment = await Assessments.create({
          courseId: course.id,
          type: 'Quiz',
          name: 'Sample assessment',
          semester: 'Sample'
        });
        totalAssessments++;
        console.log(`    Created assessment "Sample assessment"`);
      }

      for (let i = 0; i < SAMPLE_QUESTIONS.length; i++) {
        const q = SAMPLE_QUESTIONS[i];
        const order = { [assessment.id]: i + 1 };
        const meta = await Question_Metadata.create({
          description: q.description,
          type: q.type,
          courseId: course.id,
          primaryTopicId: topic.id,
          questionOrder: order
        });
        totalQuestions++;

        const variantPayload = {
          questionText: q.questionText,
          difficulty: 'medium',
          reasoningLevel: 'application',
          questionMetadataId: meta.id,
          assessmentId: assessment.id,
          answer: q.answer,
          isDraft: false,
          isAiGenerated: false
        };
        if (q.type === 'MCQ' && Array.isArray(q.choices) && q.correctAnswer) {
          variantPayload.choices = q.choices.map((c) => ({ letter: c.letter, text: c.text }));
          variantPayload.answer = q.correctAnswer;
        }
        await Variants.create(variantPayload);
        totalVariants++;
      }
      console.log(`    Added ${SAMPLE_QUESTIONS.length} sample questions.`);
    }

    console.log('\n✅ Production seed completed.');
    console.log(`   Topics created: ${totalTopics}`);
    console.log(`   Assessments created: ${totalAssessments}`);
    console.log(`   Question metadata created: ${totalQuestions}`);
    console.log(`   Variants created: ${totalVariants}`);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    throw err;
  } finally {
    await sequelize.close();
    console.log('\nDatabase connection closed.');
  }
};

run()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
