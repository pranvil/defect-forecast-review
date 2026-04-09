export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

export class HttpError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function buildErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const text = await res.text()
    if (!text) return `${fallback}: ${res.status}`
    try {
      const parsed = JSON.parse(text) as { detail?: unknown }
      if (typeof parsed.detail === 'string') return `${fallback}: ${res.status} ${parsed.detail}`
      if (parsed.detail !== undefined) return `${fallback}: ${res.status} ${JSON.stringify(parsed.detail)}`
      return `${fallback}: ${res.status} ${text}`
    } catch {
      return `${fallback}: ${res.status} ${text}`
    }
  } catch {
    return `${fallback}: ${res.status}`
  }
}

export async function httpGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    throw new HttpError(await buildErrorMessage(res, `GET ${path} failed`), res.status)
  }
  return (await res.json()) as T
}

export async function httpPost<TReq, TResp>(path: string, body: TReq): Promise<TResp> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new HttpError(await buildErrorMessage(res, `POST ${path} failed`), res.status)
  }
  return (await res.json()) as TResp
}

export async function httpPut<TReq, TResp>(path: string, body: TReq): Promise<TResp> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new HttpError(await buildErrorMessage(res, `PUT ${path} failed`), res.status)
  }
  return (await res.json()) as TResp
}

export async function httpDelete(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' })
  if (!res.ok) {
    throw new HttpError(await buildErrorMessage(res, `DELETE ${path} failed`), res.status)
  }
}
