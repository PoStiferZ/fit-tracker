'use client'
import Image from 'next/image'
import { MUSCLE_IMAGE, MUSCLE_LABELS } from '@/lib/muscles'
import type { MuscleGroup } from '@/types'
import { cn } from '@/lib/utils'

interface MuscleTagProps {
  muscle: MuscleGroup
  variant?: 'orange' | 'white'
  className?: string
}

export default function MuscleTag({ muscle, variant = 'orange', className }: MuscleTagProps) {
  const img = MUSCLE_IMAGE[muscle]
  const label = MUSCLE_LABELS[muscle]
  return (
    <span className={cn(
      'flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
      variant === 'orange' ? 'bg-orange-100 text-orange-600' : 'bg-white/20 text-white',
      className
    )}>
      {img && (
        <Image
          src={img}
          alt={muscle}
          width={12}
          height={12}
          className={cn('object-contain shrink-0', variant === 'white' ? 'brightness-0 invert' : '')}
        />
      )}
      {label}
    </span>
  )
}
