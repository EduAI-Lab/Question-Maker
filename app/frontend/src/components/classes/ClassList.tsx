import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Edit, Trash2, Plus } from 'lucide-react';
import { Class } from '../../types/class';
import { useClasses } from '../../hooks/useClasses';
import { useToast } from '../ui/use-toast';

interface ClassListProps {
  onEdit?: (classItem: Class) => void;
  onDelete?: (id: number) => void;
  onCreate?: () => void;
}

export const ClassList = ({ onEdit, onDelete, onCreate }: ClassListProps) => {
  const { classes, isLoading, deleteClass } = useClasses();
  const { toast } = useToast();

  const handleDelete = async (id: number) => {
    try {
      const result = await deleteClass(id);
      if (result.success) {
        toast({
          title: "Success",
          description: "Class deleted successfully"
        });
        onDelete?.(id);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "Failed to delete class"
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading classes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {classes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">No classes yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first class to organize your questions
              </p>
              {onCreate && (
                <Button onClick={onCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Class
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((classItem) => (
            <Card key={classItem.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{classItem.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{classItem.subject}</p>
                  </div>
                  <div className="flex gap-1">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(classItem)}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(classItem.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-2">
                  {classItem.courseCode && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {classItem.courseCode}
                      </Badge>
                    </div>
                  )}
                  
                  {(classItem.semester || classItem.year) && (
                    <p className="text-sm text-muted-foreground">
                      {classItem.semester} {classItem.year}
                    </p>
                  )}
                  
                  {classItem.department && (
                    <p className="text-sm text-muted-foreground">
                      {classItem.department}
                    </p>
                  )}
                  
                  {classItem.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {classItem.description}
                    </p>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(classItem.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

