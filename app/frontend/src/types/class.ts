export interface Class {
  id: number;
  name: string;
  subject: string;
  courseCode?: string;
  semester?: string;
  year?: number;
  description?: string;
  department?: string;
  createdAt: string;
  userId: number;
}

export interface ClassCreate {
  name: string;
  subject: string;
  courseCode?: string;
  semester?: string;
  year?: number;
  description?: string;
  department?: string;
}

