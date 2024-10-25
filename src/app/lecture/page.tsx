'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Mic, StopCircle, FileText, List, AlignLeft, Grid3X3, Upload } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import logoSrc from '../img/logo.svg';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface Notes {
  paragraph: string[];
  bulletPoints: string[];
  cornell: {
    notes: string[];
    cues: string[];
    summary: string[];
  };
}

export default function EnhancedLectureNotes() {
  const [isRecording, setIsRecording] = useState(false);
  const [lectureId, setLectureId] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [notes, setNotes] = useState<Notes>({
    paragraph: [],
    bulletPoints: [],
    cornell: { notes: [], cues: [], summary: [] },
  });
  const recognitionRef = useRef<any>(null);
  const transcriptBufferRef = useRef('');
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const generateStreamingNotes = useCallback(async (text: string) => {
    try {
      if (!text.trim()) {
        console.log('Empty text, skipping note generation.');
        return;
      }
      const response = await axios.post('/api/lecture_notes', {
        lectureId,
        text,
        config: { style: 'all' },
        isNewChunk: true
      });

      const { notes: apiNotes } = response.data;

      if (apiNotes) {
        setNotes(prev => ({
          paragraph: [...prev.paragraph, apiNotes.paragraph || ''],
          bulletPoints: [...prev.bulletPoints, apiNotes.bullet || ''],
          cornell: {
            notes: [...prev.cornell.notes, apiNotes.cornell?.notes || ''],
            cues: [...prev.cornell.cues, apiNotes.cornell?.cues || ''],
            summary: [...prev.cornell.summary, apiNotes.cornell?.summary || ''],
          },
        }));
      }
    } catch (error) {
      console.error('Error generating streaming notes:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Server response:', error.response.data);
      }
    }
  }, [lectureId]);

  useEffect(() => {
    setLectureId(Date.now().toString());

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported in this browser.');
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
      console.log('Speech recognition started.');
    };

    recognitionRef.current.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setLiveTranscript(prev => prev + finalTranscript + interimTranscript);
      transcriptBufferRef.current += finalTranscript;

      if (finalTranscript.trim()) {
        generateStreamingNotes(transcriptBufferRef.current);
        transcriptBufferRef.current = '';
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setIsRecording(false);
      }
    };

    recognitionRef.current.onend = () => {
      console.log('Speech recognition ended.');
      if (isRecording) {
        console.log('Restarting speech recognition.');
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.error('Error restarting speech recognition:', error);
        }
      }
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [isRecording, generateStreamingNotes]);

  const toggleRecording = async () => {
    if (!isRecording) {
      setIsRecording(true);
      setLiveTranscript('');
      clearNotes();
      transcriptBufferRef.current = '';
      if (recognitionRef.current) {
        try {
          await recognitionRef.current.start();
          console.log('Recording started.');
        } catch (error) {
          console.error('Error starting recording:', error);
          setIsRecording(false);
        }
      }
    } else {
      setIsRecording(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          console.log('Recording stopped.');
        } catch (error) {
          console.error('Error stopping recording:', error);
        }
      }
      // Generate final notes from any remaining transcript
      if (transcriptBufferRef.current.trim()) {
        await generateStreamingNotes(transcriptBufferRef.current);
        transcriptBufferRef.current = '';
      }
    }
  };

  const clearNotes = () => {
    setNotes({
      paragraph: [],
      bulletPoints: [],
      cornell: { notes: [], cues: [], summary: [] },
    });
    setLiveTranscript('');
  };

  const copyNotes = () => {
    const notesText = JSON.stringify(notes, null, 2);
    navigator.clipboard.writeText(notesText)
      .then(() => alert('Notes copied to clipboard!'))
      .catch(err => console.error('Failed to copy notes:', err));
  };

  const saveNotes = () => {
    try {
      localStorage.setItem(`lecture_${lectureId}_notes`, JSON.stringify(notes));
      alert('Notes saved to local storage!');
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Failed to save notes.');
    }
  };

  const handleAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingAudio(true);
    const formData = new FormData();
    formData.append('audio', file);

    try {
      const response = await axios.post('/api/transcribe_audio', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { transcript } = response.data;
      setLiveTranscript(transcript);
      await generateStreamingNotes(transcript);
    } catch (error) {
      console.error('Error processing audio file:', error);
      alert('Failed to process audio file. Please try again.');
    } finally {
      setIsProcessingAudio(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-8">
      <header className="fixed top-0 left-0 right-0 z-10 bg-gradient-to-r from-purple-100 to-indigo-100 shadow-md mb-8">
        <div className="max-w-7xl mx-auto py-4">
          <Link href="/" className="flex items-center text-2xl font-bold text-indigo-600">
            <Image src={logoSrc} alt="StudyLeaf Logo" width={32} height={32} className="mr-2" />
            StudyLeaf
          </Link>
        </div>
      </header>
      
      {!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) && (
        <div className="text-red-500 mb-4">
          Your browser does not support speech recognition. Please use a supported browser like Google Chrome.
        </div>
      )}

      <div className="flex space-x-4 mt-20">
        <Card className="w-1/3">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-4">Live Transcript</h2>
            <div className="bg-white p-4 rounded-lg shadow-inner h-[70vh] overflow-y-auto">
              <p>{liveTranscript}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="w-2/3">
          <CardContent className="p-6">
            <h1 className="text-3xl font-bold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              Lecture Notes
            </h1>

            <div className="flex justify-center space-x-4 mb-8">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={toggleRecording}
                  className={`w-16 h-16 rounded-full ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                  aria-label={isRecording ? "Stop recording" : "Start recording"}
                  disabled={isProcessingAudio}
                >
                  {isRecording ? <StopCircle className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={() => audioInputRef.current?.click()}
                  className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600"
                  aria-label="Upload audio file"
                  disabled={isRecording || isProcessingAudio}
                >
                  <Upload className="h-8 w-8" />
                </Button>
                <input
                  type="file"
                  ref={audioInputRef}
                  onChange={handleAudioUpload}
                  accept="audio/*"
                  className="hidden"
                />
              </motion.div>
            </div>
            <p className="text-center mb-8">
              {isRecording ? 'Recording in progress... Click to stop' : 
               isProcessingAudio ? 'Processing audio file...' : 
               'Click to start recording or upload an audio file'}
            </p>

            <Tabs defaultValue="paragraph" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="paragraph" className="flex items-center"><AlignLeft className="mr-2 h-4 w-4" /> Paragraph</TabsTrigger>
                <TabsTrigger value="bulletPoints" className="flex items-center"><List className="mr-2 h-4 w-4" /> Bullet Points</TabsTrigger>
                <TabsTrigger value="cornell" className="flex items-center"><Grid3X3 className="mr-2 h-4 w-4" /> Cornell</TabsTrigger>
                <TabsTrigger value="raw" className="flex items-center"><FileText className="mr-2 h-4 w-4" /> Raw</TabsTrigger>
              </TabsList>
              <TabsContent value="paragraph">
                <div className="bg-white p-4 rounded-lg shadow-inner min-h-[50vh] overflow-y-auto">
                  {notes.paragraph.map((para, index) => (
                    <p key={index}>{para}</p>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="bulletPoints">
                <div className="bg-white p-4 rounded-lg shadow-inner min-h-[50vh] overflow-y-auto">
                  <ul className="list-disc list-inside">
                    {notes.bulletPoints.map((point, index) => (
                      <li key={index}>{point}</li>
                    ))}
                  </ul>
                </div>
              </TabsContent>
              <TabsContent value="cornell">
                <div className="grid grid-cols-3 gap-4 min-h-[50vh]">
                  <div className="col-span-2 space-y-4">
                    <div className="bg-white p-4 rounded-lg shadow-inner h-[30vh] overflow-y-auto">
                      <h3 className="font-semibold mb-2">Notes</h3>
                      {notes.cornell.notes.map((note, index) => (
                        <p key={index}>{note}</p>
                      ))}
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-inner h-[20vh] overflow-y-auto">
                      <h3 className="font-semibold mb-2">Summary</h3>
                      {notes.cornell.summary.map((summary, index) => (
                        <p key={index}>{summary}</p>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-inner h-[50vh] overflow-y-auto">
                    <h3 className="font-semibold mb-2">Cues</h3>
                    {notes.cornell.cues.map((cue, index) => (
                      <p key={index}>{cue}</p>
                    ))}
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="raw">
                <Textarea
                  value={JSON.stringify(notes, null, 2)}
                  readOnly
                  className="min-h-[50vh] font-mono text-sm"
                />
              </TabsContent>
            </Tabs>

            <div className="flex justify-end space-x-4 mt-6">
              <Button variant="outline" onClick={clearNotes}>
                Clear
              </Button>
              <Button variant="outline" onClick={copyNotes}>
                Copy
              </Button>
              <Button onClick={saveNotes}>
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
