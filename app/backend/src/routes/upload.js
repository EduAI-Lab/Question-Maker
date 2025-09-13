import express from 'express';
import multer from 'multer';
import { generateQuestions, AI_PROVIDERS } from '../services/aiService.js';
import { authenticateToken } from '../middleware/auth.js';
import { config } from '../config/settings.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxFileSize
  },
  fileFilter: (req, file, cb) => {
    if (config.allowedFileTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
  }
});

// Simple text extraction function
const extractTextFromFile = (file) => {
  return new Promise((resolve, reject) => {
    if (file.mimetype === 'text/plain') {
      resolve(file.buffer.toString('utf-8'));
    } else if (file.mimetype === 'application/pdf') {
      // For now, return a placeholder. In production, you'd use a PDF parser
      resolve('PDF content extraction not implemented yet. Please use text files for now.');
    } else if (file.mimetype === 'application/msword' || 
               file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // For now, return a placeholder. In production, you'd use a Word parser
      resolve('Word document content extraction not implemented yet. Please use text files for now.');
    } else {
      reject(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  });
};

// @route   POST /api/upload
// @desc    Upload files and generate questions
// @access  Private
router.post('/', authenticateToken, upload.array('files', 5), async (req, res, next) => {
  try {
    const { provider = AI_PROVIDERS.GROQ, numQuestions = 15, difficultyDistribution } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const generatedQuestions = [];
    const failedFiles = [];

    for (const file of files) {
      try {
        // Extract text from file
        const fileText = await extractTextFromFile(file);
        
        if (!fileText.trim()) {
          failedFiles.push({
            filename: file.originalname,
            error: 'Could not extract text from file'
          });
          continue;
        }

        // Generate questions
        const params = {
          numQuestions: parseInt(numQuestions) || 15,
          difficultyDistribution: difficultyDistribution ? JSON.parse(difficultyDistribution) : {
            easy: 5,
            medium: 5,
            hard: 5
          }
        };

        const questions = await generateQuestions(fileText, provider, params);
        
        generatedQuestions.push({
          filename: file.originalname,
          questions
        });

      } catch (error) {
        failedFiles.push({
          filename: file.originalname,
          error: error.message
        });
      }
    }

    if (generatedQuestions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No questions could be generated from any files',
        failedFiles
      });
    }

    res.json({
      success: true,
      message: 'Files processed successfully',
      data: {
        generatedQuestions,
        failedFiles: failedFiles.length > 0 ? failedFiles : undefined
      }
    });

  } catch (error) {
    next(error);
  }
});

export default router;

