'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Worker, Viewer,SpecialZoomLevel  } from '@react-pdf-viewer/core';
import { selectionModePlugin, SelectionMode } from '@react-pdf-viewer/selection-mode';
import { toolbarPlugin } from '@react-pdf-viewer/toolbar';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, RotateCcw, RotateCw, Search, ZoomIn, ZoomOut, Upload, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/selection-mode/lib/styles/index.css';
import '@react-pdf-viewer/toolbar/lib/styles/index.css';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';
import PDFAIPanel from './ai-panel';
import '@/styles/PDFViewerStyles.css';

import { motion } from 'framer-motion';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import '@react-pdf-viewer/page-navigation/lib/styles/index.css';
import '@react-pdf-viewer/page-navigation/lib/styles/index.css';
import { DocumentLoadEvent } from '@react-pdf-viewer/core';
import { PDFDocumentProxy } from 'pdfjs-dist';
import axios from 'axios'
import { useSearchParams } from 'next/navigation';
import { debounce } from 'lodash';
import Image from 'next/image'
import logoSrc from '../img/logo.svg'


interface Section {
  page: number;
  text: string;
  id: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full">
          <h1 className="text-2xl text-red-500">Something went wrong while loading the PDF.</h1>
        </div>
      );
    }

    return this.props.children;
  }
}

interface SearchResult {
  content: string;
  page: number;
}

