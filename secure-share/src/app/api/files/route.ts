import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { checkRateLimit, getClientIp, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limit';
import { verifyTurnstileToken, isTurnstileConfigured } from '@/lib/turnstile';

// Validation schema
const uploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().max(100),
  fileSize: z.number().min(1).max(50 * 1024 * 1024), // Max 50MB - STRICT LIMIT
  encryptedData: z.string().min(1),
  iv: z.string().min(1),
  salt: z.string().optional().default(''), // Optional - not used in current implementation
  oneTimeDownload: z.boolean().default(true),
  expiryHours: z.number().min(1).max(168).default(24), // Max 7 days
  turnstileToken: z.string().optional(), // Cloudflare Turnstile token
});

export async function POST(request: NextRequest) {
  // Rate limiting check
  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(clientIp, RATE_LIMITS.UPLOAD);
  const rateLimitHeaders = createRateLimitHeaders(RATE_LIMITS.UPLOAD, rateLimitResult);
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { 
        success: false, 
        error: RATE_LIMITS.UPLOAD.message,
        retryAfter: rateLimitResult.retryAfter,
      },
      { 
        status: 429,
        headers: rateLimitHeaders,
      }
    );
  }
  
  try {
    const body = await request.json();
    
    // Validate input first
    const validated = uploadSchema.parse(body);
    
    // Cloudflare Turnstile verification (if configured)
    if (isTurnstileConfigured()) {
      if (!validated.turnstileToken) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'CAPTCHA verification required. Please complete the security check.',
          },
          { 
            status: 400,
            headers: rateLimitHeaders,
          }
        );
      }
      
      const turnstileResult = await verifyTurnstileToken(validated.turnstileToken, clientIp);
      if (!turnstileResult.success) {
        return NextResponse.json(
          { 
            success: false, 
            error: turnstileResult.error || 'CAPTCHA verification failed.',
          },
          { 
            status: 400,
            headers: rateLimitHeaders,
          }
        );
      }
    }
    
    // Additional server-side file size check (STRICT)
    // This is the server-side enforcement, cannot be bypassed by client
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB hard limit
    if (validated.fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          success: false, 
          error: `File size exceeds maximum limit of 50MB`,
        },
        { 
          status: 413,
          headers: rateLimitHeaders,
        }
      );
    }
    
    // Calculate expiry time
    const expiresAt = new Date(Date.now() + validated.expiryHours * 60 * 60 * 1000);
    
    // Create file record
    const file = await db.secureFile.create({
      data: {
        fileName: validated.fileName,
        fileType: validated.fileType,
        fileSize: validated.fileSize,
        encryptedData: validated.encryptedData,
        iv: validated.iv,
        salt: validated.salt,
        oneTimeDownload: validated.oneTimeDownload,
        downloadCount: 0,
        expiresAt,
      },
    });
    
    // Return with rate limit headers
    return NextResponse.json({
      success: true,
      fileId: file.id,
      expiresAt: file.expiresAt.toISOString(),
    }, { headers: rateLimitHeaders });
  } catch (error) {
    console.error('Upload error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: error.errors },
        { 
          status: 400,
          headers: rateLimitHeaders,
        }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Upload failed' },
      { 
        status: 500,
        headers: rateLimitHeaders,
      }
    );
  }
}

// GET endpoint to check server status
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    maxFileSize: 50 * 1024 * 1024,
    maxFileSizeFormatted: '50 MB',
    rateLimit: {
      uploads: `${RATE_LIMITS.UPLOAD.maxRequests} per ${RATE_LIMITS.UPLOAD.windowMs / 1000 / 60} minutes`,
    },
    turnstile: {
      enabled: isTurnstileConfigured(),
    },
  });
}
