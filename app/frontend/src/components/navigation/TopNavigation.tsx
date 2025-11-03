import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { User, ChevronDown } from 'lucide-react';
import { Class as Course } from '../../types/class';

interface TopNavigationProps {
    selectedCourse: Course | null;
    onCourseChange: (course: Course) => void;
    activeTab: 'questions' | 'assessments';
    onTabChange: (tab: 'questions' | 'assessments') => void;
    courses: Course[];
    isLoadingCourses?: boolean;
    onProfileClick?: () => void;
}

export const TopNavigation = ({
    selectedCourse,
    onCourseChange,
    activeTab,
    onTabChange,
    courses,
    isLoadingCourses = false,
    onProfileClick
}: TopNavigationProps) => {
    return (
        <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
                {/* Left: Logo */}
                <div className="flex items-center space-x-4">
                    <div className="text-2xl font-bold text-blue-600">
                        QM
                    </div>
                </div>

                {/* Center: Course Selector and Tabs */}
                <div className="flex items-center space-x-6">
                    {/* Course Selector */}
                    <div className="flex items-center">
                        <Select
                            value={selectedCourse?.id?.toString() || ''}
                            onValueChange={(value) => {
                                const course = courses.find(c => c.id.toString() === value);
                                if (course) onCourseChange(course);
                            }}
                            disabled={isLoadingCourses || courses.length === 0}
                        >
                            <SelectTrigger className="w-80 min-w-80">
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
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                    </div>

                    {/* Tabs */}
                    <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as 'questions' | 'assessments')}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="questions">Questions</TabsTrigger>
                            <TabsTrigger value="assessments">Assessments</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                {/* Right: User Profile */}
                <div className="flex items-center space-x-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full"
                        onClick={onProfileClick}
                        aria-label="Open profile"
                    >
                        <User className="h-6 w-6" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
