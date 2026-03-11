/**
 * Cloudflare Turnstile Verification
 * 
 * Turnstile is Cloudflare's CAPTCHA alternative - invisible or one-click
 * More privacy-friendly than reCAPTCHA, no annoying image selection
 */

interface TurnstileVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  error_codes?: string[];
  action?: string;
  cdata?: string;
}

interface TurnstileVerifyResult {
  success: boolean;
  error?: string;
}

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verify a Turnstile token on the server side
 * @param token - The token received from the client-side Turnstile widget
 * @param ip - Optional client IP for additional verification
 * @returns Verification result
 */
export async function verifyTurnstileToken(
  token: string,
  ip?: string
): Promise<TurnstileVerifyResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  
  // If no secret key configured, skip verification (development mode)
  // In production, you should always have this configured
  if (!secretKey || secretKey === 'your-turnstile-secret-key-here') {
    console.warn('Turnstile secret key not configured - skipping verification');
    return { success: true };
  }
  
  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (ip) {
      formData.append('remoteip', ip);
    }
    
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    const result: TurnstileVerifyResponse = await response.json();
    
    if (result.success) {
      return { success: true };
    }
    
    console.error('Turnstile verification failed:', result.error_codes);
    return {
      success: false,
      error: 'CAPTCHA verification failed. Please try again.',
    };
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return {
      success: false,
      error: 'CAPTCHA verification error. Please try again.',
    };
  }
}

/**
 * Check if Turnstile is configured
 */
export function isTurnstileConfigured(): boolean {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  
  return (
    !!siteKey &&
    !!secretKey &&
    siteKey !== 'your-turnstile-site-key-here' &&
    secretKey !== 'your-turnstile-secret-key-here'
  );
}
