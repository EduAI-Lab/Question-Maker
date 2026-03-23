/**
 * Unit tests for study distribution metrics (JSD, Jaccard, KL).
 */
import {
  countsToDistribution,
  jensenShannonDivergence,
  distributionSimilarity,
  jaccardSimilarity
} from '../src/services/studyMetricsService.js';
import { scoreMetadataMatch } from '../src/services/studyExperimentService.js';

const KEYS = ['easy', 'medium', 'hard'];

describe('studyMetricsService', () => {
  it('countsToDistribution normalizes', () => {
    const d = countsToDistribution({ easy: 2, medium: 2, hard: 0 }, KEYS);
    expect(d.easy).toBeCloseTo(0.5);
    expect(d.medium).toBeCloseTo(0.5);
    expect(d.hard).toBeCloseTo(0);
  });

  it('distributionSimilarity is 1 for identical counts', () => {
    const c = { easy: 3, medium: 3, hard: 3 };
    expect(distributionSimilarity(c, c, KEYS)).toBeCloseTo(1, 5);
  });

  it('jaccard is 1 for identical sets', () => {
    expect(jaccardSimilarity([1, 2, 3], [3, 2, 1])).toBe(1);
  });

  it('jaccard handles disjoint sets', () => {
    expect(jaccardSimilarity([1], [2])).toBe(0);
  });

  it('JSD is 0 for identical distributions', () => {
    const p = { easy: 2, medium: 2, hard: 2 };
    expect(jensenShannonDivergence(p, p, KEYS)).toBeCloseTo(0, 10);
  });

  it('scoreMetadataMatch weights topic and type', () => {
    const slotMeta = { primaryTopicId: 1, type: 'MCQ' };
    const bankMeta = { primaryTopicId: 1, type: 'MCQ' };
    const slotV = { difficulty: 'medium', reasoningLevel: 'factual' };
    const bankV = { difficulty: 'medium', reasoningLevel: 'factual' };
    expect(scoreMetadataMatch(slotMeta, slotV, bankMeta, bankV)).toBe(185);
  });
});
