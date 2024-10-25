'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiSearch, FiPlus, FiBook, FiFolder, FiUsers, FiBell, FiMenu, FiX, FiUpload, FiSettings, FiFile, FiTrash2 } from 'react-icons/fi'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import axios from 'axios'

type Document = {
  id: string
  name: string
  type: string
  size: number
  lastModified: Date
  url: string
}

export default function LibraryPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const formData = new FormData()
        formData.append('file', file)

        try {
          const response = await axios.post('/api/upload_pdf', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          })

          const newDocument: Document = {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: new Date(file.lastModified),
            url: response.data.url,
          }

          setDocuments(prevDocuments => [...prevDocuments, newDocument])
        } catch (error) {
          console.error('Error uploading file:', error)
          // Handle error (e.g., show an error message to the user)
        }
      }
    }
  }

  const handleDocumentSelect = (document: Document) => {
    router.push(`/reader?id=${document.id}&url=${encodeURIComponent(document.url)}`)
  }

  const handleDocumentDelete = (documentToDelete: Document) => {
    setDocuments(documents.filter(doc => doc.id !== documentToDelete.id))
    if (selectedDocument && selectedDocument.id === documentToDelete.id) {
      setSelectedDocument(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' bytes'
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB'
    else return (bytes / 1073741824).toFixed(1) + ' GB'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/" className="text-2xl font-bold text-indigo-600">
                  StudyLeaf
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <button onClick={toggleSidebar} className="p-2 rounded-full text-gray-400 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                <FiMenu className="h-6 w-6" />
              </button>
              <button className="ml-3 p-2 rounded-full text-gray-400 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                <FiBell className="h-6 w-6" />
              </button>
              <div className="ml-3 relative">
                <div className="h-8 w-8 rounded-full bg-indigo-600"></div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 right-0 z-50 w-64 bg-white shadow-lg"
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-2xl font-bold text-indigo-600">Menu</h2>
              <button onClick={toggleSidebar} className="text-gray-500 hover:text-indigo-600">
                <FiX size={24} />
              </button>
            </div>
            <nav className="p-4">
              <ul className="space-y-2">
                <SidebarItem icon={<FiBook />} text="Study" href="#" />
                <SidebarItem icon={<FiFolder />} text="Library" href="#" />
                <SidebarItem icon={<FiUsers />} text="Classes" href="#" />
                <SidebarItem icon={<FiSettings />} text="Settings" href="#" />
              </ul>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Library</h1>

        {/* Search bar */}
        <div className="mb-8">
          <div className="relative">
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Search your documents"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Upload area */}
        <div className="mb-8">
          <label htmlFor="file-upload" className="flex items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-indigo-600 focus:outline-none">
            <span className="flex items-center space-x-2">
              <FiUpload className="w-6 h-6 text-gray-600" />
              <span className="font-medium text-gray-600">Drop files to upload, or click to browse</span>
            </span>
            <input 
              id="file-upload" 
              name="file-upload" 
              type="file" 
              className="hidden" 
              onChange={handleFileUpload} 
              multiple 
              ref={fileInputRef}
            />
          </label>
        </div>

        {/* Document list and viewer */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Document list */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Documents</h2>
            <ul className="space-y-4">
              {documents.map((doc) => (
                <li 
                  key={doc.id} 
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-md cursor-pointer hover:bg-gray-100"
                  onClick={() => handleDocumentSelect(doc)}
                >
                  <div className="flex items-center space-x-3">
                    <FiFile className="w-5 h-5 text-indigo-600" />
                    <span className="font-medium text-gray-700">{doc.name}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDocumentDelete(doc);
                    }}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    <FiTrash2 />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Document viewer */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Document Viewer</h2>
            {selectedDocument ? (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">{selectedDocument.name}</h3>
                <p className="text-sm text-gray-600">Type: {selectedDocument.type}</p>
                <p className="text-sm text-gray-600">Size: {formatFileSize(selectedDocument.size)}</p>
                <p className="text-sm text-gray-600">Last modified: {selectedDocument.lastModified.toLocaleString()}</p>
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-600">Document preview not available in this demo.</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-600">Select a document to view its details</p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function SidebarItem({ icon, text, href }: { icon: React.ReactNode; text: string; href: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center space-x-2 text-gray-600 hover:text-indigo-600 transition-colors">
        {icon}
        <span>{text}</span>
      </Link>
    </li>
  )
}
