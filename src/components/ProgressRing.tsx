'use client'

interface ProgressRingProps {
  done: number
  total: number
  size?: number
  strokeWidth?: number
}

export default function ProgressRing({ done, total, size = 96, strokeWidth = 8 }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = total === 0 ? 0 : Math.min(done / total, 1)
  const offset = circumference * (1 - progress)
  const isComplete = done === total && total > 0

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#f3f4f6" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={isComplete ? '#22c55e' : '#111827'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1), stroke 0.3s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-black leading-none ${isComplete ? 'text-green-500' : 'text-gray-900'}`}>
          {done}
        </span>
        <span className="text-xs font-medium text-gray-400 leading-none mt-0.5">/{total}</span>
      </div>
    </div>
  )
}
