import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, Search, ZoomIn, ZoomOut, Upload } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface PDFTopBarProps {
  onSearch: (query: string) => void;
  onPlayPause: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onUpload: () => void;
  isPlaying: boolean;
}

const PDFTopBar: React.FC<PDFTopBarProps> = ({
  onSearch,
  onPlayPause,
  onSkipBack,
  onSkipForward,
  onZoomIn,
  onZoomOut,
  onUpload,
  isPlaying,
}) => {
  const [speed, setSpeed] = useState([1]);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = useCallback(() => {
    onSearch(searchQuery);
  }, [onSearch, searchQuery]);

  const handleSpeedChange = useCallback((newSpeed: number[]) => {
    setSpeed(newSpeed);
    // You might want to add a prop to handle speed change in the parent component
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col bg-gradient-to-r from-purple-100 to-indigo-100 border-b shadow-md"
    >
      {/* Top Row */}
      <div className="flex items-center justify-between p-3 space-x-4">
        <Link href="/" className="text-2xl font-bold text-indigo-600">
          StudyLeaf
        </Link>
        
        <div className="flex items-center space-x-2 flex-1 max-w-2xl">
          <Input 
            type="text" 
            placeholder="Search..." 
            className="h-9 border-purple-300 focus:border-purple-500 focus:ring focus:ring-purple-200 focus:ring-opacity-50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-9 w-9 hover:bg-purple-200 transition-colors duration-300"
            onClick={handleSearch}
          >
            <Search className="h-5 w-5 text-purple-600" />
          </Button>
        </div>
        
        <Button 
          variant="outline" 
          size="sm"
          className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-none hover:from-purple-600 hover:to-indigo-600 transition-all duration-300 shadow-lg hover:shadow-xl"
          onClick={onUpload}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload PDF
        </Button>
      </div>
      
      {/* Bottom Row */}
      <div className="flex items-center justify-between p-3 space-x-4">
        <div className="flex items-center space-x-2">
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-9 w-9 hover:bg-purple-200 transition-colors duration-300"
              onClick={onSkipBack}
            >
              <SkipBack className="h-5 w-5 text-purple-600" />
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-9 w-9 hover:bg-purple-200 transition-colors duration-300"
              onClick={onPlayPause}
            >
              {isPlaying ? 
                <Pause className="h-5 w-5 text-purple-600" /> : 
                <Play className="h-5 w-5 text-purple-600" />
              }
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-9 w-9 hover:bg-purple-200 transition-colors duration-300"
              onClick={onSkipForward}
            >
              <SkipForward className="h-5 w-5 text-purple-600" />
            </Button>
          </motion.div>
        </div>
        
        <div className="flex items-center space-x-2 w-40">
          <span className="text-sm text-purple-700">Speed:</span>
          <Slider
            value={speed}
            onValueChange={handleSpeedChange}
            max={2}
            step={0.1}
            className="w-24"
          />
          <span className="text-sm w-8 text-purple-700">{speed[0].toFixed(1)}x</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-9 w-9 hover:bg-purple-200 transition-colors duration-300"
              onClick={onZoomOut}
            >
              <ZoomOut className="h-5 w-5 text-purple-600" />
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-9 w-9 hover:bg-purple-200 transition-colors duration-300"
              onClick={onZoomIn}
            >
              <ZoomIn className="h-5 w-5 text-purple-600" />
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default PDFTopBar;