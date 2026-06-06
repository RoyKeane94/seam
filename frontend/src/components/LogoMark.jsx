import SeamLogo from './SeamLogo';

export default function LogoMark({ className = '', size = 26 }) {
  return (
    <div className={`logo-mark${className ? ` ${className}` : ''}`}>
      <SeamLogo size={size} />
    </div>
  );
}
