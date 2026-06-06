import LogoMark from './LogoMark';

export default function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <div className="foot-inner">
        <a href="/" className="foot-brand">
          <LogoMark size={20} />
          seam
        </a>
        <p>© 2026</p>
      </div>
    </footer>
  );
}
