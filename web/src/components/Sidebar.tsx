import {
  ArrowLeftRight,
  BadgeCheck,
  Calculator,
  DownloadCloud,
  FileDown,
  FileUp,
  Landmark,
  LayoutDashboard,
  Plug,
  Settings,
  Upload,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/captura', label: 'Captura SEFAZ', icon: DownloadCloud },
  { to: '/documentos', label: 'Documentos de Entrada', icon: FileDown },
  { to: '/documentos-saida', label: 'Documentos de Saída', icon: FileUp },
  { to: '/importar', label: 'Importar XML', icon: Upload },
  { to: '/apuracoes', label: 'Apurações', icon: Calculator },
  { to: '/bling', label: 'Bling (saídas)', icon: Plug },
  { to: '/validador', label: 'Validador NCM', icon: BadgeCheck },
  { to: '/reforma', label: 'Reforma CBS/IBS', icon: ArrowLeftRight },
  { to: '/configuracao', label: 'Configuração', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="fixed bottom-0 left-0 top-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <Landmark className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide">Apurax</h1>
            <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">Crédito &amp; Apuração</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20'
                  : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <p className="text-center text-[10px] text-sidebar-foreground/40">
          ICMS · IPI · PIS/COFINS · ISS · CBS/IBS
          <br />
          MVP v0.2
        </p>
      </div>
    </aside>
  );
}
