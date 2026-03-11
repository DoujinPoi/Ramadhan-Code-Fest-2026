import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { checkRateLimit, getClientIp, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limit';

// Atomic download with optimistic locking
// This prevents race conditions for one-time downloads
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting check
  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(clientIp, RATE_LIMITS.DOWNLOAD);
  const rateLimitHeaders = createRateLimitHeaders(RATE_LIMITS.DOWNLOAD, rateLimitResult);
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { 
        success: false, 
        error: RATE_LIMITS.DOWNLOAD.message,
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
    
    // Use interactive transaction for atomic operation
    const result = await db.$transaction(async (tx) => {
      // Find the file
      const file = await tx.secureFile.findUnique({
        where: { id },
      });
      
      if (!file) {
        throw new Error('FILE_NOT_FOUND');
      }
      
      // Check if already deleted
      if (file.isDeleted) {
        throw new Error('FILE_DELETED');
      }
      
      // Check if expired
      if (new Date() > file.expiresAt) {
        throw new Error('FILE_EXPIRED');
      }
      
      // Check if one-time download already used
      if (file.oneTimeDownload && file.downloadCount >= 1) {
        throw new Error('ALREADY_DOWNLOADED');
      }
      
      // For one-time downloads, increment counter atomically
      // Using optimistic locking with version field
      if (file.oneTimeDownload) {
        const updated = await tx.secureFile.updateMany({
          where: {
            id,
            version: file.version, // Optimistic lock
          },
          data: {
            downloadCount: { increment: 1 },
            version: { increment: 1 },
          },
        });
        
        // If no rows updated, it means race condition occurred
        if (updated.count === 0) {
          throw new Error('RACE_CONDITION');
        }
        
        // Mark for deletion after download
        await tx.secureFile.update({
          where: { id },
          data: {
            isDeleted: true,
            deletedAt: new Date(),
          },
        });
      } else {
        // Just increment counter for non-one-time downloads
        await tx.secureFile.update({
          where: { id },
          data: {
            downloadCount: { increment: 1 },
          },
        });
      }
      
      return file;
    }, {
      // Set isolation level for SQLite
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    
    // Return encrypted data (client will decrypt)
    return NextResponse.json({
      success: true,
      file: {
        fileName: result.fileName,
        fileType: result.fileType,
        fileSize: result.fileSize,
        encryptedData: result.encryptedData,
        iv: result.iv,
        downloadCount: result.downloadCount + 1,
        oneTimeDownload: result.oneTimeDownload,
        expiresAt: result.expiresAt.toISOString(),
      },
    }, { headers: rateLimitHeaders });
  } catch (error) {
    console.error('Download error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Download failed';
    
    if (errorMessage === 'FILE_NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404, headers: rateLimitHeaders }
      );
    }
    
    if (errorMessage === 'FILE_DELETED') {
      return NextResponse.json(
        { success: false, error: 'Sorry, This File Has Been Downloaded' },
        { status: 410, headers: rateLimitHeaders }
      );
    }
    
    if (errorMessage === 'FILE_EXPIRED') {
      return NextResponse.json(
        { success: false, error: 'Sorry, The Time For Downloading The File Has Expired' },
        { status: 410, headers: rateLimitHeaders }
      );
    }
    
    if (errorMessage === 'ALREADY_DOWNLOADED') {
      return NextResponse.json(
        { success: false, error: 'Sorry, This File Has Been Downloaded' },
        { status: 410, headers: rateLimitHeaders }
      );
    }
    
    if (errorMessage === 'RACE_CONDITION') {
      return NextResponse.json(
        { success: false, error: 'Sorry, This File Has Been Downloaded' },
        { status: 409, headers: rateLimitHeaders }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Download failed' },
      { status: 500, headers: rateLimitHeaders }
    );
  }
}

// DELETE endpoint for manual file deletion
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    await db.secureFile.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
    
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Delete failed' },
      { status: 500 }
    );
  }
}
