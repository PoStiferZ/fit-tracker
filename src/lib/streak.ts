import { supabase } from './supabase'
import { getMonday, formatDateISO } from './utils'

/**
 * Calculates the current streak in weeks.
 * A week "counts" if at least one session was completed that week.
 * We walk backwards from last week; the current week never breaks the streak.
 */
export async function fetchStreak(): Promise<number> {
  // Fetch all weekly_plan rows that have at least one completed session
  const { data } = await supabase
    .from('weekly_plan')
    .select('week_start')
    .eq('completed', true)

  if (!data || data.length === 0) return 0

  // Unique week_starts that have completions
  const completedWeeks = new Set(data.map((r) => r.week_start as string))

  // Walk backwards from the most recent *past* completed week
  const today = new Date()
  const currentMonday = getMonday(today)

  let streak = 0
  let checkDate = new Date(currentMonday)
  // Start checking from last week (current week in-progress doesn't break streak)
  checkDate.setDate(checkDate.getDate() - 7)

  while (true) {
    const key = formatDateISO(checkDate)
    if (completedWeeks.has(key)) {
      streak++
      checkDate.setDate(checkDate.getDate() - 7)
    } else {
      break
    }
  }

  // Bonus: if current week already has completions, add it too
  const currentKey = formatDateISO(currentMonday)
  if (completedWeeks.has(currentKey)) streak++

  return streak
}
