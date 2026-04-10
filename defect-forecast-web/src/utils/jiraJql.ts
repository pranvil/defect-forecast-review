/**
 * 从 JQL 中解析单一 project key（与后端存储、fetch-debug 路径一致）。
 * 支持：project = KEY、"KEY"、'KEY'；project in (KEY) 仅一项。
 * project in (A, B) 等多项目返回 null，需用户手动指定。
 */
export function extractProjectKeyFromJql(jql: string): string | null {
  const compact = jql.replace(/\s+/g, ' ').trim()
  if (!compact) return null

  const mQuotedDouble = /\bproject\s*=\s*"([^"]+)"/i.exec(compact)
  if (mQuotedDouble) return mQuotedDouble[1].trim()

  const mQuotedSingle = /\bproject\s*=\s*'([^']+)'/i.exec(compact)
  if (mQuotedSingle) return mQuotedSingle[1].trim()

  const mEq = /\bproject\s*=\s*([A-Za-z][A-Za-z0-9_]*)\b/i.exec(compact)
  if (mEq) return mEq[1].trim()

  const mInOneQuoted = /\bproject\s+in\s*\(\s*"([^"]+)"\s*\)/i.exec(compact)
  if (mInOneQuoted) return mInOneQuoted[1].trim()

  const mInOneSingle = /\bproject\s+in\s*\(\s*'([^']+)'\s*\)/i.exec(compact)
  if (mInOneSingle) return mInOneSingle[1].trim()

  const mInOneBare = /\bproject\s+in\s*\(\s*([A-Za-z][A-Za-z0-9_]*)\s*\)/i.exec(compact)
  if (mInOneBare) return mInOneBare[1].trim()

  return null
}
