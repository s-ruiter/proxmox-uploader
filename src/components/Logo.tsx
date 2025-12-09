export default function Logo({ className, size = 40 }: { className?: string; size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <defs>
                <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent)" />
                    <stop offset="100%" stopColor="var(--primary)" />
                </linearGradient>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            <g filter="url(#glow)">
                {/* Hexagon Outline */}
                <path
                    d="M50 5 L93.3 30 V80 L50 105 L6.7 80 V30 Z"
                    stroke="url(#logo-gradient)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    transform="translate(0, -5) scale(0.9) translate(5.5, 5)"
                />

                {/* Internal Connections - stylized molecule/node structure */}
                <line x1="50" y1="5" x2="50" y2="35" stroke="url(#logo-gradient)" strokeWidth="3" opacity="0.8" />
                <line x1="93.3" y1="30" x2="65" y2="45" stroke="url(#logo-gradient)" strokeWidth="3" opacity="0.8" />
                <line x1="93.3" y1="80" x2="65" y2="65" stroke="url(#logo-gradient)" strokeWidth="3" opacity="0.8" />
                <line x1="50" y1="105" x2="50" y2="75" stroke="url(#logo-gradient)" strokeWidth="3" opacity="0.8" />
                <line x1="6.7" y1="80" x2="35" y2="65" stroke="url(#logo-gradient)" strokeWidth="3" opacity="0.8" />
                <line x1="6.7" y1="30" x2="35" y2="45" stroke="url(#logo-gradient)" strokeWidth="3" opacity="0.8" />

                {/* Central Hub */}
                <circle cx="50" cy="55" r="10" stroke="url(#logo-gradient)" strokeWidth="3" fill="none" />
                <circle cx="50" cy="55" r="4" fill="var(--foreground)" opacity="0.9" />

                {/* Corner Dots */}
                <circle cx="50" cy="5" r="4" fill="url(#logo-gradient)" />
                <circle cx="93.3" cy="30" r="4" fill="url(#logo-gradient)" />
                <circle cx="93.3" cy="80" r="4" fill="url(#logo-gradient)" />
                <circle cx="50" cy="105" r="4" fill="url(#logo-gradient)" />
                <circle cx="6.7" cy="80" r="4" fill="url(#logo-gradient)" />
                <circle cx="6.7" cy="30" r="4" fill="url(#logo-gradient)" />
            </g>
        </svg>
    );
}
