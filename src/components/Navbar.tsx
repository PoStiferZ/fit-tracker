'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Dumbbell, ClipboardList, Pill, User, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const manageLinks = [
  { href: '/exercises', label: 'Exercices', icon: Dumbbell },
  { href: '/programs', label: 'Programmes', icon: ClipboardList },
  { href: '/supplements', label: 'Compléments', icon: Pill },
]

const allLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ...manageLinks,
  { href: '/profile', label: 'Profil', icon: User },
]

const mobileLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/exercises', label: 'Exercices', icon: Dumbbell },
  { href: '/programs', label: 'Programmes', icon: ClipboardList },
  { href: '/supplements', label: 'Compléments', icon: Pill },
  { href: '/profile', label: 'Profil', icon: User },
]

export default function Navbar() {
  const pathname = usePathname()
  const isManage = manageLinks.some(l => l.href === pathname)

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden sm:flex flex-col w-60 bg-white border-r border-gray-100 min-h-screen p-5 fixed left-0 top-0 shadow-sm">
        <div className="mb-8 px-2 flex items-center gap-2.5">
          <span className="text-2xl">💪</span>
          <span className="text-xl font-black text-gray-950">Fit</span>
        </div>
        <div className="space-y-1 flex-1">
          {allLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={cn(
              'flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-semibold transition-all',
              pathname === href
                ? 'bg-gray-950 text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)]'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            )}>
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </div>
        {/* Sidebar footer */}
        <div className="pt-4 border-t border-gray-100">
          <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider px-3">Fit v1</p>
        </div>
      </nav>

      {/* Mobile bottom bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 px-2 pb-3">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-100 flex px-1 py-1.5">
          {mobileLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link key={href} href={href} className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all',
                active ? 'bg-gray-950 text-white' : 'text-gray-400 hover:text-gray-700'
              )}>
                <Icon size={17} />
                <span className="text-[9px] font-bold leading-none">{label.split(' ')[0]}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
