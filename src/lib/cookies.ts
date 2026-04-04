import Cookies from 'js-cookie'

const COOKIE_KEY = 'fit_profile_id'
const COOKIE_MAX_AGE = 365 // days

export function getProfileId(): string | undefined {
  return Cookies.get(COOKIE_KEY)
}

export function setProfileId(id: string): void {
  Cookies.set(COOKIE_KEY, id, { expires: COOKIE_MAX_AGE, path: '/', sameSite: 'lax' })
}

export function clearProfileId(): void {
  Cookies.remove(COOKIE_KEY, { path: '/' })
}
