import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Loader2 } from 'lucide-react';
import { useQuestions } from '../../hooks/useQuestions';
import { QuestionMetadata } from '../../types/question';
import { useToast } from '../ui/use-toast';

export const QuestionGenerator = () => {
  const [prompt, setPrompt] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('groq');
  const [numQuestions, setNumQuestions] = useState(15);
  const [difficultyDistribution, setDifficultyDistribution] = useState({
    easy: 5,
    medium: 5,
    hard: 5
  });
  const [generatedQuestions, setGeneratedQuestions] = useState<QuestionMetadata[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { generateQuestions, approveQuestions } = useQuestions();
  const { toast } = useToast();

  const handleDifficultyChange = (type: 'easy' | 'medium' | 'hard', value: number) => {
    const newValue = Math.max(0, value);
    setDifficultyDistribution(prev => ({
      ...prev,
      [type]: newValue
    }));
    setNumQuestions(prev => prev - (prev - newValue));
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a prompt"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateQuestions({
        prompt: prompt.trim(),
        provider: selectedProvider as 'groq' | 'openai' | 'deepseek',
        numQuestions,
        difficultyDistribution
      });

      if (result.success) {
        setGeneratedQuestions(result.data);
        toast({
          title: "Success",
          description: "Questions generated successfully!"
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "Failed to generate questions"
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = async () => {
    if (generatedQuestions.length === 0) return;

    try {
      const result = await approveQuestions(generatedQuestions);
      if (result.success) {
        setGeneratedQuestions([]);
        setPrompt('');
        toast({
          title: "Success",
          description: `${result.data.length} questions saved successfully!`
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "Failed to save questions"
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred"
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Questions</CardTitle>
        <CardDescription>Generate questions using AI</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Provider Selection */}
        <div className="flex justify-center">
          <div className="w-[300px]">
            <Select
              value={selectedProvider}
              onValueChange={setSelectedProvider}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select AI Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="groq">Groq (Llama)</SelectItem>
                <SelectItem value="openai">OpenAI (GPT-3.5)</SelectItem>
                <SelectItem value="deepseek">DeepSeek (Coder)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Prompt Input */}
        <Textarea
          placeholder="Enter prompt for question generation"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[150px] w-full"
        />

        {/* Settings */}
        <div className="flex justify-center">
          <div className="w-[300px] space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-center block">
                Number of Questions (Total: {numQuestions})
              </label>
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
              <label className="text-sm font-medium text-center block">
                Difficulty Distribution
              </label>
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

        {/* Generated Questions Preview */}
        {generatedQuestions.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Generated Questions Preview</h3>
            <div className="max-h-96 overflow-y-auto space-y-2 border rounded-lg p-4">
              {generatedQuestions.map((q, index) => (
                <div key={index} className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{q.content}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                      {q.difficulty}
                    </span>
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                      {q.bloom_level}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button 
          onClick={handleGenerate} 
          disabled={isGenerating || !prompt.trim()}
          className="flex-1"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Questions'
          )}
        </Button>
        
        {generatedQuestions.length > 0 && (
          <Button 
            onClick={handleApprove}
            variant="outline"
            className="flex-1"
          >
            Approve & Save
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

