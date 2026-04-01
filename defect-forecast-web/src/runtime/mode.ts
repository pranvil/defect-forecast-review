export const isReviewMode = (() => {
  const raw = import.meta.env.VITE_REVIEW_MODE
  if (raw === true) return true
  if (typeof raw === 'string') return raw.toLowerCase() === 'true' || raw === '1'
  return false
})()

