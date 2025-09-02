// JWT utilities using Cloudflare Web Crypto API

import { JWTPayload } from '../../shared/types';

export async function generateJWT(payload: JWTPayload, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '');
  
  const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
  const [header, payload, signature] = token.split('.');
  
  if (!header || !payload || !signature) {
    throw new Error('Invalid token format');
  }
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const data = encoder.encode(`${header}.${payload}`);
  const signatureBuffer = Uint8Array.from(
    atob(signature.replace(/-/g, '+').replace(/_/g, '/')), 
    c => c.charCodeAt(0)
  );
  
  const isValid = await crypto.subtle.verify('HMAC', key, signatureBuffer, data);
  
  if (!isValid) {
    throw new Error('Invalid token signature');
  }
  
  const decodedPayload = JSON.parse(atob(payload)) as JWTPayload;
  
  // Check expiration
  if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }
  
  return decodedPayload;
}

export function createJWTPayload(
  email: string,
  type: 'magic_link' | 'session' = 'session',
  expirationMinutes: number = 60 * 24 * 7, // 7 days default
  additionalData?: Partial<JWTPayload>
): JWTPayload {
  const now = Math.floor(Date.now() / 1000);
  
  return {
    email,
    type,
    exp: now + (expirationMinutes * 60),
    iat: now,
    ...additionalData
  };
}
