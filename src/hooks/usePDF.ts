import { useState, useCallback } from 'react';
import { HighlightArea } from '@react-pdf-viewer/highlight';

const usePDF = () => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sections, setSections] = useState<{ id: string; content: string }[]>([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(0);
  const [fullText, setFullText] = useState<string>('');
  const [highlights, setHighlights] = useState<HighlightArea[]>([]);

  const loadPDF = useCallback((source: string | ArrayBuffer) => {
    // This function is now mainly for compatibility.
    // Most of the PDF loading is handled by react-pdf-viewer.
    if (typeof source === 'string') {
      // If it's a URL, we can use it directly
      // You might want to update your state or perform other actions here
    } else {
      // If it's an ArrayBuffer, you might need to convert it to a Blob URL
      const blob = new Blob([source], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      // Update your state or perform other actions with this URL
    }
  }, []);

  const goToPage = useCallback((pageNumber: number) => {
    setCurrentPage(pageNumber);
  }, []);

  const updateVisiblePages = useCallback(() => {
    // This function might not be necessary with react-pdf-viewer
    // as it handles page visibility internally
  }, []);

  const addHighlight = useCallback((area: HighlightArea) => {
    setHighlights(prevHighlights => [...prevHighlights, area]);
  }, []);

  const removeHighlight = useCallback((area: HighlightArea) => {
    setHighlights(prevHighlights => prevHighlights.filter(h => h !== area));
  }, []);

  return {
    loadPDF,
    currentPage,
    setCurrentPage,
    numPages,
    setNumPages,
    scale,
    setScale,
    searchTerm,
    setSearchTerm,
    sections,
    setSections,
    currentSectionIndex,
    setCurrentSectionIndex,
    fullText,
    setFullText,
    goToPage,
    updateVisiblePages,
    highlights,
    addHighlight,
    removeHighlight,
  };
};

export default usePDF;