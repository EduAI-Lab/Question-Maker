/**
 * Login/Registration page with dark hero, floating letters, and below-fold info + video.
 * Redirects authenticated users to the homepage.
 */
import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { AlertCircle, Loader2, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { FloatingLetters } from '../components/FloatingLetters';

const VIDEO_URL = 'https://www.youtube.com/embed/zaKLdf8DmfU';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [scrollOpacity, setScrollOpacity] = useState(1);
  const { login, register, isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      const fadeDistance = 200;
      const opacity = Math.max(0, 1 - window.scrollY / fadeDistance);
      setScrollOpacity(opacity);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#10151c]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/courses" replace />;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = isLogin
        ? await login(email, password)
        : await register(email, password);

      if (!result.success) {
        setError(result.error || 'An error occurred');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToInfo = () => {
    window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
  };

  return (
    <main className="relative min-h-screen bg-[#10151c] overflow-hidden">
      <FloatingLetters letterClassName="text-slate-500 font-mono" />

      {/* Hero Section - Login (full viewport) */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4">
        <Card className="w-full max-w-sm border-gray-200 bg-white text-gray-900 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-gray-800">Question Maker</CardTitle>
            <CardDescription className="text-gray-500">
              AI-Powered Question and Assessment Management
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                disabled={isLoading}
                className="border-[#2C3A48]/30 bg-[#2C3A48] text-white placeholder:text-gray-400 focus-visible:ring-[#384654]"
                required
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                disabled={isLoading}
                minLength={6}
                className="border-[#2C3A48]/30 bg-[#2C3A48] text-white placeholder:text-gray-400 focus-visible:ring-[#384654]"
                required
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button
                type="submit"
                className="w-full bg-[#384654] text-white hover:bg-[#455563]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {isLogin ? 'Login' : 'Register'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full border-[#6D7B89] bg-[#6D7B89] text-white hover:bg-[#7d8b99] hover:text-white"
                onClick={() => setIsLogin(!isLogin)}
                disabled={isLoading}
              >
                {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <button
          type="button"
          onClick={scrollToInfo}
          className="absolute bottom-8 flex flex-col items-center gap-2 text-slate-400 transition-opacity hover:text-slate-300"
          style={{ opacity: scrollOpacity }}
          aria-label="Scroll to learn more"
        >
          <span className="text-sm font-medium">Learn more</span>
          <ChevronDown className="h-6 w-6 animate-bounce" />
        </button>
      </section>

      {/* Info Section - Below the fold */}
      <section className="relative z-10 px-4 pb-16 pt-8">
        <div className="mx-auto max-w-3xl text-center text-slate-100">
          <h1 className="mb-8 text-3xl font-bold text-balance lg:text-4xl">
            Welcome to Question Maker
          </h1>

          <div className="mb-10 space-y-4 text-left text-slate-300 leading-relaxed">
            <p>
              Question Maker is a platform for organizing and managing your assessment
              questions in one place. Instead of searching through past assignments and
              files, you can store questions in a structured question bank and easily
              reuse them across courses and assessments.
            </p>

            <p>
              The platform includes built-in{' '}
              <strong className="text-slate-100">question variant generation</strong>,
              allowing you to quickly create new versions of existing questions without
              manually rewriting them. Questions can be tagged with topics and metadata,
              making them easy to search, filter, and reuse when building assessments.
            </p>

            <p>
              You can also upload questions or past assessments directly into the system,
              organize them within your question bank, and assemble new assessments using
              the search and filtering tools. Once completed, assessments can be exported
              to <strong className="text-slate-100">Canvas</strong> or{' '}
              <strong className="text-slate-100">TXT format</strong>, enabling smooth
              integration with your existing assessment workflow.
            </p>

            <p className="text-center">Watch the short video below to see how the platform works.</p>
          </div>

          <div className="mx-auto aspect-video w-full max-w-2xl overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900/50">
            <iframe
              src={VIDEO_URL}
              title="Question Maker Demo Video"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </section>
    </main>
  );
};
