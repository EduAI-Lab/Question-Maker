export interface Topic {
  id: number;
  name: string;
  description?: string | null;
  courseId: number;
  createdAt: string;
  updatedAt: string;
}
