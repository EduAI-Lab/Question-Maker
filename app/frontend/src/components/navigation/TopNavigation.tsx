/**
 * Top navigation bar providing course selection, tab switching, and profile/help entrypoints.
 * Accepts course data and callbacks to propagate tab/course changes to parent layouts.
 * Supports variant "course-selection" (no selector/tabs) and optional back button for landing.
 */
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Course } from '../../types/question';
import { User, HelpCircle, ArrowLeft } from 'lucide-react';
import { EduAIStatusBadge } from '../eduai/EduAIStatusBadge';
import { useEduAIStatus } from '../../hooks/useEduAIStatus';
import { useGuidedTour } from '../../contexts/GuidedTourContext';

type TopNavigationProps = (
  | {
      variant?: 'full';
      selectedCourse: Course | null;
      onCourseChange: (course: Course) => void;
      activeTab: 'questions' | 'assessments';
      onTabChange: (tab: 'questions' | 'assessments') => void;
      courses: Course[];
      isLoadingCourses?: boolean;
      onProfileClick?: () => void;
      showBackButton?: boolean;
      onBackClick?: () => void;
    }
  | {
      variant: 'course-selection';
      courses: Course[];
      isLoadingCourses?: boolean;
      onProfileClick?: () => void;
    }
);

export const TopNavigation = (props: TopNavigationProps) => {
  const {
    courses,
    isLoadingCourses = false,
    onProfileClick
  } = props;
  const isFull = props.variant !== 'course-selection';
  const showBackButton = isFull && 'showBackButton' in props && props.showBackButton;
  const onBackClick = isFull && 'onBackClick' in props ? props.onBackClick : undefined;
  const eduaiStatus = useEduAIStatus();
  const { startTour } = useGuidedTour();

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left: Back button (when on landing) + Logo */}
        <div className="flex items-center space-x-4">
          {showBackButton && onBackClick && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackClick}
              className="text-gray-600"
              aria-label="Back to course selection"
            >
              <ArrowLeft className="h-5 w-5 mr-1" />
              Back
            </Button>
          )}
          <div className="text-2xl font-bold text-blue-600">QM</div>
        </div>

        {/* Center: Course Selector and Tabs (only when variant is full) */}
        {isFull && 'selectedCourse' in props && 'onCourseChange' in props && 'activeTab' in props && 'onTabChange' in props && (
          <div className="flex items-center space-x-6">
            <div className="flex items-center">
              <Select
                value={props.selectedCourse?.id?.toString() || ''}
                onValueChange={(value) => {
                  const course = courses.find(c => c.id.toString() === value);
                  if (course) props.onCourseChange(course);
                }}
                disabled={isLoadingCourses || courses.length === 0}
              >
                <SelectTrigger className="w-80 min-w-80" data-tour-id="course-select">
                  <SelectValue
                    placeholder={isLoadingCourses ? 'Loading courses...' : 'Select Course'}
                    className="text-base font-bold"
                  />
                </SelectTrigger>
                <SelectContent>
                  {courses.length === 0 ? (
                    <SelectItem value="__no_courses" disabled>
                      {isLoadingCourses ? 'Loading...' : 'No courses available'}
                    </SelectItem>
                  ) : (
                    courses.map((course) => (
                      <SelectItem key={course.id} value={course.id.toString()} className="text-base font-semibold">
                        {course.code || '—'} - {course.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Tabs value={props.activeTab} onValueChange={(value) => props.onTabChange(value as 'questions' | 'assessments')}>
              <TabsList className="grid w-full grid-cols-2" data-tour-id="top-nav-tabs">
                <TabsTrigger value="questions">Questions</TabsTrigger>
                <TabsTrigger value="assessments" data-tour-id="assessment-tab">Assessments</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Right: User Profile */}
                <div className="flex items-center space-x-2">
                    <div data-tour-id="eduai-status">
                        <EduAIStatusBadge
                            status={eduaiStatus.status}
                            message={eduaiStatus.message}
                            onRefresh={eduaiStatus.refresh}
                            className="z-50"
                        />
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startTour('main')}
                    >
                        Guided tour
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full"
                        onClick={() => window.open('/help', '_blank', 'noopener')}
                        aria-label="Open help"
                        data-tour-id="help-button"
                    >
                        <HelpCircle className="h-5 w-5" />
                    </Button>
                    <div className="relative">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full"
                            onClick={onProfileClick}
                            data-tour-id="profile-courses-button"
                            aria-label="Open profile"
                        >
                            <User className="h-6 w-6" />
                        </Button>
                        {courses.length === 0 && !isLoadingCourses && (
                            <span className="absolute top-0 right-0 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
