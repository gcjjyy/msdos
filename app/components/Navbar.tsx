import { Link, useLocation } from "react-router";

export default function Navbar() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const linkBase = "px-4 py-2 rounded-lg text-sm font-medium transition-colors";
  const linkInactive = "text-content-secondary hover:text-content hover:bg-surface-hover";
  const linkActive = "bg-primary text-white";

  return (
    <nav className="flex items-center gap-2 px-6 py-3 bg-surface-elevated border-b border-edge">
      <Link
        to="/"
        className={`${linkBase} ${isActive("/") ? linkActive : linkInactive}`}
      >
        DOSBox
      </Link>
      <Link
        to="/admin"
        className={`${linkBase} ${isActive("/admin") ? linkActive : linkInactive}`}
      >
        관리
      </Link>
    </nav>
  );
}
