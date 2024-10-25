'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageSquare, BookOpen, HelpCircle, Paperclip, Send, Edit2, Save, RefreshCw, Image as ImageIcon } from 'lucide-react'
import axios from 'axios'
import { InlineMath, BlockMath } from 'react-katex'
import 'katex/dist/katex.min.css'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { debounce } from 'lodash'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const MarkdownRenderer: React.FC<{ children: string }> = ({ children }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ node, ...props }) => <p className="mb-2" {...props} />,
        h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-2" {...props} />,
        h2: ({ node, ...props }) => <h2 className="text-xl font-bold mb-2" {...props} />,
        h3: ({ node, ...props }) => <h3 className="text-lg font-bold mb-2" {...props} />,
        ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2" {...props} />,
        ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2" {...props} />,
        li: ({ node, ...props }) => <li className="mb-1" {...props} />,
        blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-gray-300 pl-4 italic mb-2" {...props} />,
        code: ({ node, className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className || '')
          return !className ? (
            <code className="bg-gray-100 rounded px-1" {...props}>
              {children}
            </code>
          ) : (
            <pre className="bg-gray-100 rounded p-2 mb-2">
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          )
        },
        table: ({ node, ...props }) => <table className="border-collapse border border-gray-300 mb-2" {...props} />,
        th: ({ node, ...props }) => <th className="border border-gray-300 px-4 py-2 bg-gray-100" {...props} />,
        td: ({ node, ...props }) => <td className="border border-gray-300 px-4 py-2" {...props} />,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

interface QuizQuestion {
  type: 'multiple_choice' | 'free_response' | 'true_false';
  question: string;
  choices?: { text: string; correct: boolean }[];
  answer?: string;
  subject: string;
  reference: string;
  userAnswer?: string;
}

interface QuizResult {
  subject: string;
  correct: number;
  total: number;
  feedback: string;
}

