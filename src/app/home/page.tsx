'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiSearch, FiPlus, FiBook, FiFolder, FiUsers, FiBell, FiMenu, FiX, FiMic, FiUpload, FiSettings, FiZap } from 'react-icons/fi'
import Link from 'next/link'

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
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
                <SidebarItem icon={<FiFolder />} text="Library" href="/library" />
                <SidebarItem icon={<FiUsers />} text="Classes" href="#" />
                <SidebarItem icon={<FiSettings />} text="Settings" href="#" />
              </ul>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search bar */}
        <div className="mb-8">
          <div className="relative">
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Search your sets, folders, or classes"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <QuickActionCard
            icon={<FiMic className="h-8 w-8 text-indigo-600" />}
            title="Start a Lecture"
            description="Begin AI-powered note-taking"
          />
          <QuickActionCard
            icon={<FiUpload className="h-8 w-8 text-indigo-600" />}
            title="Upload PDF"
            description="Get insights from your documents"
          />
          <QuickActionCard
            icon={<FiZap className="h-8 w-8 text-indigo-600" />}
            title="Quick Study"
            description="Start a personalized study session"
          />
        </div>

        {/* Recent sets */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Recent sets</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <StudySetCard key={i} />
            ))}
            <CreateNewCard />
          </div>
        </section>

        {/* Try this feature */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Try this</h2>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-indigo-600 mb-2">AI-Powered Essay Feedback</h3>
            <p className="text-gray-600 mb-4">Get instant feedback on your essays with our advanced AI. Improve your writing skills and boost your grades!</p>
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition-colors">
              Try Now
            </button>
          </div>
        </section>

        {/* Folders */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Folders</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <FolderCard key={i} />
            ))}
          </div>
        </section>
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

function QuickActionCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      className="bg-white rounded-lg shadow-md p-6 cursor-pointer"
    >
      <div className="flex items-center mb-4">
        {icon}
        <h3 className="text-lg font-semibold text-gray-900 ml-2">{title}</h3>
      </div>
      <p className="text-sm text-gray-600">{description}</p>
    </motion.div>
  )
}

function StudySetCard() {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      className="bg-white rounded-lg shadow-md p-6 cursor-pointer"
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Biology Chapter 5</h3>
      <p className="text-sm text-gray-600 mb-4">32 terms</p>
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500">Last studied 2 days ago</span>
        <button className="text-indigo-600 hover:text-indigo-800">Study</button>
      </div>
    </motion.div>
  )
}

function CreateNewCard() {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      className="bg-white rounded-lg shadow-md p-6 cursor-pointer flex flex-col items-center justify-center text-center"
    >
      <FiPlus className="h-12 w-12 text-indigo-600 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900">Create a new study set</h3>
    </motion.div>
  )
}

function FolderCard() {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      className="bg-white rounded-lg shadow-md p-6 cursor-pointer"
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Science</h3>
      <p className="text-sm text-gray-600 mb-4">5 sets</p>
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500">Last updated 1 week ago</span>
        <button className="text-indigo-600 hover:text-indigo-800">View</button>
      </div>
    </motion.div>
  )
}