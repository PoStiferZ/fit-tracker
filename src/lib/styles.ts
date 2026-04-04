// Shared class strings — centralised so we avoid custom Tailwind utilities
export const btn = {
  primary: 'bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)] disabled:opacity-40 disabled:shadow-none w-full',
  secondary: 'bg-white text-gray-800 rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-gray-100 disabled:opacity-40 w-full',
  danger: 'bg-red-500 text-white rounded-2xl py-4 font-bold shadow-[0_4px_14px_rgba(239,68,68,0.30)] active:scale-[0.98] transition-all w-full',
}

export const input = 'w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:bg-white transition-all'

export const label = 'block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2'
