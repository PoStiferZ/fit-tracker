'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ClipboardList, Pill, User, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/contexts/LanguageContext'

export default function Navbar() {
  const pathname = usePathname()
  const { t } = useLanguage()

  const allLinks = [
    { href: '/dashboard', labelKey: 'nav_dashboard', icon: LayoutDashboard },
    { href: '/programs', labelKey: 'nav_programs', icon: ClipboardList },
    { href: '/history', labelKey: 'nav_history', icon: History },
    { href: '/supplements', labelKey: 'nav_supplements', icon: Pill },
    { href: '/profile', labelKey: 'nav_profile', icon: User },
  ]

  const mobileLinks = [
    { href: '/dashboard', labelKey: 'nav_dashboard', icon: LayoutDashboard },
    { href: '/programs', labelKey: 'nav_programs', icon: ClipboardList },
    { href: '/history', labelKey: 'nav_history', icon: History },
    { href: '/supplements', labelKey: 'nav_supplements', icon: Pill },
    { href: '/profile', labelKey: 'nav_profile', icon: User },
  ]

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col w-60 bg-white border-r border-gray-100 min-h-screen p-5 fixed left-0 top-0 shadow-sm">
        <div className="mb-8 px-2 flex items-center gap-2.5">
          <span className="text-2xl">💪</span>
          <span className="text-xl font-black text-gray-950">Fitrack</span>
        </div>
        <div className="space-y-1 flex-1">
          {allLinks.map(({ href, labelKey, icon: Icon }) => (
            <Link key={href} href={href} className={cn(
              'flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-semibold transition-all',
              pathname === href
                ? 'bg-gray-950 text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)]'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            )}>
              <Icon size={18} />
              {t(labelKey)}
            </Link>
          ))}
        </div>
        {/* Sidebar footer */}
        <div className="pt-4 border-t border-gray-100">
          <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider px-3">Fitrack v2</p>
        </div>
      </nav>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 px-2 pt-2 pb-[env(safe-area-inset-bottom,12px)]">
        <div className="flex">
          {mobileLinks.map(({ href, labelKey, icon: Icon }) => {
            const active = pathname === href
            const label = t(labelKey)
            return (
              <Link key={href} href={href} className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all',
                active ? 'text-gray-950' : 'text-gray-400 hover:text-gray-600'
              )}>
                <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
                <span className={cn('text-[9px] font-bold leading-none', active ? 'text-gray-950' : 'text-gray-400')}>
                  {label.split(' ')[0]}
                </span>
                {active && <div className="w-1 h-1 rounded-full bg-gray-950 mt-0.5" />}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
