import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { setupVectorSearch, getDocumentContent } from '@/lib/vectorDb';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

interface QuizQuestion {
  type: 'multiple_choice' | 'free_response' | 'true_false';
  question: string;
  choices?: { text: string; correct: boolean }[];
  answer?: string;
  subject: string;
  reference: string;
}

interface QuizConfig {
  numQuestions: {
    multiple_choice: number;
    free_response: number;
    true_false: number;
  };
  difficulty: 'easy' | 'medium' | 'hard';
  adaptive: boolean;
}

async function generateQuiz(content: string, config: QuizConfig): Promise<QuizQuestion[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  
  const prompt = `Generate a quiz based on the following content. The quiz should have:
- ${config.numQuestions.multiple_choice} multiple-choice questions
- ${config.numQuestions.free_response} free-response questions
- ${config.numQuestions.true_false} true/false questions
The overall difficulty level should be ${config.difficulty}.

Content:
${content}

For each question, also provide:
1. The subject or topic it relates to
2. A reference to the specific part of the content it's based on

Generate the quiz in the following JSON format:
[
  {
    "type": "multiple_choice",
    "question": "Question text",
    "choices": [
      { "text": "Option A", "correct": false },
      { "text": "Option B", "correct": true },
      { "text": "Option C", "correct": false },
      { "text": "Option D", "correct": false }
    ],
    "subject": "Subject or topic",
    "reference": "Relevant excerpt or page reference"
  },
  {
    "type": "free_response",
    "question": "Question text",
    "answer": "Sample answer for evaluation",
    "subject": "Subject or topic",
    "reference": "Relevant excerpt or page reference"
  },
  {
    "type": "true_false",
    "question": "Statement to evaluate",
    "answer": true,
    "subject": "Subject or topic",
    "reference": "Relevant excerpt or page reference"
  }
]

Important: Return only the JSON array, without any markdown formatting or additional text.`;

  const result = await model.generateContent(prompt);
  const quizJson = result.response.text();
  
  // Remove any markdown formatting if present
  const cleanJson = quizJson.replace(/```json\n|\n```/g, '').trim();
  
  try {
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Error parsing quiz JSON:', error);
    console.error('Raw quiz JSON:', cleanJson);
    throw new Error('Failed to parse quiz JSON');
  }
}

export async function POST(request: Request) {
  console.log('Received POST request to /api/gen_quiz');
  try {
    const { documentId, quizConfig } = await request.json();
    console.log('Request payload:', { documentId, quizConfig });

    if (!documentId || !quizConfig) {
      console.log('Missing required fields');
      return NextResponse.json({ error: 'Document ID and quiz configuration are required' }, { status: 400 });
    }

    console.log('Setting up vector search');
    await setupVectorSearch(documentId);

    console.log('Retrieving document content');
    const content = await getDocumentContent(documentId);
    if (!content) {
      console.log('Failed to retrieve document content');
      return NextResponse.json({ error: 'Failed to retrieve document content' }, { status: 500 });
    }

    console.log('Generating quiz');
    const quiz = await generateQuiz(content, quizConfig);

    console.log('Quiz generated successfully');
    return NextResponse.json({ quiz });
  } catch (error) {
    console.error('Error in gen_quiz POST route:', error);
    return NextResponse.json({ error: 'Failed to generate quiz', details: (error as Error).message }, { status: 500 });
  }
}
