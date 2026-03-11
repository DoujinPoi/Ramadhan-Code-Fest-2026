import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Cleanup expired files - AGGRESSIVE
// This should be called frequently by the cleanup service
export async function POST(request: Request) {
  try {
    // Verify secret token for security
    const authHeader = request.headers.get('authorization');
    const secret = process.env.CLEANUP_SECRET || 'secure-share-cleanup-secret';
    
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const now = new Date();
    
    // AGGRESSIVE DELETE: Delete all expired and marked-for-deletion files
    // This is a hard delete - files are permanently removed
    const result = await db.secureFile.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },           // Expired files
          { isDeleted: true },                   // Marked for deletion
        ],
      },
    });
    
    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { success: false, error: 'Cleanup failed' },
      { status: 500 }
    );
  }
}

// GET endpoint to check cleanup status
export async function GET() {
  const now = new Date();
  
  try {
    // Count expired files
    const expiredCount = await db.secureFile.count({
      where: {
        expiresAt: { lt: now },
        isDeleted: false,
      },
    });
    
    // Count deleted files pending removal
    const deletedCount = await db.secureFile.count({
      where: { isDeleted: true },
    });
    
    // Count active files
    const activeCount = await db.secureFile.count({
      where: {
        expiresAt: { gt: now },
        isDeleted: false,
      },
    });
    
    return NextResponse.json({
      activeFiles: activeCount,
      expiredFiles: expiredCount,
      deletedFiles: deletedCount,
      needsCleanup: expiredCount + deletedCount,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({
      error: 'Failed to get status',
      timestamp: now.toISOString(),
    });
  }
}
