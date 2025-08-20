import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Button } from "./components/ui/button"
import { Input } from "./components/ui/input"
import { Textarea } from "./components/ui/textarea"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs"
import { ScrollArea } from "./components/ui/scroll-area"
import { Separator } from "./components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert"
import { AlertCircle, Plus, LogOut, Loader2, Moon, Sun, Trash2 } from 'lucide-react'
import { useToast } from "./components/ui/use-toast"
import { Toaster } from "./components/ui/toaster"
import { useTheme } from "./components/theme-provider"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FileUploadZone } from "./components/FileUploadZone"
import { StreamingText } from "./components/StreamingText"
import { ClassList } from "./components/ClassList"
import { ClassForm } from "./components/ClassForm"
import { Badge } from "./components/ui/badge"
import { FloatingLetters } from "./components/FloatingLetters"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import LoadingOverlay from './components/LoadingOverlay'

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Question {
  id: number;
  content: string;
  created_at: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface Class {
  id: number;
  name: string;
  subject: string;
  course_code: string | null;
  semester: string | null;
  year: number | null;
  description: string | null;
  department: string | null;
  created_at: string;
}

interface ClassFormData {
  name: string;
  subject: string;
  course_code?: string;
  semester?: string;
  year?: number;
  description?: string;
  department?: string;
}

interface QuestionMetadata {
  content: string;
  difficulty: 'easy' | 'medium' | 'hard';
  bloom_level: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
}

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [questions, setQuestions] = useState<Question[]>(() => {
    // Initialize from localStorage if available
    const cached = localStorage.getItem('questions');
    return cached ? JSON.parse(cached) : [];
  });
  const [newQuestion, setNewQuestion] = useState('');
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const { toast } = useToast()
  const questionsEndRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme()
  const [questionToDelete, setQuestionToDelete] = useState<number | null>(null);
  const [classes, setClasses] = useState<Class[]>(() => {
    // Initialize from localStorage if available
    const cached = localStorage.getItem('classes');
    return cached ? JSON.parse(cached) : [];
  });
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [showClassForm, setShowClassForm] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('questions');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState('groq');
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [numQuestions, setNumQuestions] = useState(15);
  const [difficultyDistribution, setDifficultyDistribution] = useState({
    easy: 5,
    medium: 5,
    hard: 5
  });

  // Add effect to keep numQuestions in sync with difficulty distribution
  useEffect(() => {
    const total = difficultyDistribution.easy + difficultyDistribution.medium + difficultyDistribution.hard;
    setNumQuestions(total);
  }, [difficultyDistribution]);

  // Add function to handle difficulty distribution changes
  const handleDifficultyChange = (type: 'easy' | 'medium' | 'hard', value: number) => {
    const newValue = Math.max(0, value); // Ensure non-negative numbers
    setDifficultyDistribution(prev => ({
      ...prev,
      [type]: newValue
    }));
  };

  const scrollToBottom = () => {
    questionsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (questions.length > 0) {
      scrollToBottom();
    }
  }, [questions]);

  // Update localStorage when questions change
  useEffect(() => {
    if (questions.length > 0) {
      localStorage.setItem('questions', JSON.stringify(questions));
    }
  }, [questions]);

  // Update localStorage when classes change
  useEffect(() => {
    if (classes.length > 0) {
      localStorage.setItem('classes', JSON.stringify(classes));
    }
  }, [classes]);

  const handleLogin = async () => {
    try {
      setError('');
      setLoginLoading(true);
      const response = await api.post('/login', { email, password });
      const newToken = response.data.access_token;
      
      localStorage.setItem('token', newToken);
      setToken(newToken);
      await fetchQuestions();
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.response?.data?.detail || 'Login failed');
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.response?.data?.detail || 'Invalid email or password',
        duration: 3000,
      });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async () => {
    try {
      setError('');
      setRegisterLoading(true);
      const response = await api.post('/register', { email, password });
      const newToken = response.data.access_token;
      
      toast({
        variant: "default",
        title: "Welcome to EduQuery.ai!",
        description: "Your account has been created successfully",
        duration: 3000,
      });

      localStorage.setItem('token', newToken);
      setToken(newToken);
    } catch (error: any) {
      console.error('Registration error:', error);
      setError(error.response?.data?.detail || 'Registration failed');
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.response?.data?.detail || 'Could not create account',
        duration: 3000,
      });
    } finally {
      setRegisterLoading(false);
    }
  };

  const fetchQuestions = async () => {
    try {
      setError('');
      const currentToken = localStorage.getItem('token');
      if (!currentToken) {
        setError('No authentication token available');
        return;
      }

      const response = await api.get('/questions');
      setQuestions(response.data);
      localStorage.setItem('questions', JSON.stringify(response.data));
    } catch (error: any) {
      console.error('Error fetching questions:', error);
      setError(error.response?.data?.detail || 'Failed to fetch questions');
      if (error.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('questions');
    localStorage.removeItem('classes');
    setToken(null);
    setQuestions([]);
    setClasses([]);
  };

  // Initial data fetch
  useEffect(() => {
    const currentToken = localStorage.getItem('token');
    if (currentToken) {
      setToken(currentToken);
      Promise.all([fetchQuestions(), fetchClasses()]);
    } else {
      setIsLoading(false);
    }
  }, []);

  const createQuestion = async () => {
    try {
      setError('');
      
      // Make API call first to get the classifications
      const response = await api.post('/questions', { content: newQuestion });
      
      // Add the new question with the correct classifications from the server
      const newQuestionData = {
        id: response.data.id,
        content: response.data.content,
        created_at: response.data.created_at,
        difficulty: response.data.difficulty,
        bloom_level: response.data.bloom_level
      };
      
      // Update questions list with the new question
      setQuestions(prevQuestions => [newQuestionData, ...prevQuestions]);
      
      // Clear input
      setNewQuestion('');
      
      toast({
        title: "Success",
        description: "Question created successfully",
        duration: 3000,
      });
    } catch (error: any) {
      console.error('Error creating question:', error);
      setError(error.response?.data?.detail || 'Failed to create question');
      if (error.response?.status === 401) {
        handleLogout();
      }
      
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.detail || 'Failed to create question',
        duration: 3000,
      });
    }
  };

  const handleGenerateQuestions = async (prompt: string) => {
    try {
      setIsGenerating(true);
      const response = await fetch(`${API_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt,
          provider: selectedProvider,
          num_questions: numQuestions,
          difficulty_distribution: difficultyDistribution
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate questions');
      }

      const data = await response.json();
      const formattedQuestions = data.questions.map((q: QuestionMetadata) => 
        `${q.content}\n[Difficulty: ${q.difficulty}, Bloom's Level: ${q.bloom_level}]`
      ).join('\n\n');
      
      setGeneratedText(formattedQuestions);
      setPendingQuestion(formattedQuestions);
        setPrompt('');
        
        toast({
          title: "Success",
        description: "Questions generated! Please review and approve.",
          duration: 3000,
        });
    } catch (error) {
      console.error('Error generating questions:', error);
      toast.error('Failed to generate questions. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApproveQuestion = async () => {
    if (generatedText) {
      try {
        // Parse the text into individual questions and metadata
        const questions = generatedText
          .split('\n\n')  // Split by double newline to separate questions
          .filter(block => block.trim())  // Remove empty blocks
          .map(block => {
            try {
              // Try to parse as JSON first
              return JSON.parse(block);
            } catch {
              // If not JSON, try to extract metadata from text format
              const lines = block.split('\n');
              const content = lines[0].trim();
              const metadataLine = lines[1] || '';
              
              // Extract difficulty and bloom level from metadata
              const difficultyMatch = metadataLine.match(/Difficulty: (\w+)/i);
              const bloomMatch = metadataLine.match(/Bloom's Level: (\w+)/i);
              
              return {
                content: content,
                difficulty: (difficultyMatch ? difficultyMatch[1].toLowerCase() : 'medium'),
                bloom_level: (bloomMatch ? bloomMatch[1].toLowerCase() : 'understand')
              };
            }
          });

        if (questions.length === 0) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "No valid questions found in the generated text.",
            duration: 3000,
          });
          return;
        }

        // Send questions for approval
        const response = await api.post('/questions/approve', questions);
        
        if (response.data && response.data.questions) {
          // Update the questions list with the new questions
          setQuestions(prev => [...response.data.questions, ...prev]);
          
          // Clear the generated text and pending question
          setGeneratedText('');
          setPendingQuestion(null);
          
          toast({
            title: "Success",
            description: `${response.data.questions.length} questions saved successfully`,
            duration: 3000,
          });
        }
      } catch (error: any) {
        console.error('Error processing questions:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to process questions",
          duration: 3000,
        });
      }
    }
  };

  const handleDeleteQuestion = async (questionId: number) => {
    setQuestionToDelete(questionId);
  };

  const confirmDelete = async () => {
    if (questionToDelete) {
      try {
        await api.delete(`/questions/${questionToDelete}`);
        toast({
          title: "Success",
          description: "Question deleted successfully",
        });
        await fetchQuestions();
      } catch (error: any) {
        console.error('Error deleting question:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error.response?.data?.detail || 'Failed to delete question',
        });
        if (error.response?.status === 401) {
          handleLogout();
        }
      }
      setQuestionToDelete(null);
    }
  };

  useEffect(() => {
    return () => {
      window.onbeforeunload = null;
    };
  }, []);

  const fetchClasses = async () => {
    try {
      const response = await api.get('/classes');
      setClasses(response.data);
      localStorage.setItem('classes', JSON.stringify(response.data));
    } catch (error: any) {
      console.error('Error fetching classes:', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateClass = async (classData: ClassFormData) => {
    try {
      await api.post('/classes', classData);
      await fetchClasses();
      setShowClassForm(false);
      toast({
        title: "Success",
        description: "Class created successfully",
      });
    } catch (error: any) {
      console.error('Error creating class:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.detail || 'Failed to create class',
      });
    }
  };

  const handleEditClass = async (classData: Class) => {
    try {
      const editableData: ClassFormData = {
        name: classData.name,
        subject: classData.subject,
        course_code: classData.course_code || undefined,
        semester: classData.semester || undefined,
        year: classData.year || undefined,
        description: classData.description || undefined,
        department: classData.department || undefined,
      };

      await api.put(`/classes/${classData.id}`, editableData);
      await fetchClasses();
      setSelectedClass(null);
      setShowClassForm(false);
      toast({
        title: "Success",
        description: "Class updated successfully",
      });
    } catch (error: any) {
      console.error('Error updating class:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.detail || 'Failed to update class',
      });
    }
  };

  const handleDeleteClass = async (classId: number) => {
    try {
      await api.delete(`/classes/${classId}`);
      await fetchClasses();
      toast({
        title: "Success",
        description: "Class deleted successfully",
      });
    } catch (error: any) {
      console.error('Error deleting class:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.detail || 'Failed to delete class',
      });
    }
  };

  const handleReclassifyQuestions = async () => {
    try {
      const response = await api.post('/questions/reclassify');
      await fetchQuestions(); // Refresh questions after reclassification
      
      toast({
        title: "Success",
        description: response.data.message,
        duration: 3000,
      });
    } catch (error: any) {
      console.error('Error reclassifying questions:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.detail || 'Failed to reclassify questions',
        duration: 3000,
      });
    }
  };

  const getFilteredQuestions = () => {
    return questions
      .filter(q => q.content.trim() !== '')
      .filter(q => {
        // Apply difficulty filter
        if (difficultyFilter !== 'all') {
          return q.difficulty === difficultyFilter;
        }
        return true;
      })
      .filter(q => {
        // Apply search filter
        if (searchQuery.trim()) {
          return q.content.toLowerCase().includes(searchQuery.toLowerCase());
        }
        return true;
      });
  };

  const renderQuestionsList = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    const filteredQuestions = getFilteredQuestions();

    return (
      <div className="space-y-4">
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <Input
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="w-[200px]">
            <Select
              value={difficultyFilter}
              onValueChange={setDifficultyFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Difficulties</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className={`h-[600px] rounded-md border p-4 ${
          theme === 'light' ? 'border-gray-200' : 'border-gray-700'
        }`}>
          <div className="space-y-4">
            {filteredQuestions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery || difficultyFilter !== 'all' ? 
                  'No questions match your filters' : 
                  'No questions available'}
              </div>
            ) : (
              filteredQuestions.map((question) => (
                <Card key={question.id}>
                  <CardContent className="pt-6 relative">
                    <div className="flex justify-between items-start gap-4">
                      <p className={`flex-1 ${theme === 'light' ? 'text-gray-800' : 'text-gray-200'}`}>
                        {question.content}
                      </p>
                      <div className="flex flex-col items-end gap-2 min-w-[140px]">
                        <div className="flex gap-2">
                          <Badge
                            variant="outline"
                            className={`capitalize whitespace-nowrap ${
                              question.difficulty === 'easy' 
                                ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' 
                                : question.difficulty === 'medium'
                                ? 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800'
                                : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                            }`}
                          >
                            {question.difficulty || 'medium'}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`capitalize whitespace-nowrap ${
                              question.bloom_level === 'remember' || question.bloom_level === 'understand'
                                ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                                : question.bloom_level === 'apply' || question.bloom_level === 'analyze'
                                ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800'
                                : 'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800'
                            }`}
                          >
                            {question.bloom_level}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`hover:bg-red-100 hover:text-red-500 ${
                            theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                          }`}
                          onClick={() => handleDeleteQuestion(question.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className={`text-xs mt-2 ${
                      theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      {new Date(question.created_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  // Update the file upload handler
  const handleFileUpload = async (files: File[]) => {
    try {
      setIsUploading(true);
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });
      
      formData.append('provider', selectedProvider);
      
      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (response.data.generated_questions) {
        const firstQuestions = response.data.generated_questions[0];
        setGeneratedText(firstQuestions);
        setPendingQuestion(firstQuestions);
        setActiveTab('generate');
        
        if (response.data.generated_questions.length > 1) {
          toast({
            title: "Note",
            description: `${response.data.generated_questions.length - 1} more files with questions pending review.`,
            duration: 5000,
          });
        }
        
        toast({
          title: "Success",
          description: "Questions generated! Please review and approve."
        });
      }
      
      if (response.data.failed_files) {
        response.data.failed_files.forEach((failure: any) => {
          toast({
            variant: "destructive",
            title: `Failed to process ${failure.filename}`,
            description: failure.error
          });
        });
      }
    } catch (error: any) {
      console.error('Error processing file:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.detail || 'Failed to process file'
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (!token) {
    return (
      <div className={`min-h-screen ${
        theme === 'light' 
          ? 'bg-gradient-to-b from-gray-100 via-gray-200 to-gray-100' 
          : 'bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900'
      } flex items-center justify-center p-4 relative overflow-hidden`}>
        <FloatingLetters />
        <div className="absolute top-4 right-4">
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
        </div>
        <Card className="w-full max-w-md relative bg-background/80 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">EduQuery.ai</CardTitle>
            <CardDescription className="text-center">
              AI-Powered Question Generation Platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-4">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loginLoading || registerLoading}
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loginLoading || registerLoading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button 
              className="flex-1" 
              onClick={handleLogin} 
              disabled={loginLoading || registerLoading}
            >
              {loginLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Login
            </Button>
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={handleRegister} 
              disabled={loginLoading || registerLoading}
            >
              {registerLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Register
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${
      theme === 'light'
        ? 'bg-gradient-to-b from-gray-100 via-gray-200 to-gray-100'
        : 'bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900'
    } p-4`}>
      <LoadingOverlay 
        isVisible={isGenerating || isUploading} 
        message={isUploading ? "Processing files and generating questions..." : "Generating questions... Please wait"}
      />
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className={`text-3xl font-bold ${
            theme === 'light' ? 'text-gray-900' : 'text-white'
          }`}>EduQuery.ai</h1>
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
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="questions" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={`grid w-full grid-cols-5 ${
            theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'
          }`}>
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="create">Create</TabsTrigger>
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="classes">Courses</TabsTrigger>
          </TabsList>

          <TabsContent value="classes">
            {showClassForm ? (
              <ClassForm
                onSubmit={async (data: ClassFormData) => {
                  if (selectedClass) {
                    await handleEditClass({ ...selectedClass, ...data });
                  } else {
                    await handleCreateClass(data);
                  }
                }}
                onCancel={() => {
                  setShowClassForm(false);
                  setSelectedClass(null);
                }}
                initialData={selectedClass ? {
                  name: selectedClass.name,
                  subject: selectedClass.subject,
                  course_code: selectedClass.course_code || undefined,
                  semester: selectedClass.semester || undefined,
                  year: selectedClass.year || undefined,
                  description: selectedClass.description || undefined,
                  department: selectedClass.department || undefined,
                } : undefined}
                isLoading={false}
              />
            ) : (
              <ClassList
                classes={classes}
                onEdit={(classItem) => {
                  setSelectedClass(classItem);
                  setShowClassForm(true);
                }}
                onDelete={handleDeleteClass}
                onCreate={() => {
                  setSelectedClass(null);
                  setShowClassForm(true);
                }}
              />
            )}
          </TabsContent>

          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>Create New Question</CardTitle>
                <CardDescription>Enter your question manually</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Enter question"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  className="min-h-[100px]"
                />
              </CardContent>
              <CardFooter>
                <Button onClick={createQuestion} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Question
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="generate">
            <Card>
              <CardHeader>
                <CardTitle>Generate Questions</CardTitle>
                <CardDescription>Generate questions using AI</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex justify-center">
                    <div className="w-[300px]">
                      <Select
                        value={selectedProvider}
                        onValueChange={setSelectedProvider}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="groq">Groq (Llama)</SelectItem>
                          <SelectItem value="deepseek">DeepSeek (R1)</SelectItem>
                          <SelectItem value="openai">OpenAI (O3-mini)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="w-full">
                  <Textarea
                    placeholder="Enter prompt for question generation"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                      className="min-h-[150px] w-full"
                    />
                  </div>

                  <div className="flex justify-center">
                    <div className="w-[300px] space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-center block">Number of Questions (Total: {numQuestions})</label>
                        <Input
                          type="number"
                          min="1"
                          max="50"
                          value={numQuestions}
                          disabled
                          className="bg-gray-100 dark:bg-gray-800 text-center"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-center block">Difficulty Distribution</label>
                        <div className="grid gap-2">
                          <div className="flex items-center gap-2">
                            <label className="text-sm w-20 text-right">Easy:</label>
                            <Input
                              type="number"
                              min="0"
                              value={difficultyDistribution.easy}
                              onChange={(e) => handleDifficultyChange('easy', parseInt(e.target.value) || 0)}
                              className="text-center"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm w-20 text-right">Medium:</label>
                            <Input
                              type="number"
                              min="0"
                              value={difficultyDistribution.medium}
                              onChange={(e) => handleDifficultyChange('medium', parseInt(e.target.value) || 0)}
                              className="text-center"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm w-20 text-right">Hard:</label>
                            <Input
                              type="number"
                              min="0"
                              value={difficultyDistribution.hard}
                              onChange={(e) => handleDifficultyChange('hard', parseInt(e.target.value) || 0)}
                              className="text-center"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isGenerating && (
                    <div className="p-4 border rounded-lg bg-muted">
                      <StreamingText text={generatedText} />
                    </div>
                  )}
                  {!isGenerating && generatedText && (
                    <Card className="relative border-primary mt-4">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <Textarea
                            value={generatedText}
                            onChange={(e) => setGeneratedText(e.target.value)}
                            className="min-h-[600px] flex-1 mr-4 text-base leading-relaxed"
                            placeholder="Edit generated questions here..."
                            style={{ resize: 'vertical' }}
                          />
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-500 hover:text-green-600 hover:bg-green-50"
                              onClick={() => {
                                handleApproveQuestion();
                                setGeneratedText('');
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => {
                                setGeneratedText('');
                                setPendingQuestion(null);
                              }}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={() => handleGenerateQuestions(prompt)} 
                  className="w-full"
                  disabled={isGenerating || !prompt.trim()}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate'
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>Upload File</CardTitle>
                <CardDescription>
                  Upload files to generate questions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  <div className="flex justify-center">
                    <div className="w-[300px]">
                      <Select
                        value={selectedProvider}
                        onValueChange={setSelectedProvider}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="groq">Groq (Llama)</SelectItem>
                          <SelectItem value="deepseek">DeepSeek (R1)</SelectItem>
                          <SelectItem value="openai">OpenAI (O3-mini)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                <FileUploadZone
                    onFilesSelected={handleFileUpload}
                    isUploading={isUploading}
                  />

                  <div className="flex justify-center">
                    <div className="w-[300px] space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-center block">Number of Questions (Total: {numQuestions})</label>
                        <Input
                          type="number"
                          min="1"
                          max="50"
                          value={numQuestions}
                          disabled
                          className="bg-gray-100 dark:bg-gray-800 text-center"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-center block">Difficulty Distribution</label>
                        <div className="grid gap-2">
                          <div className="flex items-center gap-2">
                            <label className="text-sm w-20 text-right">Easy:</label>
                            <Input
                              type="number"
                              min="0"
                              value={difficultyDistribution.easy}
                              onChange={(e) => handleDifficultyChange('easy', parseInt(e.target.value) || 0)}
                              className="text-center"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm w-20 text-right">Medium:</label>
                            <Input
                              type="number"
                              min="0"
                              value={difficultyDistribution.medium}
                              onChange={(e) => handleDifficultyChange('medium', parseInt(e.target.value) || 0)}
                              className="text-center"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm w-20 text-right">Hard:</label>
                            <Input
                              type="number"
                              min="0"
                              value={difficultyDistribution.hard}
                              onChange={(e) => handleDifficultyChange('hard', parseInt(e.target.value) || 0)}
                              className="text-center"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Separator className={`my-8 ${
          theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'
        }`} />

        <Card className="mt-8">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
            <CardTitle>Your Questions</CardTitle>
            <CardDescription>View all your created questions</CardDescription>
              </div>
                      <Button
                variant="outline"
                size="sm"
                onClick={handleReclassifyQuestions}
                className="ml-4"
                disabled={isLoading}
              >
                Reclassify All
                      </Button>
              </div>
          </CardHeader>
          <CardContent className="w-full max-w-[1200px] mx-auto">
            {renderQuestionsList()}
          </CardContent>
        </Card>
      </div>
      <AlertDialog open={questionToDelete !== null} onOpenChange={() => setQuestionToDelete(null)}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This action cannot be undone. This will permanently delete the question.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-foreground bg-secondary hover:bg-secondary/80">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Toaster />
    </div>
  );
}

export default App; 