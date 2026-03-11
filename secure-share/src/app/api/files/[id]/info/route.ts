import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkRateLimit, getClientIp, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limit';

// Get file info without triggering download
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting check
  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(clientIp, RATE_LIMITS.INFO);
  const rateLimitHeaders = createRateLimitHeaders(RATE_LIMITS.INFO, rateLimitResult);
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { 
        success: false, 
        error: RATE_LIMITS.INFO.message,
        retryAfter: rateLimitResult.retryAfter,
      },
      { 
        status: 429,
        headers: rateLimitHeaders,
      }
    );
  }
  
  try {
    const { id } = await params;
    
    const file = await db.secureFile.findUnique({
      where: { id },
    });
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404, headers: rateLimitHeaders }
      );
    }
    
    // Check if already deleted
    if (file.isDeleted) {
      return NextResponse.json(
        { success: false, error: 'Sorry, This File Has Been Downloaded' },
        { status: 410, headers: rateLimitHeaders }
      );
    }
    
    // Check if expired
    if (new Date() > file.expiresAt) {
      return NextResponse.json(
        { success: false, error: 'Sorry, The Time For Downloading The File Has Expired' },
        { status: 410, headers: rateLimitHeaders }
      );
    }
    
    // Check if one-time download already used
    if (file.oneTimeDownload && file.downloadCount >= 1) {
      return NextResponse.json(
        { success: false, error: 'Sorry, This File Has Been Downloaded' },
        { status: 410, headers: rateLimitHeaders }
      );
    }
    
    // Return file info (without encrypted data)
    return NextResponse.json({
      success: true,
      file: {
        fileName: file.fileName,
        fileType: file.fileType,
        fileSize: file.fileSize,
        oneTimeDownload: file.oneTimeDownload,
        expiresAt: file.expiresAt.toISOString(),
      },
    }, { headers: rateLimitHeaders });
  } catch (error) {
    console.error('Info error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get file info' },
      { status: 500, headers: rateLimitHeaders }
    );
  }
}
