/**
 * Course selection page shown after login. User must select a course card to continue to Question Bank / Assessments.
 * Same header as landing; content shows "Your Courses", "Add new course" card, and available course cards.
 */
import { useNavigate } from 'react-router-dom';
import { TopNavigation } from '../components/navigation/TopNavigation';
import { useCourses } from '../hooks/useCourses';
import { Course } from '../types/question';
import { useState } from 'react';
import { ProfileCoursesDialog } from '../components/profile/ProfileCoursesDialog';
import { GraduationCap, Plus } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';

export const CourseSelectionPage = () => {
  const navigate = useNavigate();
  const { courses, isLoading: isCoursesLoading, fetchCourses } = useCourses();
  const [profileOpen, setProfileOpen] = useState(false);

  const handleSelectCourse = (course: Course) => {
    navigate('/landing', { state: { courseId: course.id }, replace: true });
  };

  const handleProfileClick = () => {
    setProfileOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation
        variant="course-selection"
        courses={courses}
        isLoadingCourses={isCoursesLoading}
        onProfileClick={handleProfileClick}
      />

      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Courses</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Add new course card */}
          <Card
            className="border-2 border-dashed border-gray-300 bg-gray-50/50 hover:border-primary hover:bg-gray-100/50 cursor-pointer transition-colors"
            onClick={() => setProfileOpen(true)}
          >
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-gray-200 p-4 mb-3">
                <Plus className="h-8 w-8 text-gray-600" />
              </div>
              <p className="text-sm font-medium text-gray-700">Add new course</p>
            </CardContent>
          </Card>

          {/* Available course cards */}
          {courses.map((course) => (
            <Card
              key={course.id}
              className="cursor-pointer transition-shadow hover:shadow-md border border-gray-200 bg-white"
              onClick={() => handleSelectCourse(course)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <GraduationCap className="h-5 w-5 text-blue-600 shrink-0" />
                    <span className="font-semibold text-gray-900 truncate">
                      {course.name}
                    </span>
                  </div>
                </div>
                {course.code && (
                  <p className="text-sm text-gray-500 mt-1">{course.code}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">Click to open</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {!isCoursesLoading && courses.length === 0 && (
          <p className="text-sm text-gray-500 mt-4">
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
