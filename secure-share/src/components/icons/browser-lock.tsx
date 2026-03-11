interface BrowserLockIconProps {
  className?: string;
  style?: React.CSSProperties;
  size?: number;
}

export function BrowserLockIcon({ className = '', style, size = 14 }: BrowserLockIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 14 14"
      height={size}
      width={size}
      className={className}
      style={style}
    >
      <g id="browser-lock--secure-password-window-browser-lock-security-login-encryption">
        <path
          id="Union"
          fill="#8fbffa"
          fillRule="evenodd"
          d="M1.75 0.046C0.81 0.046 0.047 0.81 0.047 1.751v10.498c0 0.942 0.763 1.705 1.705 1.705H12.25c0.942 0 1.705 -0.763 1.705 -1.705V1.751c0 -0.942 -0.763 -1.705 -1.705 -1.705H1.751Z"
          clipRule="evenodd"
        />
        <path
          id="Union_2"
          fill="#2859c5"
          d="M1.75 0.046C0.81 0.046 0.047 0.81 0.047 1.751V3.5h13.908V1.75c0 -0.94 -0.763 -1.704 -1.705 -1.704H1.751Z"
        />
        <path
          id="Union_3"
          fill="#2859c5"
          fillRule="evenodd"
          d="M6.125 7.267a0.875 0.875 0 1 1 1.75 0v0.5h-1.75v-0.5Zm-1.25 0.72v-0.72a2.125 2.125 0 1 1 4.25 0v0.72a0.998 0.998 0 0 1 0.375 0.78v2a1 1 0 0 1 -1 1h-3a1 1 0 0 1 -1 -1v-2c0 -0.316 0.146 -0.598 0.375 -0.78Z"
          clipRule="evenodd"
        />
      </g>
    </svg>
  );
}

// Gold-tinted version for the app's theme
export function BrowserLockGoldIcon({ className = '', style, size = 14 }: BrowserLockIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 14 14"
      height={size}
      width={size}
      className={className}
      style={style}
    >
      <g id="browser-lock--secure-password-window-browser-lock-security-login-encryption">
        <path
          id="Union"
          fill="#FDE68A"
          fillRule="evenodd"
          d="M1.75 0.046C0.81 0.046 0.047 0.81 0.047 1.751v10.498c0 0.942 0.763 1.705 1.705 1.705H12.25c0.942 0 1.705 -0.763 1.705 -1.705V1.751c0 -0.942 -0.763 -1.705 -1.705 -1.705H1.751Z"
          clipRule="evenodd"
        />
        <path
          id="Union_2"
          fill="#F59E0B"
          d="M1.75 0.046C0.81 0.046 0.047 0.81 0.047 1.751V3.5h13.908V1.75c0 -0.94 -0.763 -1.704 -1.705 -1.704H1.751Z"
        />
        <path
          id="Union_3"
          fill="#92400E"
          fillRule="evenodd"
          d="M6.125 7.267a0.875 0.875 0 1 1 1.75 0v0.5h-1.75v-0.5Zm-1.25 0.72v-0.72a2.125 2.125 0 1 1 4.25 0v0.72a0.998 0.998 0 0 1 0.375 0.78v2a1 1 0 0 1 -1 1h-3a1 1 0 0 1 -1 -1v-2c0 -0.316 0.146 -0.598 0.375 -0.78Z"
          clipRule="evenodd"
        />
      </g>
    </svg>
  );
}
