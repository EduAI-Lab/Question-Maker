# Experiment script: equivalent exam variants via structured metadata and automated generation

## Purpose

Evaluate whether an AI-assisted assessment management system can support creation of multiple exam versions that maintain **comparable conceptual coverage** and **difficulty**, using structured question metadata and automated variant generation.

## Study page workflow (application)

The integrated **Study** page (`/study`) follows this order:

1. **Baseline reference exam** — Upload or import (OCR with assessment, or Canvas). Select the assessment and mark it as the reference baseline (`blueprint_config.studyRole`).
2. **Generate variants** — For each base question on that exam, the system promotes the primary variant and generates additional EduAI variants tied to the same `question_metadata` row.
3. **Assemble parallel exams** — Build Exam A/B/C using the **same slot structure** as the baseline (same `question_metadata` per position, different `variant` ids where available), via `POST /api/study/assemble-variants`.
4. **Similarity checker** — Run `POST /api/study/metrics` on the baseline plus generated exam ids for distribution similarity, Jaccard on base questions, and workflow stats.

## Research questions (operational)

1. **Structural equivalence**: Do generated full exams match each other (and optionally the reference baseline) on topic mix, difficulty mix, and question-type mix?
2. **Conceptual lineage**: When assembling multiple versions, does the system preferentially draw **different variants** from the **same base questions** (same `question_metadata` / concept) rather than repeating identical item text?
3. **Workflow efficiency**: How long does assembly take per exam, and how much reuse of variants vs. generation occurs?

## Design summary


| Element            | Specification                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Domain             | Single course; one coherent topic taxonomy                                                    |
| Base question bank | ~50 base questions (`question_metadata` rows), each with ≥1 variant                           |
| Variants           | Parameter/wording/numeric changes; same underlying concept; inherit metadata from base        |
| Reference exam     | One real, previously administered exam imported and frozen as baseline (not system-generated) |
| Generated exams    | Three complete variants of the same blueprint (e.g. Exam A, B, C)                             |
| Constraints        | Topic distribution, question-type distribution, difficulty balance enforced at assembly       |


## Phase 1 — Build the question bank

### 1.1 Ingest base questions

1. Collect ~50 questions from existing materials in one course.
2. For each item, create **question metadata** with:
  - **Topic**: primary topic (and secondary topics if used).
  - **Type**: MCQ, SA, or LA.
  - **Difficulty** (operational): stored on the **variant** (`easy` / `medium` / `hard`); keep consistent rubric across items.
  - **Reasoning level** (optional but recommended): `factual` / `analytical` / `application` on the variant.
  - Short **description** on metadata for search and auditing.
3. Record ingest date and source document ID in a study log (external spreadsheet or lab notebook).

### 1.2 Create variants per base question

For each base question:

1. Generate or author **multiple variants** by altering parameters, numbers, or phrasing while preserving the concept and solution structure.
2. Link variants to the same `question_metadata` row.
3. Use **reference lineage** where applicable: point `reference_id` to the canonical or first variant so derivation is traceable.
4. Mark AI-generated variants consistently (`is_ai_generated`) for secondary analysis.
5. Promote only reviewed items to non-draft (`is_draft: false`) before exam assembly.

**Stopping rule**: Minimum variant count per base (e.g. ≥2–3) should be fixed before assembly so the selector can avoid duplicate wording across exams.

## Phase 2 — Import reference (baseline) exam

1. Import the **actual past exam** (OCR, manual entry, or Canvas import per your workflow).
2. Store it as a **named assessment** that is clearly the baseline, e.g. name: `Reference — [Course] [Term] Midterm` (adjust to your naming convention).
3. Ensure each placed question uses the **same metadata structure** as the bank (topic, type, difficulty on variants).
4. **Do not** run automated variant generation on this assessment as part of the experimental condition; treat it as **ground truth for comparison** only.

**Platform note**: The app models assessments with `type` ∈ {Assignment, Lab, Quiz, Midterm, Final} and does not define a separate `exam_type` enum. For the study, encode role in the **assessment name** and, if you use JSON blueprint storage, optional `blueprint_config.studyRole = "reference_baseline"` for exports and scripts.

## Phase 3 — Define target blueprint

Before generating Exam A/B/C, fix a **target blueprint** derived from the reference or from policy:

- Count per **topic** (or percentages).
- Count per **question type** (MCQ / SA / LA).
- Count per **difficulty** (easy / medium / hard).
- Total number of questions (match reference unless you justify a difference).

Document this as a single table; use it as the constraint spec for all three generated exams.

## Phase 4 — Assemble three exam variants

For **Exam A**, **Exam B**, and **Exam C**:

