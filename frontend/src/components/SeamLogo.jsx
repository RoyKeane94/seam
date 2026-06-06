const YELLOW = '#f0c832';
const WHITE = '#ffffff';

const VARIANTS = {
  default: {
    bg: WHITE,
    border: 'rgba(15, 14, 12, 0.1)',
    mark: YELLOW,
  },
  inverted: {
    bg: YELLOW,
    border: 'none',
    mark: WHITE,
  },
};

export default function SeamLogo({ size = 24, className = '', variant = 'default' }) {
  const { bg, border, mark } = VARIANTS[variant] ?? VARIANTS.default;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        width="24"
        height="24"
        rx="5"
        fill={bg}
        stroke={border}
        strokeWidth={variant === 'default' ? 0.5 : 0}
      />
      <line x1="12" y1="5" x2="5" y2="19" stroke={mark} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="5" x2="19" y2="19" stroke={mark} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="5" y1="19" x2="19" y2="19" stroke={mark} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="5" r="3" fill={mark} />
      <circle cx="5" cy="19" r="3" fill={mark} />
      <circle cx="19" cy="19" r="3" fill={mark} />
    </svg>
  );
}