const PDFViewerPage: React.FC = () => {
  const searchParams = useSearchParams();
  const [pdfUrl, setPdfUrl] = useState<string | null>(searchParams.get('url'));
  const [numPages, setNumPages] = useState<number>(0);
  const [isReading, setIsReading] = useState<boolean>(false);
  
  const [readingSpeed, setReadingSpeed] = useState<number>(1);
  const [sections, setSections] = useState<Section[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(0);
  const [utterance, setUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(SelectionMode.Text);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSections, setFilteredSections] = useState<Section[]>([]);
  const [currentScale, setCurrentScale] = useState<number>(1);
  const [isSpeechMenuOpen, setIsSpeechMenuOpen] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [pdfWidth, setPdfWidth] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [goToPageInput, setGoToPageInput] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Add a constant factor to increase container size (e.g., 10% larger)
  const CONTAINER_SIZE_FACTOR = 1.0;

  const selectionModePluginInstance = selectionModePlugin({ selectionMode });
  const toolbarPluginInstance = toolbarPlugin();
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const { jumpToPage } = pageNavigationPluginInstance;

  const handleError = useCallback((error: Error) => {
    console.error('PDF Viewer Error:', error);
  }, []);

  const extractSections = useCallback(async (doc: any) => {
    const extractedSections: Section[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const textItems = textContent.items.map((item: any) => item.str).join(' ');
      extractedSections.push({
        page: i,
        text: textItems,
        id: `section-${i}`,
      });
    }
    setSections(extractedSections);
    setFilteredSections(extractedSections);
  }, []);

  const handleDocumentLoad = useCallback(async (e: { doc: PDFDocumentProxy }) => {
    try {
      const { doc } = e;
      console.log('PDF document loaded:', doc);
      
      setNumPages(doc.numPages);
      await extractSections(doc);
  
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      
      setPdfWidth(viewport.width);
    } catch (error) {
      handleError(error as Error);
    }
  }, [handleError, extractSections]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const response = await axios.post('/api/upload_pdf', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        const fileUrl = response.data.url;
        console.log('PDF URL:', fileUrl);
        setPdfUrl(fileUrl);
      } catch (error) {
        console.error('Error uploading PDF:', error);
        // Handle error (e.g., show an error message to the user)
      }
    }
  }, []);

  const highlightPlugin = {
    onTextLayerRender: (e: any) => {
      const textLayer = e.textLayerDiv;
      if (textLayer) {
        const spans = textLayer.getElementsByTagName('span');
        const words = filteredSections[currentSectionIndex]?.text.split(' ') || [];
        
        let wordIndex = 0;
        for (let i = 0; i < spans.length; i++) {
          const span = spans[i];
          const spanText = span.textContent.trim();
          
          if (spanText === words[wordIndex]) {
            if (wordIndex === currentWordIndex) {
              span.classList.add('highlight-current-word');
            } else if (wordIndex < currentWordIndex) {
              span.classList.add('highlight-read-word');
            } else {
              span.classList.add('highlight-unread-word');
            }
            wordIndex++;
          }
        }
      }
    },
  };

  // Move the moveSection function declaration before handleTextToSpeech
  const moveSection = useCallback((delta: number) => {
    setCurrentSectionIndex((prevIndex) => {
      const newIndex = prevIndex + delta;
      return newIndex >= 0 && newIndex < filteredSections.length ? newIndex : prevIndex;
    });
  }, [filteredSections.length]);

  const handleTextToSpeech = useCallback(() => {
    if (isReading) {
      window.speechSynthesis.cancel();
      setIsReading(false);
      setUtterance(null);
    } else {
      setIsReading(true);
      const textToRead = filteredSections[currentSectionIndex]?.text || '';
      const newUtterance = new SpeechSynthesisUtterance(textToRead);
      newUtterance.rate = readingSpeed;

      newUtterance.onboundary = (event) => {
        if (event.name === 'word') {
          setCurrentWordIndex(event.charIndex);
        }
      };

      newUtterance.onend = () => {
        setIsReading(false);
        setUtterance(null);
        setCurrentWordIndex(0);
        moveSection(1);
      };

      newUtterance.onerror = (event) => {
        console.error('SpeechSynthesisUtterance error:', event);
        setIsReading(false);
        setUtterance(null);
        setCurrentWordIndex(0);
      };

      setUtterance(newUtterance);
      window.speechSynthesis.speak(newUtterance);
    }
  }, [isReading, filteredSections, currentSectionIndex, readingSpeed, moveSection]);

  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.trim() === '' || !pdfUrl) {
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

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Update the handleSpeedChange function to include utterance in the dependency array
  const handleSpeedChange = useCallback((value: number[]) => {
    const newSpeed = value[0];
    setReadingSpeed(newSpeed);
    if (utterance) {
      utterance.rate = newSpeed;
    }
  }, [utterance]);

  const handleZoomIn = useCallback(() => {
    setCurrentScale((prevScale) => Math.min(prevScale + 0.1, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setCurrentScale((prevScale) => Math.max(prevScale - 0.1, 0.5));
  }, []);

  const safeToFixed = useCallback((num: number | undefined, digits: number) => {
    return typeof num === 'number' ? num.toFixed(digits) : '0';
  }, []);

  const handleUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handlePageChange = useCallback((e: { currentPage: number }) => {
    setCurrentPage(e.currentPage);
  }, []);

  const handleGoToPage = useCallback(() => {
    const pageNumber = parseInt(goToPageInput, 10);
    if (pageNumber >= 1 && pageNumber <= numPages) {
      jumpToPage(pageNumber );  
      setCurrentPage(pageNumber);  
    }
    setGoToPageInput('');
  }, [goToPageInput, numPages, jumpToPage, setCurrentPage]);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowRight':
          moveSection(1);
          break;
        case 'ArrowLeft':
          moveSection(-1);
          break;
        case '+':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        // Remove the 'space' key handler
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    if (pdfWidth && containerRef.current && wrapperRef.current) {
      // Adjust the container width based on the current scale and size factor
      const newWidth = pdfWidth * currentScale * CONTAINER_SIZE_FACTOR;
      containerRef.current.style.width = `${newWidth}px`;
      
      // Adjust the viewer's scale
      const viewer = containerRef.current.querySelector('.rpv-core__viewer') as HTMLElement;
      if (viewer) {
        viewer.style.transform = `scale(${currentScale})`;
        viewer.style.transformOrigin = 'top left';
        viewer.style.width = `${100 / currentScale}%`;
      }

      // Center the container within the wrapper
      const wrapperWidth = wrapperRef.current.clientWidth;
      const leftMargin = Math.max(0, (wrapperWidth - newWidth) / 2);
      containerRef.current.style.marginLeft = `${leftMargin}px`;
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [moveSection, handleZoomIn, handleZoomOut, currentScale, pdfWidth]);

  useEffect(() => {
    const url = searchParams.get('url');
    if (url) {
      setPdfUrl(url);
    }
  }, [searchParams]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-50 to-indigo-100">
      <header className="fixed top-0 left-0 right-0 z-10 bg-gradient-to-r from-purple-100 to-indigo-100 shadow-md">
        <div className="max-w-7xl mx-auto py-4">
          {/* Top Row */}
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="flex items-center text-2xl font-bold text-indigo-600">
              <Image src="/img/logo.svg" alt="StudyLeaf Logo" width={32} height={32} className="mr-2" />
              StudyLeaf
            </Link>
            
            <div className="flex items-center space-x-2 flex-1 max-w-2xl mx-4 relative" ref={searchRef}>
              <div className="relative w-full">
                <Input 
                  type="text" 
                  placeholder="Search..." 
                  className="h-9 pl-10 border-purple-300 focus:border-purple-500 focus:ring focus:ring-purple-200 focus:ring-opacity-50 w-full"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              </div>
              {isSearchFocused && searchResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-gradient-to-r from-purple-100 to-indigo-100 border border-purple-200 rounded-md shadow-lg max-h-60 overflow-y-auto top-full">
                  {searchResults.map((result, index) => (
                    <div 
                      key={index} 
                      className="p-2 hover:bg-white hover:bg-opacity-50 cursor-pointer transition-colors duration-150"
                      onClick={() => {
                        jumpToPage(result.page);
                        setSearchQuery('');
                        setIsSearchFocused(false);
                      }}
                    >
                      <p className="text-sm text-gray-800">{result.content}</p>
                      <p className="text-xs text-indigo-600">Page: {result.page}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-white rounded-full px-3 py-1 shadow-md">
                <span className="text-sm font-medium text-purple-700">
                  Page {currentPage} of {numPages}
                </span>
                <Input
                  type="text"
                  placeholder="Go to..."
                  value={goToPageInput}
                  onChange={(e) => setGoToPageInput(e.target.value)}
                  className="w-16 h-7 text-sm border-purple-300 focus:border-purple-500 focus:ring focus:ring-purple-200 focus:ring-opacity-50"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 hover:bg-purple-200 transition-colors duration-300"
                  onClick={handleGoToPage}
                >
                  <ChevronRight className="h-4 w-4 text-purple-600" />
                </Button>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-none hover:from-purple-600 hover:to-indigo-600 transition-all duration-300 shadow-lg hover:shadow-xl"
                onClick={handleUpload}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload PDF
              </Button>
            </div>
          </div>
          
          {/* Bottom Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 w-48">
              <span className="text-sm text-purple-700">Speed:</span>
              <Slider
                value={[readingSpeed]}
                onValueChange={(value) => handleSpeedChange(value)}
                max={3}
                min={0.5}
                step={0.1}
                className="w-32"
              />
              <span className="text-sm w-12 text-purple-700">{readingSpeed.toFixed(1)}x</span>
            </div>

            <div className="flex items-center space-x-4">
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <RotateCcw 
                  className="h-8 w-8 text-purple-600 cursor-pointer" 
                  onClick={() => moveSection(-1)}
                />
              </motion.div>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-12 w-12 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 transition-all duration-300 shadow-lg hover:shadow-xl"
                  onClick={handleTextToSpeech}
                >
                  {isReading ? 
                    <Pause className="h-6 w-6 text-white" /> : 
                    <Play className="h-6 w-6 text-white" />
                  }
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <RotateCw 
                  className="h-8 w-8 text-purple-600 cursor-pointer" 
                  onClick={() => moveSection(1)}
                />
              </motion.div>
            </div>

            <div className="flex items-center space-x-2">
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-9 w-9 hover:bg-purple-200 transition-colors duration-300"
                  onClick={handleZoomOut}
                >
                  <ZoomOut className="h-5 w-5 text-purple-600" />
                </Button>
              </motion.div>
              <span className="text-sm w-16 text-center text-purple-700">
                {(currentScale * 100).toFixed(0)}%
              </span>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-9 w-9 hover:bg-purple-200 transition-colors duration-300"
                  onClick={handleZoomIn}
                >
                  <ZoomIn className="h-5 w-5 text-purple-600" />
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden mt-36">
        <div className="flex-1 bg-transparent flex justify-center items-start overflow-y-auto">
          <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
            {pdfUrl ? (
              <ErrorBoundary>
                <div 
                  ref={wrapperRef}
                  style={{
                    height: 'calc(100vh - 36px)',
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    backgroundColor: 'lavender-100',
                    overflow: 'auto',
                    borderRadius: '5%',
                    paddingTop: '10px',
                    marginLeft:'20%',
                    marginBottom:'20%'
                  }}
                >
                  <div 
                    ref={containerRef} 
                    style={{
                      transition: 'width 0.3s ease, margin-left 0.3s ease',
                      backgroundColor: 'lavender-100',
                      boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)',
                      borderRadius: '8px',
                    }}
                  >
                    <Viewer
                      fileUrl={pdfUrl}
                      plugins={[
                        selectionModePluginInstance,
                        toolbarPluginInstance,
                        highlightPlugin,
                        pageNavigationPluginInstance,
                      ]}
                      onDocumentLoad={(e: DocumentLoadEvent) => {
                        const doc = e.doc as unknown as PDFDocumentProxy;
                        handleDocumentLoad({ doc });
                      }}
                      
                      onPageChange={handlePageChange}
                      defaultScale={SpecialZoomLevel.PageFit}
                    />
                  </div>
                </div>
              </ErrorBoundary>
            ) : (
              <div className="flex items-center justify-center h-full ml-48">
                <p className="text-gray-500">Please upload a PDF to view.</p>
              </div>
            )}
          </Worker>
        </div>
        <aside className="w-1/4 mt-5 p-4 overflow-y-auto">
          <PDFAIPanel pdfUrl={pdfUrl} currentPage={currentPage} totalPages={numPages} />
        </aside>
      </main>
      <footer className="bg-gradient-to-br from-purple-50 to-indigo-100 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Button
            onClick={() => setShowToolbar(!showToolbar)}
            className="px-3 py-1 bg-indigo-600 text-white rounded-full text-sm font-semibold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl"
          >
            Toggle Toolbar
          </Button>
        </div>
      </footer>
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileUpload}
        className="hidden"
        ref={fileInputRef}
      />
    </div>
  );
};

export default PDFViewerPage;
