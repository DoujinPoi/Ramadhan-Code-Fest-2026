/**
 * Rate Limiting Utility
 * 
 * In-memory rate limiting for API endpoints.
 * For production with multiple instances, consider using Redis.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limits
// Key: IP address or identifier
// Value: { count, resetAt }
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  // Maximum requests allowed in the window
  maxRequests: number;
  // Window duration in milliseconds
  windowMs: number;
  // Custom message when limit exceeded
  message?: string;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter: number; // seconds until reset
}

/**
 * Check rate limit for a given identifier
 * 
 * @param identifier - Usually IP address or user ID
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  
  // If no entry or window expired, create new entry
  if (!entry || now > entry.resetAt) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(identifier, newEntry);
    
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetAt: new Date(newEntry.resetAt),
      retryAfter: 0,
    };
  }
  
  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    
    return {
      success: false,
      remaining: 0,
      resetAt: new Date(entry.resetAt),
      retryAfter,
    };
  }
  
  // Increment counter
  entry.count++;
  rateLimitStore.set(identifier, entry);
  
  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetAt: new Date(entry.resetAt),
    retryAfter: 0,
  };
}

/**
 * Get client IP from request headers
 */
export function getClientIp(request: Request): string {
  // Check various headers for real IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // Take first IP in the chain
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fallback to a default (in production, this should not happen)
  return 'unknown';
}

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMITS = {
  // Upload: 5 files per hour per IP
  UPLOAD: {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many uploads. Please try again later.',
  },
  
  // Download: 10 downloads per hour per IP
  DOWNLOAD: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many downloads. Please try again later.',
  },
  
  // API general: 100 requests per minute per IP
  GENERAL: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many requests. Please slow down.',
  },
  
  // Info endpoint: 30 requests per minute per IP
  INFO: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many requests. Please slow down.',
  },
} as const;

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(
  config: RateLimitConfig,
  result: RateLimitResult
): Headers {
  const headers = new Headers();
  
  headers.set('X-RateLimit-Limit', config.maxRequests.toString());
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', result.resetAt.toISOString());
  
  if (!result.success) {
    headers.set('Retry-After', result.retryAfter.toString());
  }
  
  return headers;
}
