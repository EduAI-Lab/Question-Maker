# Constraints and Tooltips Implementation
## Export to Canvas Button Constraint
- Disabled "Export to Canvas" button when assessment has no questions
- Added tooltip "No questions in assessment" on hover when button is disabled
- Applied to both AssessmentSection component and AssessmentViewPage


## Added tooltip to show missing fields
- Generate assessment modal
- Upload question
- Save to section

TODO
- Delete assessment + constraints
- Toggle darkmode on landing page
## Areas Needing Constraints & Tooltips




### 4. AddQuestionDialog - Submit Button
- **Location**: `app/frontend/src/components/questions/AddQuestionDialog.tsx`
- **Current**: Button disabled in variant mode when no base variant selected, but no tooltip
- **Needed**: Tooltip explaining why disabled (no base question selected for variant mode)
- **Priority**: Medium

### 5. AssessmentViewPage - "Save to Section" Button ✅
- **Location**: `app/frontend/src/pages/AssessmentViewPage.tsx`
- **Status**: ✅ Completed
- **Implementation**: Added tooltip explaining why disabled (no questions selected or section not configured)
- **Priority**: High

### 6. AssessmentSection - "Add Assessment" Button
- **Location**: `app/frontend/src/components/assessments/AssessmentSection.tsx`
- **Current**: Button disabled when `!selectedCourseId` but no tooltip
- **Needed**: Tooltip "Select a course first" when disabled
- **Priority**: Low

### 7. Delete Actions - Better Error Messages
- **Location**: Multiple (AssessmentViewPage, etc.)
- **Current**: Using `window.confirm` for delete confirmations
- **Needed**: Better error messages and tooltips explaining consequences
- **Priority**: Medium

### 8. Question Upload - Missing Summary Validation
- **Location**: `app/frontend/src/components/question-bank/QuestionUploadDialog.tsx`
- **Current**: Error shown after clicking save
- **Needed**: Disable save button and show tooltip if questions missing AI-generated summary
- **Priority**: High

### 9. GenerateAssessmentModal - Percentage Totals Validation
- **Location**: `app/frontend/src/components/assessments/GenerateAssessmentModal.tsx`
- **Current**: No validation for percentage totals (should sum to 100%)
- **Needed**: Disable button and show tooltip if totals don't equal 100%
- **Priority**: Medium

### 10. AssessmentViewPage - "Add Section" Button
- **Location**: `app/frontend/src/pages/AssessmentViewPage.tsx`
- **Current**: No constraints visible
- **Needed**: Check if course is selected, tooltip if not
- **Priority**: Low

Saad
Apply constraints UI - better bug messages (cannot send assessment to canvas with no questions for example)
Make a mock function to assume that api key and canvas url are pulled from edu ai (not urgent)
If a question is AI generated, then the prof has to review it. Reviewed by someone. Not be able to sync to canvas unless questions are reviewed. 
