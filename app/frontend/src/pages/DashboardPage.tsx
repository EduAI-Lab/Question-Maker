import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { LogOut, Moon, Sun, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../components/theme-provider';
import { QuestionList } from '../components/questions/QuestionList';
import { QuestionGenerator } from '../components/questions/QuestionGenerator';
import { FileUploadZone } from '../components/FileUploadZone';
import { ClassList } from '../components/classes/ClassList';
import { ClassForm } from '../components/classes/ClassForm';

export const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState('questions');
  const [showClassForm, setShowClassForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleFilesSelected = (files: File[]) => {
    console.log('Files selected:', files);
    // TODO: Implement file upload logic
  };

  // Show loading while authentication is being checked
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Only redirect if we're sure the user is not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className={`min-h-screen ${
      theme === 'light'
        ? 'bg-gradient-to-b from-gray-100 via-gray-200 to-gray-100'
        : 'bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900'
    } p-4`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className={`text-3xl font-bold ${
              theme === 'light' ? 'text-gray-900' : 'text-white'
            }`}>
              EduQuery.ai
            </h1>
            <p className={`text-sm ${
              theme === 'light' ? 'text-gray-600' : 'text-gray-400'
            }`}>
              Welcome back, {user?.email}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={theme === 'light' ? 'outline' : 'ghost'}
              size="icon"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className={`${theme === 'light' ? 'border-gray-200' : 'text-white'}`}
            >
              {theme === "light" ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </Button>
            <Button variant="destructive" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={`grid w-full grid-cols-5 ${
            theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'
          }`}>
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="classes">Classes</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
          </TabsList>

          <TabsContent value="questions">
            <QuestionList />
          </TabsContent>

          <TabsContent value="generate">
            <QuestionGenerator />
          </TabsContent>

          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>Upload Files</CardTitle>
                <CardContent className="pt-6">
                  <FileUploadZone 
                    onFilesSelected={handleFilesSelected}
                    isUploading={isUploading}
                  />
                </CardContent>
              </CardHeader>
            </Card>
          </TabsContent>

          <TabsContent value="classes">
            {showClassForm ? (
              <ClassForm
                onSubmit={() => setShowClassForm(false)}
                onCancel={() => setShowClassForm(false)}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Classes</h2>
                  <Button onClick={() => setShowClassForm(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Class
                  </Button>
                </div>
                <ClassList />
              </div>
            )}
          </TabsContent>

          <TabsContent value="stats">
            <Card>
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Statistics coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

