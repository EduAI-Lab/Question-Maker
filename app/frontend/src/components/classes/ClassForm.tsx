import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Label } from '../ui/label';
import { ClassCreate } from '../../types/class';
import { useClasses } from '../../hooks/useClasses';
import { useToast } from '../ui/use-toast';

interface ClassFormProps {
  onSubmit: (data: ClassCreate) => void;
  onCancel: () => void;
  initialData?: Partial<ClassCreate>;
  isLoading?: boolean;
}

export const ClassForm = ({ onSubmit, onCancel, initialData, isLoading = false }: ClassFormProps) => {
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
  const { createClass, updateClass } = useClasses();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const result = await createClass(formData);
      if (result.success) {
        toast({
          title: "Success",
          description: "Class created successfully"
        });
        onSubmit(formData);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "Failed to create class"
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
        <CardTitle>Create New Class</CardTitle>
        <CardDescription>Add a new class to organize your questions</CardDescription>
      </CardHeader>
      
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Class Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
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
                onChange={(e) => handleChange('subject', e.target.value)}
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
                onChange={(e) => handleChange('courseCode', e.target.value)}
                placeholder="e.g., CS101"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => handleChange('department', e.target.value)}
                placeholder="e.g., Computer Science Department"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="semester">Semester</Label>
              <Input
                id="semester"
                value={formData.semester}
                onChange={(e) => handleChange('semester', e.target.value)}
                placeholder="e.g., Fall 2024"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                value={formData.year || ''}
                onChange={(e) => handleChange('year', e.target.value ? parseInt(e.target.value) : undefined)}
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
              onChange={(e) => handleChange('description', e.target.value)}
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
            {isLoading ? 'Creating...' : 'Create Class'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

