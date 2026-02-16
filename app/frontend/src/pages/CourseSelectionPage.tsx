/**
 * Course selection page shown after login. User must select a course card to continue to Question Bank / Assessments.
 * Same header as landing; content shows "Your Courses", "Add new course" card, and available course cards.
 */
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopNavigation } from '../components/navigation/TopNavigation';
import { useCourses } from '../hooks/useCourses';
import { Course } from '../types/question';
import { ProfileCoursesDialog } from '../components/profile/ProfileCoursesDialog';
import { courseService } from '../services/courseService';
import { GraduationCap, Plus } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Tooltip } from '../components/ui/tooltip';

const TEST_COURSE_CODE = 'TEST';
const TEST_COURSE_NAME = 'Test Course';

function isTestCourse(course: Course): boolean {
  const code = (course.code ?? '').toUpperCase();
  const name = (course.name ?? '').toLowerCase();
  return code === TEST_COURSE_CODE || name.includes('test course');
}

export const CourseSelectionPage = () => {
  const navigate = useNavigate();
  const { courses, isLoading: isCoursesLoading, fetchCourses } = useCourses();
  const [profileOpen, setProfileOpen] = useState(false);
  const [isStartingTour, setIsStartingTour] = useState(false);

  const handleSelectCourse = (course: Course) => {
    navigate('/landing', { state: { courseId: course.id }, replace: true });
  };

  const handleProfileClick = () => {
    setProfileOpen(true);
  };

  const handleGuidedTourClick = useCallback(async () => {
    if (isStartingTour) return;
    setIsStartingTour(true);
    try {
      let testCourse: Course | undefined = courses.find(isTestCourse);
      if (!testCourse) {
        const created = await courseService.createCourse({
          name: TEST_COURSE_NAME,
          courseCode: TEST_COURSE_CODE
        });
        try {
          await courseService.createTopic(created.id, 'General');
        } catch {
          // ignore topic creation failure
        }
        await fetchCourses();
        testCourse = created;
      }
      navigate('/landing', { state: { courseId: testCourse.id, startGuidedTour: true }, replace: true });
    } catch (err) {
      console.error('Failed to start guided tour', err);
    } finally {
      setIsStartingTour(false);
    }
  }, [courses, fetchCourses, navigate, isStartingTour]);

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation
        variant="course-selection"
        courses={courses}
        isLoadingCourses={isCoursesLoading}
        onProfileClick={handleProfileClick}
        onGuidedTourClick={handleGuidedTourClick}
      />

      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">Your Courses</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
          {/* Add new course card */}
          <Tooltip content="Add or link a course from EduAI to get started" side="top">
            <Card
              className="border-2 border-dashed border-muted-foreground/30 bg-muted/30 hover:border-primary hover:bg-muted/50 cursor-pointer transition-colors flex min-h-[140px]"
              onClick={() => setProfileOpen(true)}
            >
              <CardContent className="flex flex-col items-center justify-center flex-1 p-6">
              <div className="rounded-full bg-muted p-3 mb-2">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Add new course</p>
            </CardContent>
            </Card>
          </Tooltip>

          {/* Available course cards */}
          {courses.map((course) => (
            <Tooltip key={course.id} content={`Open question bank and assessments for ${course.name}`} side="top">
              <Card
                className="cursor-pointer transition-shadow hover:shadow-md border bg-card text-card-foreground flex min-h-[140px]"
                onClick={() => handleSelectCourse(course)}
              >
                <CardContent className="flex flex-col flex-1 p-6 justify-center">
                <div className="flex items-center gap-2 min-w-0">
                  <GraduationCap className="h-5 w-5 text-primary shrink-0" />
                  <span className="font-semibold truncate">{course.name}</span>
                </div>
                {course.code && (
                  <p className="text-sm text-muted-foreground mt-1">{course.code}</p>
                )}
                <p className="text-xs text-muted-foreground/80 mt-2">Click to open</p>
              </CardContent>
              </Card>
            </Tooltip>
          ))}
        </div>

        {!isCoursesLoading && courses.length === 0 && (
          <p className="text-sm text-muted-foreground mt-4">
            No courses yet. Add a course from your profile to get started.
          </p>
        )}
      </div>

      <ProfileCoursesDialog
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        existingCourses={courses}
        onCoursesAdded={fetchCourses}
      />
    </div>
  );
};
