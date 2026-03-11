/**
 * Aggressive Cleanup Service for SecureShare
 * 
 * This service ensures files are deleted IMMEDIATELY when:
 * 1. They expire
 * 2. They are marked for deletion (one-time download used)
 * 
 * Runs every 5 minutes for aggressive cleanup
 * Port: 3031
 */

const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes - AGGRESSIVE!
const PORT = 3031;

// Cleanup function - calls the main app's API
async function cleanupExpiredFiles(): Promise<{ deletedCount: number }> {
  try {
    const response = await fetch('http://localhost:3000/api/cleanup', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer secure-share-cleanup-secret',
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.json();
    
    if (result.success) {
      const timestamp = new Date().toISOString();
      if (result.deletedCount > 0) {
        console.log(`[${timestamp}] Cleaned up ${result.deletedCount} expired/deleted files`);
      } else {
        console.log(`[${timestamp}] No files to cleanup`);
      }
      return result;
    } else {
      console.error(`[${new Date().toISOString()}] Cleanup failed:`, result.error);
      return { deletedCount: 0 };
    }
  } catch (error) {
    console.error('Cleanup error:', error);
    return { deletedCount: 0 };
  }
}

// Check database directly for orphaned files
async function checkOrphanedFiles(): Promise<number> {
  try {
    const response = await fetch('http://localhost:3000/api/cleanup');
    const result = await response.json();
    
    const total = result.expiredFiles + result.deletedFiles;
    if (total > 0) {
      console.log(`[${new Date().toISOString()}] Found ${result.expiredFiles} expired + ${result.deletedFiles} deleted files pending cleanup`);
    }
    
    return total;
  } catch {
    return 0;
  }
}

// Start HTTP server for health checks and manual triggers
const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    
    // Health check
    if (url.pathname === '/health') {
      return Response.json({ 
        status: 'ok', 
        service: 'cleanup',
        interval: CLEANUP_INTERVAL,
        lastRun: new Date().toISOString(),
      });
    }
    
    // Manual trigger
    if (url.pathname === '/cleanup' && request.method === 'POST') {
      const result = await cleanupExpiredFiles();
      return Response.json({ success: true, ...result });
    }
    
    // Status check
    if (url.pathname === '/status') {
      const orphaned = await checkOrphanedFiles();
      return Response.json({
        orphanedFiles: orphaned,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Force aggressive cleanup (immediate)
    if (url.pathname === '/force-cleanup' && request.method === 'POST') {
      console.log(`[${new Date().toISOString()}] Force cleanup triggered!`);
      let totalDeleted = 0;
      
      // Run cleanup 3 times to ensure everything is cleaned
      for (let i = 0; i < 3; i++) {
        const result = await cleanupExpiredFiles();
        totalDeleted += result.deletedCount;
        if (result.deletedCount === 0) break;
        await new Promise(r => setTimeout(r, 100)); // Small delay between runs
      }
      
      return Response.json({ 
        success: true, 
        deletedCount: totalDeleted,
        timestamp: new Date().toISOString(),
      });
    }
    
    return Response.json({ error: 'Not found' }, { status: 404 });
  },
});

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║           SecureShare Cleanup Service Started            ║');
console.log('╠══════════════════════════════════════════════════════════╣');
console.log(`║ Port: ${PORT}                                            ║`);
console.log(`║ Interval: Every ${CLEANUP_INTERVAL / 1000 / 60}          ║`);
console.log('╠══════════════════════════════════════════════════════════╣');
console.log('║ Endpoints:                                               ║');
console.log('│   GET  /health        - Health check                     ║');
console.log('│   GET  /status        - Check orphaned files             ║');
console.log('│   POST /cleanup       - Trigger cleanup                  ║');
console.log('│   POST /force-cleanup - Aggressive cleanup (3x)          ║');
console.log('╚══════════════════════════════════════════════════════════╝');

// Wait for main app to start, then run initial cleanup
setTimeout(async () => {
  console.log(`[${new Date().toISOString()}] Running initial cleanup...`);
  await cleanupExpiredFiles();
}, 5000);

// Schedule periodic cleanup
setInterval(async () => {
  await cleanupExpiredFiles();
}, CLEANUP_INTERVAL);

// Additional check every minute for orphaned files
setInterval(async () => {
  const orphaned = await checkOrphanedFiles();
  if (orphaned > 10) {
    console.log(`[${new Date().toISOString()}]Too many orphaned files (${orphaned}), triggering extra cleanup...`);
    await cleanupExpiredFiles();
  }
}, 60 * 1000);

console.log(`Scheduled aggressive cleanup every ${CLEANUP_INTERVAL / 1000 / 60} minutes`);
console.log('Additional orphan check every 1 minute');
