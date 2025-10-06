import { useState } from 'react';
import { Button } from '../ui/button';
import { Plus } from 'lucide-react';
import Tesseract from 'tesseract.js';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { questionService } from '../../services/questionService';
import { ExtractedQuestion, SavedExtractedQuestion } from '../../types/question';
import { ExtractedQuestionCard } from './ExtractedQuestionCard';

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

// Use shadcn/ui AlertDialog components available in this project
import {
    AlertDialog as Dialog,
    AlertDialogContent as DialogContent,
    AlertDialogDescription as DialogDescription,
    AlertDialogHeader as DialogHeader,
    AlertDialogTitle as DialogTitle,
    AlertDialogFooter as DialogFooter
} from '../ui/alert-dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface AddQuestionProps {
    courseId?: number;
    topicId?: number;
    topicName?: string;
    defaultDifficulty?: 'easy' | 'medium' | 'hard';
    questionType?: 'MCQ' | 'SA';
    onAddQuestion?: (savedQuestions: SavedExtractedQuestion[]) => Promise<void> | void;
}

export const AddQuestion = ({
    courseId,
    topicId,
    topicName,
    defaultDifficulty = 'medium',
    questionType = 'SA',
    onAddQuestion
}: AddQuestionProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractedQuestions, setExtractedQuestions] = useState<ExtractedQuestion[]>([]);
    const [extractError, setExtractError] = useState<string | null>(null);

    const resetState = () => {
        setFile(null);
        setProgress(0);
        setError(null);
        setIsProcessing(false);
        setIsSubmitting(false);
        setIsExtracting(false);
        setExtractedQuestions([]);
        setExtractError(null);
    };

    const handleAddClick = () => {
        setIsOpen(true);
        resetState();
    };

    const performOcr = async (targetFile: File): Promise<string> => {
        if (targetFile.type === 'application/pdf' || targetFile.name.toLowerCase().endsWith('.pdf')) {
            const pdfDocument = await getDocument({ data: await targetFile.arrayBuffer() }).promise;
            const pageTexts: string[] = [];

            for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
                const page = await pdfDocument.getPage(pageNumber);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                    .map((item: any) => ('str' in item ? item.str : ''))
                    .join(' ')
                    .trim();
                pageTexts.push(pageText);
                setProgress(Math.round((pageNumber / pdfDocument.numPages) * 100));
            }

            return pageTexts.join('\n\n').trim();
        }

        const { data } = await Tesseract.recognize(targetFile, 'eng', {
            logger: (m: any) => {
                if (m.status === 'recognizing text' && typeof m.progress === 'number') {
                    setProgress(Math.round(m.progress * 100));
                }
            }
        });
        return data.text.trim();
    };

    const processFile = async (selectedFile: File) => {
        resetState();
        setFile(selectedFile);
        setIsProcessing(true);
        setError(null);
        setExtractError(null);
        setExtractedQuestions([]);
        try {
            const text = await performOcr(selectedFile);

            if (!text.trim()) {
                setExtractError('No text detected in this file. Try a clearer copy.');
                return;
            }

            setIsExtracting(true);
            const results = await questionService.extractQuestionsFromText(text.trim());
            setExtractedQuestions(results);
        } catch (err: any) {
            const message = err?.response?.data?.error || err?.message || 'Failed to process file.';
            setError(message);
        } finally {
            setIsProcessing(false);
            setIsExtracting(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;
        e.target.value = '';
        processFile(selected);
    };

    const copyExtractedToClipboard = async () => {
        if (!extractedQuestions.length) return;
        const text = extractedQuestions
            .map((item, index) => {
                const instructions = item.instructions?.trim();
                return `${index + 1}. ${item.question}${instructions ? `\nInstructions: ${instructions}` : ''}`;
            })
            .join('\n\n');

        try {
            await navigator.clipboard.writeText(text);
        } catch {
            // ignore clipboard errors
        }
    };

    const handleCreateQuestion = async () => {
        if (!extractedQuestions.length) return;

        if (!courseId) {
            setError('Please select a course before saving extracted questions.');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            const saved = await questionService.saveExtractedQuestions({
                courseId,
                topicId,
                topicName,
                type: questionType,
                defaultDifficulty,
                questions: extractedQuestions
            });

            setIsOpen(false);
            resetState();
            if (onAddQuestion) {
                await onAddQuestion(saved);
            }
        } catch (err: any) {
            const message = err?.response?.data?.error || err?.message || 'Unable to save questions.';
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Button onClick={handleAddClick} className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Add Question</span>
            </Button>

            {/* OCR Modal */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Extract text from an image or PDF</DialogTitle>
                        <DialogDescription>
                            Upload a clear image (PNG/JPG) or a PDF. Images are processed with Tesseract.js, PDFs with PDF.js, then parsed for questions.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="ocr-file">Image or PDF</Label>
                            <Input
                                id="ocr-file"
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={handleFileChange}
                                disabled={isProcessing || isExtracting}
                            />
                            {file && (
                                <p className="text-xs text-gray-500 break-all">
                                    Selected: {file.name} ({Math.ceil(file.size / 1024)} KB)
                                </p>
                            )}
                        </div>

                        {error && <p className="text-sm text-red-600">{error}</p>}

                        <div className="space-y-2">
                            <Label>Extracted questions</Label>
                            {(isProcessing || isExtracting) && (
                                <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 py-6">
                                    <svg className="h-5 w-5 animate-spin text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                    </svg>
                                    <p className="text-sm font-medium text-gray-700">
                                        {isProcessing ? 'Running OCR…' : 'Extracting questions…'}
                                    </p>
                                    {isProcessing && (
                                        <div className="w-full max-w-xs h-2 bg-gray-200 rounded">
                                            <div
                                                className="h-2 bg-blue-600 rounded"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                            {extractError && <p className="text-sm text-red-600">{extractError}</p>}
                            {!isProcessing && !isExtracting && !extractError && extractedQuestions.length === 0 && (
                                <p className="text-sm text-gray-500">
                                    Upload a PDF or image to automatically extract questions.
                                </p>
                            )}
                            {extractedQuestions.length > 0 && (
                                <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
                                    <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
                                        {extractedQuestions.map((item, index) => (
                                            <ExtractedQuestionCard
                                                key={`${index}-${item.question.slice(0, 24)}`}
                                                item={item}
                                                index={index}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={copyExtractedToClipboard}
                                    disabled={extractedQuestions.length === 0 || isExtracting}
                                >
                                    Copy extracted questions
                                </Button>
                                <Button
                                    onClick={handleCreateQuestion}
                                    disabled={
                                        extractedQuestions.length === 0 ||
                                        isExtracting ||
                                        isSubmitting ||
                                        !courseId
                                    }
                                >
                                    {isSubmitting ? 'Saving…' : 'Create Question'}
                                </Button>
                            </div>
                            <p className="text-xs text-gray-500">
                                Tip: “Create Question” saves these to your question bank using the selected course.
                            </p>
                            {!courseId && (
                                <p className="text-xs text-red-600">
                                    Select a course to enable saving extracted questions.
                                </p>
                            )}
                        </div>
                    </div>

                    <DialogFooter />
                </DialogContent>
            </Dialog>
        </>
    );
};
