/**
 * DB-backed tests that close remaining TEST_PLAN gaps: cross-user course access,
 * extract/save persistence, and assessment variant assembly.
 * Run: npm run test:integration (requires TEST_DATABASE_URL).
 */
import request from 'supertest';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const describeDb = hasTestDb ? describe : describe.skip;

describeDb('Plan coverage (integration)', () => {
  let app;
  let connectTestDatabase;
  let truncateTestDatabase;
  let sequelize;

  beforeAll(async () => {
    if (!hasTestDb) {
      return;
    }
    const { default: appMod } = await import('../src/app.js');
    const testDb = await import('./helpers/testDb.js');
    app = appMod;
    connectTestDatabase = testDb.connectTestDatabase;
    truncateTestDatabase = testDb.truncateTestDatabase;
    ({ sequelize } = testDb);
    await connectTestDatabase();
  });

  afterAll(async () => {
    if (sequelize) {
      await sequelize.close();
    }
  });

  beforeEach(async () => {
    if (!hasTestDb) {
      return;
    }
    await truncateTestDatabase();
  });

  it('returns 404 when fetching another user course by id', async () => {
    const reg1 = await request(app)
      .post('/api/auth/register')
      .send({ email: `user-a-${Date.now()}@local.test`, password: 'secret12' });
    expect(reg1.status).toBe(201);
    const token1 = reg1.body.data.token;
    const courses1 = await request(app)
      .get('/api/course')
      .set('Authorization', `Bearer ${token1}`);
    const courseIdA = courses1.body.data[0].id;

    const reg2 = await request(app)
      .post('/api/auth/register')
      .send({ email: `user-b-${Date.now()}@local.test`, password: 'secret12' });
    expect(reg2.status).toBe(201);
    const token2 = reg2.body.data.token;

    const res = await request(app)
      .get(`/api/course/${courseIdA}`)
      .set('Authorization', `Bearer ${token2}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('persists extracted questions via POST /api/questions/extract/save', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: `save-ext-${Date.now()}@local.test`, password: 'secret12' });
    expect(reg.status).toBe(201);
    const token = reg.body.data.token;
    const courses = await request(app)
      .get('/api/course')
      .set('Authorization', `Bearer ${token}`);
    const courseId = courses.body.data[0].id;
    const topics = await request(app)
      .get(`/api/course/${courseId}/topics`)
      .set('Authorization', `Bearer ${token}`);
    const topicId = topics.body.data[0].id;

    const res = await request(app)
      .post('/api/questions/extract/save')
      .set('Authorization', `Bearer ${token}`)
      .send({
        courseId,
        primaryTopicId: topicId,
        questions: [
          {
            question: 'What is 2+2?',
            summary: 'Single-digit addition',
            type: 'SA',
            difficulty: 'easy',
            answer: '4',
          },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
  });

  it('assembles a variant exam from the Practice Exam via assemble-variants', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: `asm-var-${Date.now()}@local.test`, password: 'secret12' });
    expect(reg.status).toBe(201);
    const token = reg.body.data.token;
    const courses = await request(app)
      .get('/api/course')
      .set('Authorization', `Bearer ${token}`);
    const courseId = courses.body.data[0].id;
    const topics = await request(app)
      .get(`/api/course/${courseId}/topics`)
      .set('Authorization', `Bearer ${token}`);
    const topicId = topics.body.data[0].id;

    const createQ = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'Assembly baseline metadata',
        courseId,
        primaryTopicId: topicId,
        type: 'MCQ',
      });
    expect(createQ.status).toBe(201);
    const qid = createQ.body.data.id;

    const alist = await request(app)
      .get('/api/assessments')
      .set('Authorization', `Bearer ${token}`)
      .query({ courseId });
    const practice = alist.body.data.find((a) => a.name === 'Practice Exam');
    expect(practice).toBeTruthy();
    const assessmentId = practice.id;

    const v = await request(app)
      .post(`/api/questions/${qid}/variants`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        questionText: 'What is 2+2? A)1 B)2 C)3 D)4',
        difficulty: 'easy',
        reasoningLevel: 'factual',
        assessmentId,
        answer: 'D',
        choices: [
          { letter: 'A', text: '1' },
          { letter: 'B', text: '2' },
          { letter: 'C', text: '3' },
          { letter: 'D', text: '4' },
        ],
        isDraft: false,
      });
    expect(v.status).toBe(201);

    const asm = await request(app)
      .post('/api/assessment-variant/assemble-variants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        referenceAssessmentId: practice.id,
        courseId,
        examLabels: ['Assembled-Integration'],
        includeDrafts: true,
      });
    expect(asm.status).toBe(201);
    expect(asm.body.success).toBe(true);
    expect(asm.body.data.createdAssessments.length).toBe(1);
    expect(asm.body.data.slotsProcessed).toBeGreaterThan(0);
  });
});