1. Start a timer when assembly begins; stop when the exam is saved and finalized.
2. Run assembly with the same blueprint constraints for each.
3. **Selection policy** (document which you actually implement):
  - Satisfy topic / type / difficulty constraints.
  - Prefer **different variants** whose **question_metadata_id** matches the same set of base concepts as other versions (equivalent item “slots”), avoiding the **same variant id** across exams where possible.
4. Record for each exam:
  - Assessment id and name
  - Ordered list of **variant ids** and **question_metadata ids**
  - Any manual overrides (and reason)

## Phase 5 — Metrics

### 5.1 Structural similarity (between generated exams and optionally vs. reference)

For each pair among {A, B, C} (and optionally each vs. Reference), compute:

1. **Topic distribution similarity**
  - Build histogram: proportion of items per topic id.  
  - Report **1 − JSD** (Jensen–Shannon divergence, base-2) or **cosine similarity** of proportion vectors; state which you use in the thesis.
2. **Difficulty distribution similarity**
  - Same approach on `{easy, medium, hard}` counts.
3. **Question-type distribution similarity**
  - Same on `{MCQ, SA, LA}`.
4. **Base-question overlap (concept alignment)**
  - Let S_i be the set of `question_metadata_id` on exam i.  
  - Report **|S_A ∩ S_B| / |S_A ∪ S_B|** (Jaccard) for each pair.  
  - Optionally compare to reference: same Jaccard vs. Reference.
5. **Variant deduplication**
  - Proportion of variant ids that appear in more than one exam (should be **low** if the design avoids repeated items).

### 5.2 Workflow metrics

Per exam (A, B, C), record:


| Metric                   | Definition                                      |
| ------------------------ | ----------------------------------------------- |
| Assembly time            | Wall-clock seconds from start to finalized save |
| Cross-exam variant reuse | Count of variant ids appearing in >1 of {A,B,C} |
| Variants utilized        | Count of distinct variant ids placed            |
| AI variants used         | Count where `is_ai_generated` is true           |


### 5.3 Aggregation and reporting

- Summary statistics (mean, SD, min, max) across the three exams for timing and reuse.
- **Comparison table**: rows = metric names; columns = Exam A vs B, A vs C, B vs C (and vs Reference if used).
- Brief qualitative note on any constraint violations or manual fixes.

## Phase 6 — Integrity and ethics (checklist)

- Course materials and past exams used with permission; de-identify if required.
- Fixed random seeds if the assembler is stochastic; log version/commit of the application.
- Pre-register or document post-hoc any changes to the blueprint after seeing results (transparency).

## Minimal data collection sheet (fields)

Use one row per exam version (Reference, A, B, C):

- `exam_label`, `assessment_id`, `assembly_time_sec`, `n_questions`, `variant_ids` (ordered), `question_metadata_ids` (ordered), `n_ai_variants`, `n_variants_reused_across_ABC`, notes.

## Implemented API (this repository)

Authenticated JSON endpoints under `/api/study`:


| Method  | Path                                            | Purpose                                                                                                                                                                                                                                                                                                                                                |
| ------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PATCH` | `/api/study/assessments/:id/role`               | Body: `{ "studyRole": "reference_baseline" | "generated_variant" | null }`. Merges into `assessments.blueprint_config`.                                                                                                                                                                                                                                |
| `GET`   | `/api/study/assessments/:id/blueprint-snapshot` | Ordered slots (variant id, `question_metadata_id`, topic, type, difficulty) plus aggregate counts.                                                                                                                                                                                                                                                     |
| `POST`  | `/api/study/assemble-variants`                  | Body: `{ "referenceAssessmentId", "courseId", "examLabels"?, "namePrefix"?, "includeDrafts"?, ... }`. Creates Exam A/B/C–style assessments with one section each, picking distinct non-draft variants per slot (globally unique across the batch when possible). Returns `assemblyTimeMs` and warnings if the reference variant text had to be reused. |
| `POST`  | `/api/study/metrics`                            | Body: `{ "assessmentIds": number[], "referenceAssessmentId"?: number }`. Pairwise topic/difficulty/type similarity (1 − JSD), Jaccard on base question ids, duplicate variant counts, cross-exam reuse stats.                                                                                                                                          |


**UI:** On the assessment builder (`/assessments/:id/builder`), the **Study experiment** panel supports marking the reference baseline, loading a snapshot, assembling three exams, and running metrics against the reference plus the last assembled batch.

---

*This script aligns procedural steps with the question-maker model: `question_metadata` (topic, type), `variants` (difficulty, reasoning, lineage, AI flags), `assessments` + sections (`section_variants`) for composed exams.*