import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

interface QuizQuestion {
  type: 'multiple_choice' | 'free_response' | 'true_false';
  question: string;
  choices?: { text: string; correct: boolean }[];
  answer?: string;
  subject: string;
  reference: string;
  userAnswer: string;
}

interface QuizResult {
  subject: string;
  correct: number;
  total: number;
}

interface DetailedQuizFeedback {
  question: string;
  type: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
  writtenResponseFeedback?: string;
  writtenResponseScore?: number;
}

async function gradeQuiz(questions: QuizQuestion[]): Promise<{ results: QuizResult[], feedback: string, detailedFeedback: DetailedQuizFeedback[] }> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  
  const prompt = `Grade the following quiz and provide detailed feedback:

${questions.map((q, i) => `
Question ${i + 1}: ${q.question}
Type: ${q.type}
Correct Answer: ${q.type === 'multiple_choice' ? q.choices?.find(c => c.correct)?.text : q.answer}
User's Answer: ${q.userAnswer}
Subject: ${q.subject}
`).join('\n')}

Provide a summary of the results, including:
1. A list of QuizResult objects with the following structure:
   {
     subject: string,
     correct: number,
     total: number
   }
2. Overall feedback on the user's performance, highlighting strengths and areas for improvement.
3. Detailed feedback for each question, including:
   - The question text
   - The type of question
   - The user's answer
   - The correct answer
   - Whether the user's answer was correct
   - A concise explanation of the correct answer
   - For free-response questions, provide a brief review of the user's written response and a correctness percentage

Return the response in the following JSON format:
{
  "results": [
    { "subject": "Subject 1", "correct": X, "total": Y },
    { "subject": "Subject 2", "correct": X, "total": Y },
    ...
  ],
  "feedback": "Overall feedback here",
  "detailedFeedback": [
    {
      "question": "Question text",
      "type": "question type",
      "userAnswer": "User's answer",
      "correctAnswer": "Correct answer",
      "isCorrect": true/false,
      "explanation": "Concise explanation",
      "writtenResponseFeedback": "Feedback for written response (if applicable)",
      "writtenResponseScore": 85 (percentage for written response, if applicable)
    },
    ...
  ]
}

Important: Return only the JSON object, without any markdown formatting or additional text.`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  // Remove any markdown formatting and find the JSON object
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('No valid JSON found in the response');
    console.error('Raw response:', responseText);
    throw new Error('Failed to extract JSON from the response');
  }
  
  const cleanJson = jsonMatch[0];
  
  try {
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Error parsing graded quiz JSON:', error);
    console.error('Extracted JSON:', cleanJson);
    throw new Error('Failed to parse graded quiz JSON');
  }
}

export async function POST(request: Request) {
  try {
    const { questions } = await request.json();

    if (!questions || !Array.isArray(questions)) {
      return NextResponse.json({ error: 'Invalid quiz data' }, { status: 400 });
    }

    const gradedQuiz = await gradeQuiz(questions);
    return NextResponse.json(gradedQuiz);
  } catch (error) {
    console.error('Error grading quiz:', error);
    return NextResponse.json({ error: 'Failed to grade quiz', details: (error as Error).message }, { status: 500 });
  }
}
