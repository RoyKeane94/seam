const INK = '#0f0e0c';
const YELLOW = '#f0c832';

export default function SeamLogo({ size = 24, className = '' }) {
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
      <line x1="12" y1="5" x2="5" y2="19" stroke={YELLOW} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="5" x2="19" y2="19" stroke={YELLOW} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="5" y1="19" x2="19" y2="19" stroke={YELLOW} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="5" r="3" fill={YELLOW} />
      <circle cx="5" cy="19" r="3" fill={INK} />
      <circle cx="19" cy="19" r="3" fill={INK} />
    </svg>
  );
}
