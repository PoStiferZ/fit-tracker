import { getAvatarColor } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface ProfileAvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = {
  sm: 'w-9 h-9 text-sm',
  md: 'w-11 h-11 text-base',
  lg: 'w-14 h-14 text-xl',
  xl: 'w-20 h-20 text-3xl',
}

export default function ProfileAvatar({ name, size = 'md', className }: ProfileAvatarProps) {
  const color = getAvatarColor(name)
  const initial = name.charAt(0).toUpperCase()
  return (
    <div className={cn(
      'rounded-2xl flex items-center justify-center font-bold text-white shrink-0 shadow-sm',
      sizeMap[size],
      color,
      className,
    )}>
      {initial}
    </div>
  )
}
