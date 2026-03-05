/**
 * Root app component: wires theme/auth providers, router, and top-level pages.
 * Defines navigation for login, landing, assessments, help, and an optional API test route.
 */
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Toaster } from './components/ui/toaster';
import { ThemeProvider } from './components/theme-provider';
import { AuthProvider } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { CourseSelectionPage } from './pages/CourseSelectionPage';
import { LandingPage } from './pages/LandingPage';
import { ApiTestPage } from './pages/ApiTestPage';
import AssessmentBuilderPage from './pages/AssessmentBuilderPage';
import { HelpPage } from './pages/HelpPage';
import { GuidedTourProvider } from './contexts/GuidedTourContext';

function RedirectAssessmentToBuilder() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/assessments/${id}/builder` : '/landing'} replace />;
}

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
                <Route path="/assessments/:id" element={<RedirectAssessmentToBuilder />} />
                <Route path="/assessments/:id/builder" element={<AssessmentBuilderPage />} />
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
