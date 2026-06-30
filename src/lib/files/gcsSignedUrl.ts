import crypto from 'crypto'

type SignMethod = 'GET' | 'PUT' | 'DELETE'

export type GcsSigningCredentials = {
  client_email: string
  private_key: string
}

type SignOptions = {
  bucket: string
  objectKey: string
  method: SignMethod
  expiresMs: number
  contentType?: string
  queryParams?: Record<string, string>
  credentials: GcsSigningCredentials
}

function rfc3986Encode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

function canonicalObjectUri(bucket: string, objectKey: string): string {
  const encoded = objectKey
    .split('/')
    .map((part) => rfc3986Encode(part))
    .join('/')
  return `/${bucket}/${encoded}`
}

/** V4 signed URL через crypto — без OAuth-запросов к Google (важно для VPS). */
export function signGcsV4Url(opts: SignOptions): string {
  const host = 'storage.googleapis.com'
  const now = new Date()
  const requestTimestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const datestamp = requestTimestamp.slice(0, 8)
  const credentialScope = `${datestamp}/auto/storage/goog4_request`
  const credential = `${opts.credentials.client_email}/${credentialScope}`

  const expiresSec = Math.min(
    Math.max(1, Math.floor((opts.expiresMs - now.getTime()) / 1000)),
    604800,
  )

  const signedHeaderNames: string[] = ['host']
  if (opts.method === 'PUT' && opts.contentType) {
    signedHeaderNames.unshift('content-type')
  }

  const signedHeaders = signedHeaderNames.join(';')

  const query: Record<string, string> = {
    'X-Goog-Algorithm': 'GOOG4-RSA-SHA256',
    'X-Goog-Credential': credential,
    'X-Goog-Date': requestTimestamp,
    'X-Goog-Expires': String(expiresSec),
    'X-Goog-SignedHeaders': signedHeaders,
    ...(opts.queryParams ?? {}),
  }

  const canonicalQueryString = Object.keys(query)
    .sort()
    .map((k) => `${rfc3986Encode(k)}=${rfc3986Encode(query[k])}`)
    .join('&')

  let canonicalHeaders = ''
  for (const name of signedHeaderNames) {
    if (name === 'host') {
      canonicalHeaders += `host:${host}\n`
    } else if (name === 'content-type' && opts.contentType) {
      canonicalHeaders += `content-type:${opts.contentType}\n`
    }
  }

  const canonicalUri = canonicalObjectUri(opts.bucket, opts.objectKey)

  const canonicalRequest = [
    opts.method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex')

  const stringToSign = [
    'GOOG4-RSA-SHA256',
    requestTimestamp,
    credentialScope,
    canonicalRequestHash,
  ].join('\n')

  const signature = crypto
    .createSign('sha256')
    .update(stringToSign)
    .sign(opts.credentials.private_key, 'hex')

  return `https://${host}${canonicalUri}?${canonicalQueryString}&X-Goog-Signature=${signature}`
}
