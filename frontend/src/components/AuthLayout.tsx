import { Link } from 'react-router-dom'

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  navLabel: string
  navLink: string
}

export default function AuthLayout({ children, title, navLabel, navLink }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4">
      <div className="w-full max-w-md rounded-2xl shadow-lg overflow-hidden bg-card-bg">
        {/* Header */}
      

        {/* Title */}
        <div className="px-8 pt-6 pb-2">
          <h1 className="text-2xl font-semibold text-text-primary">{title}</h1>
        </div>

        {/* Content */}
        <div className="px-8 pb-8">
          {children}
        </div>
      </div>
    </div>
  )
}
