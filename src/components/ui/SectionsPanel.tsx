import { Button } from "@/components/ui/button"
import { FiChevronUp, FiChevronDown, FiX } from "react-icons/fi"

interface SectionsPanelProps {
  sections: string[]
  currentSectionIndex: number
  moveSection: (delta: number) => void
  handleSectionClick: (index: number) => void
  setShowSections: (show: boolean) => void
}

export default function SectionsPanel({
  sections,
  currentSectionIndex,
  moveSection,
  handleSectionClick,
  setShowSections
}: SectionsPanelProps) {
  return (
    <div className="w-1/4 bg-white p-4 overflow-y-auto relative">
      <Button 
        variant="outline" 
        size="icon" 
        className="absolute top-2 right-2"
        onClick={() => setShowSections(false)}
      >
        <FiX />
      </Button>
      <h3 className="text-lg font-semibold mb-2">Sections</h3>
      <div className="flex items-center justify-between mb-2">
        <Button variant="outline" size="sm" onClick={() => moveSection(-1)} disabled={currentSectionIndex === 0}>
          <FiChevronUp />
        </Button>
        <Button variant="outline" size="sm" onClick={() => moveSection(1)} disabled={currentSectionIndex === sections.length - 1}>
          <FiChevronDown />
        </Button>
      </div>
      <div className="section-list">
        {sections.slice(currentSectionIndex, currentSectionIndex + 2).map((section, index) => (
          <div
            key={currentSectionIndex + index}
            className={`p-2 mb-2 cursor-pointer rounded ${index === 0 ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
            onClick={() => handleSectionClick(currentSectionIndex + index)}
          >
            {index === 0 ? "Current: " : "Next: "}
            {section}
          </div>
        ))}
      </div>
    </div>
  )
}