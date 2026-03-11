'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: TurnstileOptions) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

interface TurnstileOptions {
  sitekey: string;
  callback?: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
  retry?: 'auto' | 'never';
  'retry-interval'?: number;
  refreshExpired?: 'auto' | 'manual' | 'never';
  language?: string;
}

interface TurnstileProps {
  siteKey?: string;
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
}

export default function Turnstile({
  siteKey,
  onVerify,
  onError,
  onExpire,
  theme = 'dark',
  className = '',
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const isRenderedRef = useRef(false);
  const [isScriptLoading, setIsScriptLoading] = useState(true);

  const actualSiteKey = siteKey || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const renderWidget = useCallback(() => {
    if (!window.turnstile || !containerRef.current || !actualSiteKey || isRenderedRef.current) return;

    // Clear any existing widget
    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch (e) {
        // Ignore errors when removing non-existent widget
      }
      widgetIdRef.current = null;
    }

    // Clear container
    containerRef.current.innerHTML = '';

    // Render new widget
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: actualSiteKey,
      callback: onVerify,
      'error-callback': onError,
      'expired-callback': onExpire,
      theme,
      size: 'normal',
      retry: 'auto',
      language: 'auto',
    });

    isRenderedRef.current = true;
  }, [actualSiteKey, onVerify, onError, onExpire, theme]);

  useEffect(() => {
    if (!actualSiteKey) return;

    // Check if Turnstile is already loaded
    if (window.turnstile) {
      // Use setTimeout to defer setState outside of effect body
      const timer = setTimeout(() => {
        renderWidget();
        setIsScriptLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
    if (existingScript) {
      // Wait for it to load
      window.onTurnstileLoad = () => {
        renderWidget();
        setIsScriptLoading(false);
      };
      return;
    }

    // Load Turnstile script
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';
    script.async = true;
    script.defer = true;

    window.onTurnstileLoad = () => {
      renderWidget();
      setIsScriptLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup on unmount
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          // Ignore errors
        }
      }
    };
  }, [actualSiteKey, renderWidget]);

  // Reset widget when callbacks change (for re-rendering after token expiry)
  const resetWidget = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  // Expose reset function via ref
  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as any).resetTurnstile = resetWidget;
    }
  }, [resetWidget]);

  if (!actualSiteKey) {
    return null; // Don't render if no site key configured
  }

  return (
    <div className={`turnstile-container ${className}`}>
      {isScriptLoading && (
        <div className="flex items-center gap-2 text-sm opacity-70">
          <i className="bi bi-shield-check animate-pulse" style={{ color: '#FCD34D' }}></i>
          <span style={{ color: 'rgba(167, 139, 250, 0.7)' }}>Loading security check...</span>
        </div>
      )}
      <div 
        ref={containerRef} 
        className={`turnstile-widget ${isScriptLoading ? 'hidden' : ''}`}
      />
    </div>
  );
}
