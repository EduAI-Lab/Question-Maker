/**
 * Root app component: wires theme/auth providers, router, and top-level pages.
 * Defines navigation for login, landing, assessments, help, and an optional API test route.
 */
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/toaster';
import { ThemeProvider } from './components/theme-provider';
import { AuthProvider } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { CourseSelectionPage } from './pages/CourseSelectionPage';
import { LandingPage } from './pages/LandingPage';
import { ApiTestPage } from './pages/ApiTestPage';
import AssessmentViewPage from './pages/AssessmentViewPage';
import { HelpPage } from './pages/HelpPage';
import { GuidedTourProvider } from './contexts/GuidedTourContext';

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="eduquery-theme">
      <AuthProvider>
        <GuidedTourProvider>
          <Router>
            <div className="min-h-screen bg-background">
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/courses" element={<CourseSelectionPage />} />
                <Route path="/landing" element={<LandingPage />} />
                {process.env.NODE_ENV === 'development' && (
                  <Route path="/api-test" element={<ApiTestPage />} />
                )}
                <Route path="/assessments/:id" element={<AssessmentViewPage />} />
                <Route path="/help" element={<HelpPage />} />
                <Route path="/" element={<Navigate to="/login" replace />} />
              </Routes>
              <Toaster />
            </div>
          </Router>
        </GuidedTourProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
