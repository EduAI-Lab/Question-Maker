import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Label } from '../ui/label';
import { ClassCreate } from '../../types/class';
import { useCourses } from '../../hooks/useCourses';
import { useToast } from '../ui/use-toast';

interface ClassFormProps {
  onSubmit: (data: ClassCreate) => void;
  onCancel: () => void;
  initialData?: Partial<ClassCreate>;
  isLoading?: boolean;
  isEditing?: boolean;
}

export const ClassForm = ({ onSubmit, onCancel, initialData, isLoading = false, isEditing = false }: ClassFormProps) => {
  const [formData, setFormData] = useState<ClassCreate>({
    name: initialData?.name || '',
    subject: initialData?.subject || '',
    courseCode: initialData?.courseCode || '',
    semester: initialData?.semester || '',
    year: initialData?.year || undefined,
    description: initialData?.description || '',
    department: initialData?.department || ''
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ClassCreate, string>>>({});
  const { createCourse, updateCourse } = useCourses();
  const { toast } = useToast();

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ClassCreate, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Class name is required';
    }

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }

    if (formData.year && (formData.year < 1900 || formData.year > 2200)) {
      newErrors.year = 'Year must be between 1900 and 2200';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      let result;
      if (isEditing && initialData?.id) {
        result = await updateCourse(initialData.id, formData);
      } else {
        result = await createCourse(formData);
      }
      
      if (result.success) {
        toast({
          title: "Success",
          description: isEditing ? "Course updated successfully" : "Course created successfully"
        });
        onSubmit(formData);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || (isEditing ? "Failed to update course" : "Failed to create course")
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred"
      });
    }
  };

  const handleChange = (field: keyof ClassCreate, value: string | number | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? 'Edit Course' : 'Create New Course'}</CardTitle>
        <CardDescription>{isEditing ? 'Update course information' : 'Add a new course to organize your questions'}</CardDescription>
      </CardHeader>
      
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Course Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('name', e.target.value)}
                placeholder="e.g., Introduction to Computer Science"
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('subject', e.target.value)}
                placeholder="e.g., Computer Science"
                className={errors.subject ? 'border-destructive' : ''}
              />
              {errors.subject && (
                <p className="text-sm text-destructive">{errors.subject}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="courseCode">Course Code</Label>
              <Input
                id="courseCode"
                value={formData.courseCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('courseCode', e.target.value)}
                placeholder="e.g., CS101"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('department', e.target.value)}
                placeholder="e.g., Computer Science Department"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="semester">Semester</Label>
              <Input
                id="semester"
                value={formData.semester}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('semester', e.target.value)}
                placeholder="e.g., Fall 2024"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                value={formData.year || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('year', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="e.g., 2024"
                min="1900"
                max="2100"
                className={errors.year ? 'border-destructive' : ''}
              />
              {errors.year && (
                <p className="text-sm text-destructive">{errors.year}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('description', e.target.value)}
              placeholder="Brief description of the class..."
              className="min-h-[100px]"
            />
          </div>
        </CardContent>

        <CardFooter className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Course' : 'Create Course')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