interface QuizConfig {
  numQuestions: {
    multiple_choice: number;
    free_response: number;
    true_false: number;
  };
  difficulty: 'easy' | 'medium' | 'hard';
  focus: string;
  pageRange: [number, number];
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

interface SearchResult {
  content: string;
  page: number;
}

export default function PDFAIPanel({ pdfUrl, currentPage, totalPages }: { pdfUrl: string | null, currentPage: number, totalPages: number }) {
  const [activePanel, setActivePanel] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [notes, setNotes] = useState('')
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [streamingContent, setStreamingContent] = useState('')
  const [quizResults, setQuizResults] = useState<QuizResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [quizConfig, setQuizConfig] = useState<QuizConfig>({
    numQuestions: {
      multiple_choice: 3,
      free_response: 2,
      true_false: 2,
    },
    difficulty: 'medium',
    focus: '',
    pageRange: [1, totalPages],
  });
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizFeedback, setQuizFeedback] = useState<string>('');
  const [detailedQuizFeedback, setDetailedQuizFeedback] = useState<DetailedQuizFeedback[]>([]);
  const [notesFocus, setNotesFocus] = useState('');
  const [quizPageRange, setQuizPageRange] = useState<[number, number]>([1, totalPages]);
  const [notesPageRange, setNotesPageRange] = useState<[number, number]>([currentPage, currentPage]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.trim() === '') {
        setSearchResults([]);
        return;
      }
      try {
        const response = await axios.post('/api/search', { query, pdfUrl });
        setSearchResults(response.data.results);
      } catch (error) {
        console.error('Error searching:', error);
      }
    }, 300),
    [pdfUrl]
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  const SearchBar = () => (
    <div className="relative w-full mb-4">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search in document..."
        className="w-full p-2 border border-gray-300 rounded-md"
      />
      {searchResults.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {searchResults.map((result, index) => (
            <div key={index} className="p-2 hover:bg-gray-100 cursor-pointer">
              <p className="text-sm">{result.content}</p>
              <p className="text-xs text-gray-500">Page: {result.page}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatMessages, streamingContent])

  const handleRagChat = useCallback(async () => {
    if (inputMessage.trim()) {
      setIsLoading(true);
      setChatMessages(prev => [...prev, { role: 'user', content: inputMessage }]);
      setStreamingContent('');
      try {
        const response = await axios.post('/api/RAG', {
          question: inputMessage,
          content: pdfUrl,
          documentId: pdfUrl,
          fileType: 'pdf'
        });
        const answer = response.data.answer;
        
        // Increase streaming speed (2.5x faster)
        for (let i = 0; i < answer.length; i += 2) {
          await new Promise(resolve => setTimeout(resolve, 4)); // Reduced delay
          setStreamingContent(prev => prev + answer.slice(i, i + 2));
        }
        
        setChatMessages(prev => [...prev, { role: 'assistant', content: answer }]);
        setStreamingContent('');
      } catch (error) {
        console.error('Error in RAG chat:', error);
        setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, an error occurred. Please try again.' }]);
      } finally {
        setIsLoading(false);
        setInputMessage('');
      }
    }
  }, [inputMessage, pdfUrl]);

  const handleGenerateNotes = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await axios.post('/api/gen_notes', {
        pdfUrl,
        pageRange: notesPageRange,
        focus: notesFocus
      })
      setNotes(response.data.notes)
      setIsEditingNotes(true)
    } catch (error) {
      console.error('Error generating notes:', error)
      setNotes('An error occurred while generating notes. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [pdfUrl, notesPageRange, notesFocus])

  const handleStartQuiz = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.post('/api/gen_quiz', {
        documentId: pdfUrl,
        quizConfig,
      });
      setQuizQuestions(response.data.quiz);
      setCurrentQuestionIndex(0);
      setQuizResults([]);
      setShowResults(false);
      setQuizAnswers({});
    } catch (error) {
      console.error('Error generating quiz:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Server response:', error.response.data);
      }
      alert('Failed to generate quiz. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [pdfUrl, quizConfig]);

  const handleAnswerSelect = useCallback((answer: string) => {
    setQuizAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: answer
    }));
  }, [currentQuestionIndex]);

  const handleQuizSubmit = useCallback(async () => {
    setIsLoading(true);
    try {
      const answeredQuestions = quizQuestions.map((q, index) => ({
        ...q,
        userAnswer: quizAnswers[index] || ''
      }));

      const response = await axios.post('/api/grade_quiz', {
        questions: answeredQuestions
      });

      setQuizResults(response.data.results);
      setQuizFeedback(response.data.feedback);
      setDetailedQuizFeedback(response.data.detailedFeedback);
      setShowResults(true);
    } catch (error) {
      console.error('Error submitting quiz:', error);
      alert('Failed to submit quiz. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [quizQuestions, quizAnswers]);

  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // All questions answered, submit for grading
      handleQuizSubmit();
    }
  }, [currentQuestionIndex, quizQuestions.length, handleQuizSubmit]);

  const handleNewQuiz = useCallback(() => {
    setQuizQuestions([]);
    setCurrentQuestionIndex(0);
    setQuizResults([]);
    setShowResults(false);
    setQuizAnswers({});
    setQuizConfig({
      numQuestions: {
        multiple_choice: 3,
        free_response: 2,
        true_false: 2,
      },
      difficulty: 'medium',
      focus: '',
      pageRange: [1, totalPages],
    });
  }, [totalPages]);

  const PageRangeInputs = ({ value, onChange, min, max }: { value: [number, number], onChange: (value: [number, number]) => void, min: number, max: number }) => {
    return (
      <div className="flex items-center space-x-2">
        <Input
          type="number"
          value={value[0]}
          onChange={(e) => onChange([Math.max(min, Math.min(max, parseInt(e.target.value))), value[1]])}
          min={min}
          max={max}
          className="w-20"
        />
        <span>to</span>
        <Input
          type="number"
          value={value[1]}
          onChange={(e) => onChange([value[0], Math.max(min, Math.min(max, parseInt(e.target.value)))])}
          min={min}
          max={max}
          className="w-20"
        />
      </div>
    );
  };

  const renderQuizConfig = () => (
    <div className="space-y-6">
      <div>
        <Label>Number of Questions</Label>
        <div className="grid grid-cols-3 gap-4 mt-2">
          <div>
            <Label>Multiple Choice</Label>
            <Input
              type="number"
              value={quizConfig.numQuestions.multiple_choice}
              onChange={(e) => setQuizConfig(prev => ({
                ...prev,
                numQuestions: { ...prev.numQuestions, multiple_choice: parseInt(e.target.value) }
              }))}
              min={0}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Free Response</Label>
            <Input
              type="number"
              value={quizConfig.numQuestions.free_response}
              onChange={(e) => setQuizConfig(prev => ({
                ...prev,
                numQuestions: { ...prev.numQuestions, free_response: parseInt(e.target.value) }
              }))}
              min={0}
              className="mt-1"
            />
          </div>
          <div>
            <Label>True/False</Label>
            <Input
              type="number"
              value={quizConfig.numQuestions.true_false}
              onChange={(e) => setQuizConfig(prev => ({
                ...prev,
                numQuestions: { ...prev.numQuestions, true_false: parseInt(e.target.value) }
              }))}
              min={0}
              className="mt-1"
            />
          </div>
        </div>
      </div>
      <div>
        <Label>Difficulty</Label>
        <RadioGroup
          value={quizConfig.difficulty}
          onValueChange={(value) => setQuizConfig(prev => ({ ...prev, difficulty: value as 'easy' | 'medium' | 'hard' }))}
          className="flex space-x-4 mt-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="easy" id="easy" />
            <Label htmlFor="easy">Easy</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="medium" id="medium" />
            <Label htmlFor="medium">Medium</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="hard" id="hard" />
            <Label htmlFor="hard">Hard</Label>
          </div>
        </RadioGroup>
      </div>
      <div>
        <Label>Focus (Optional)</Label>
        <Input
          value={quizConfig.focus}
          onChange={(e) => setQuizConfig(prev => ({ ...prev, focus: e.target.value }))}
          placeholder="Enter a specific topic or keyword"
          className="mt-1"
        />
      </div>
      <div>
        <Label>Page Range</Label>
        <PageRangeInputs
          value={quizConfig.pageRange}
          onChange={(value) => setQuizConfig(prev => ({ ...prev, pageRange: value }))}
          min={1}
          max={totalPages}
        />
      </div>
      <Button onClick={handleStartQuiz} disabled={isLoading} className="w-full">
        {isLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
        Start Quiz
      </Button>
    </div>
  );

  const renderQuizQuestion = useCallback(() => {
    if (currentQuestionIndex >= quizQuestions.length) return null;
    const question = quizQuestions[currentQuestionIndex];
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
        <h3 className="text-xl font-semibold">{question.question}</h3>
        {question.type === 'multiple_choice' && (
          <div className="space-y-2">
            {question.choices?.map((choice, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Button
                  onClick={() => handleAnswerSelect(choice.text)}
                  className={`w-full text-left justify-start py-4 px-6 border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                    quizAnswers[currentQuestionIndex] === choice.text ? 'bg-purple-100' : ''
                  }`}
                >
                  {choice.text}
                </Button>
              </motion.div>
            ))}
          </div>
        )}
        {question.type === 'free_response' && (
          <div>
            <Textarea
              value={quizAnswers[currentQuestionIndex] || ''}
              onChange={(e) => handleAnswerSelect(e.target.value)}
              placeholder="Type your answer here..."
              className="w-full h-32"
            />
          </div>
        )}
        {question.type === 'true_false' && (
          <div className="flex space-x-4">
            <Button 
              onClick={() => handleAnswerSelect('true')}
              className={quizAnswers[currentQuestionIndex] === 'true' ? 'bg-purple-100' : ''}
            >
              True
            </Button>
            <Button 
              onClick={() => handleAnswerSelect('false')}
              className={quizAnswers[currentQuestionIndex] === 'false' ? 'bg-purple-100' : ''}
            >
              False
            </Button>
          </div>
        )}
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-gray-500">
            Question {currentQuestionIndex + 1} of {quizQuestions.length}
          </div>
          <Button onClick={handleNextQuestion} disabled={!quizAnswers[currentQuestionIndex]}>
            {currentQuestionIndex < quizQuestions.length - 1 ? 'Next' : 'Submit Quiz'}
          </Button>
        </div>
      </motion.div>
    );
  }, [quizQuestions, currentQuestionIndex, quizAnswers, handleAnswerSelect, handleNextQuestion]);

  const renderQuizResults = useCallback(() => {
    const data = {
      labels: quizResults.map(r => r.subject),
      datasets: [
        {
          label: 'Correct Answers',
          data: quizResults.map(r => (r.correct / r.total) * 100),
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
        },
      ],
    };

    const options = {
      responsive: true,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: 'Quiz Results by Subject',
        },
      },
    };

    return (
      <div className="space-y-6">
        <Bar data={data} options={options} />
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4">Quiz Feedback</h3>
          <p className="text-gray-700">{quizFeedback}</p>
        </div>
        <div className="space-y-4">
          <h3 className="text-xl font-semibold mb-4">Detailed Question Feedback</h3>
          {detailedQuizFeedback.map((feedback, index) => (
            <div key={index} className="bg-white p-4 rounded-lg shadow">
              <h4 className="font-semibold">{feedback.question}</h4>
              <p className="text-sm text-gray-600">Type: {feedback.type}</p>
              <p className="mt-2">Your answer: {feedback.userAnswer}</p>
              <p className={`mt-1 ${feedback.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                Correct answer: {feedback.correctAnswer}
              </p>
              <p className="mt-2 text-sm">{feedback.explanation}</p>
              {feedback.type === 'free_response' && (
                <div className="mt-2">
                  <p className="text-sm">Written response feedback: {feedback.writtenResponseFeedback}</p>
                  <p className="text-sm">Score: {feedback.writtenResponseScore}%</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <div>
          <h3 className="text-xl font-semibold mb-4">Subjects to Review:</h3>
          <ul className="list-disc list-inside space-y-2">
            {quizResults.filter(r => (r.correct / r.total) < 0.7).map(r => (
              <li key={r.subject} className="text-gray-700">
                {r.subject} - {((r.correct / r.total) * 100).toFixed(2)}% correct
              </li>
            ))}
          </ul>
        </div>
        <Button onClick={handleNewQuiz} className="w-full">
          Start New Quiz
        </Button>
      </div>
    );
  }, [quizResults, quizFeedback, detailedQuizFeedback, handleNewQuiz]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Implement file upload logic here
    console.log('File uploaded:', event.target.files);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Implement image upload logic here
    console.log('Image uploaded:', event.target.files);
  };

  return (
    <div className="fixed right-4 top-150 flex flex-col-reverse items-end space-y-7 space-y-reverse z-10">
      <AnimatePresence>
        {activePanel && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
          >
            <div className="w-[70vw] h-[70vh] bg-gradient-to-br from-purple-50 to-white rounded-lg shadow-lg overflow-hidden">
                <div className="h-full flex flex-col">
                  <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-4 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white">
                      {activePanel === 'chat' && 'Chat with PDF'}
                      {activePanel === 'notes' && 'AI Notes'}
                      {activePanel === 'quiz' && 'Quiz Me'}
                    </h2>
                    <Button
                      variant="ghost"
                      className="text-white hover:bg-purple-400"
                      onClick={() => setActivePanel(null)}
                    >
                      &times;
                    </Button>
                  </div>
                  <div className="flex-grow overflow-y-auto p-6">
                    <SearchBar />
                    {activePanel === 'chat' && (
                      <div className="h-full flex flex-col">
                        <div ref={chatContainerRef} className="flex-grow overflow-y-auto mb-4 space-y-4">
                          {chatMessages.map((msg, index) => (
                            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-purple-100' : 'bg-white border border-purple-200'}`}>
                                <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                              </div>
                            </div>
                          ))}
                          {streamingContent && (
                            <div className="flex justify-start">
                              <div className="max-w-[80%] p-3 rounded-lg bg-white border border-purple-200">
                                <MarkdownRenderer>{streamingContent}</MarkdownRenderer>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <label htmlFor="file-upload" className="cursor-pointer">
                            <Paperclip className="h-5 w-5 text-gray-400 hover:text-purple-500" />
                            <input
                              id="file-upload"
                              type="file"
                              className="hidden"
                              onChange={handleFileUpload}
                            />
                          </label>
                          <label htmlFor="image-upload" className="cursor-pointer">
                            <ImageIcon className="h-5 w-5 text-gray-400 hover:text-purple-500" />
                            <input
                              id="image-upload"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleImageUpload}
                            />
                          </label>
                          <Input
                            ref={inputRef}
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleRagChat();
                              }
                            }}
                            placeholder="Type your message..."
                            className="flex-grow"
                            disabled={isLoading}
                          />
                          <Button onClick={handleRagChat} className="shrink-0" disabled={isLoading}>
                            {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    )}
                    {activePanel === 'notes' && (
                      <div className="h-full flex flex-col">
                        <div className="mb-4 space-y-4">
                          <div className="flex justify-between items-center">
                            <Select>
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Note style" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cornell">Cornell</SelectItem>
                                <SelectItem value="outline">Outline</SelectItem>
                                <SelectItem value="mindmap">Mind Map</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="text"
                              placeholder="Focus (optional)"
                              value={notesFocus}
                              onChange={(e) => setNotesFocus(e.target.value)}
                              className="w-40"
                            />
                          </div>
                          <div>
                            <Label>Page Range</Label>
                            <PageRangeInputs
                              value={notesPageRange}
                              onChange={setNotesPageRange}
                              min={1}
                              max={totalPages}
                            />
                          </div>
                          <Button onClick={handleGenerateNotes} className="w-full">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Generate Notes
                          </Button>
                        </div>
                        <Textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Your notes will appear here..."
                          className="flex-grow mb-4"
                          disabled={!isEditingNotes}
                        />
                        <div className="flex justify-end space-x-2">
                          <Button variant="outline" onClick={() => setIsEditingNotes(!isEditingNotes)}>
                            {isEditingNotes ? <Save className="h-4 w-4 mr-2" /> : <Edit2 className="h-4 w-4 mr-2" />}
                            {isEditingNotes ? 'Save' : 'Edit'}
                          </Button>
                        </div>
                      </div>
                    )}
                    {activePanel === 'quiz' && (
                      <div className="h-full flex flex-col">
                        {quizQuestions.length === 0 ? (
                          renderQuizConfig()
                        ) : showResults ? (
                          renderQuizResults()
                        ) : (
                          renderQuizQuestion()
                        )}
                      </div>
                    )}
                  </div>
                </div>
                </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Chat button */}
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <Button
          variant="outline"
          size="icon"
          className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700"
          onClick={() => setActivePanel(activePanel === 'chat' ? null : 'chat')}
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      </motion.div>

      {/* Notes button */}
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <Button
          variant="outline"
          size="icon"
          className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700"
          onClick={() => setActivePanel(activePanel === 'notes' ? null : 'notes')}
        >
          <BookOpen className="h-6 w-6" />
        </Button>
      </motion.div>

      {/* Quiz button */}
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <Button
          variant="outline"
          size="icon"
          className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700"
          onClick={() => setActivePanel(activePanel === 'quiz' ? null : 'quiz')}
        >
          <HelpCircle className="h-6 w-6" />
        </Button>
      </motion.div>
    </div>
  )
}
