export interface Assessment {
  id: number;
  name: string;
  type: 'Lab' | 'Midterm' | 'Quiz' | 'Final';
  courseId: number;
  questions: number[];
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentCreate {
  name: string;
  type: 'Lab' | 'Midterm' | 'Quiz' | 'Final';
  courseId: number;
  questions: number[];
}

export interface Course {
  id: number;
  name: string;
  code: string;
  subject: string;
  semester: string;
  year: number;
}
