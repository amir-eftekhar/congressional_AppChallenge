import React from 'react';

type ArrowIndicatorProps = {
  currentSectionIndex: number;
  totalSections: number;
};

const ArrowIndicator: React.FC<ArrowIndicatorProps> = ({ currentSectionIndex, totalSections }) => {

  const positionPercentage = (currentSectionIndex / (totalSections || 1)) * 100;

  return (
    <div className="arrow-indicator" style={{
      position: 'absolute',
      top: `${positionPercentage}%`,
      left: '-30px', // Adjust this value to position the arrow horizontally
      transform: 'translateY(-50%)',
      zIndex: 1000,
      pointerEvents: 'none',
      transition: 'top 0.3s ease-in-out',
    }}>
      {/* Arrow SVG */}
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M19 12l-7-7-7 7" />
      </svg>
    </div>
  );
}

export default ArrowIndicator;
