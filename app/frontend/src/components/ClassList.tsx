import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card"
import { Button } from "./ui/button"
import { Plus, Edit, Trash2 } from 'lucide-react'
import { useTheme } from "./theme-provider"
import { ScrollArea } from "./ui/scroll-area"

interface Class {
  id: number
  name: string
  subject: string
  course_code: string | null
  semester: string | null
  year: number | null
  description: string | null
  department: string | null
  created_at: string
}

interface ClassListProps {
  classes: Class[]
  onEdit: (classItem: Class) => void
  onDelete: (id: number) => void
  onCreate: () => void
}

export function ClassList({ classes, onEdit, onDelete, onCreate }: ClassListProps) {
  const { theme } = useTheme()

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold ${
          theme === 'light' ? 'text-gray-900' : 'text-white'
        }`}>
          Your Classes
        </h2>
        <Button onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Class
        </Button>
      </div>

      <ScrollArea className="h-[600px]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((classItem) => (
            <Card key={classItem.id} className="relative">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{classItem.name}</CardTitle>
                    <CardDescription>
                      {classItem.course_code && `${classItem.course_code} • `}
                      {classItem.subject}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(classItem)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(classItem.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {classItem.department && (
                    <p>Department: {classItem.department}</p>
                  )}
                  {classItem.semester && classItem.year && (
                    <p>
                      {classItem.semester} {classItem.year}
                    </p>
                  )}
                  {classItem.description && (
                    <p className="text-muted-foreground">
                      {classItem.description}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
} 