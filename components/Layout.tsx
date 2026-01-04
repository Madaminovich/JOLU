
import React from 'react';
import { Role } from '../types';
import { I18N } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  userRole: Role;
  currentTab: string;
  onTabChange: (tab: string) => void;
  lang: 'ru' | 'en' | 'ky';
  onLangChange: (lang: 'ru' | 'en' | 'ky') => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  userRole, 
  currentTab, 
  onTabChange, 
  lang,
  onLangChange
}) => {
  const t = I18N[lang];

  return (
    <div className="max-w-xl mx-auto min-h-screen bg-gray-50 flex flex-col relative overflow-x-hidden">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-gray-100 px-6 py-3 flex flex-col gap-3 shadow-sm transition-all">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
             <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-200 font-brand">J</div>
             <span className="font-extrabold tracking-tight text-2xl text-gray-900 font-brand">{t.brandName}</span>
          </div>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {(['ru', 'en', 'ky'] as const).map((l) => (
              <button
                key={l}
                onClick={() => onLangChange(l)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${
                  lang === l ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="py-1">
            <div className="border-[3px] border-blue-300 rounded-lg p-3 bg-white shadow-sm">
                <p className="text-sm font-brand text-blue-600 font-bold leading-snug text-center whitespace-pre-line tracking-tight">
                  {t.slogan}
                </p>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl bg-white/95 backdrop-blur-xl border-t border-gray-100 px-6 py-3 pb-8 flex justify-between items-center z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
        {userRole === Role.ADMIN ? (
          <>
            <NavItem icon="📦" label={t.orders} active={currentTab === 'admin-orders'} onClick={() => onTabChange('admin-orders')} />
            <NavItem icon="🏗️" label={t.stock} active={currentTab === 'admin-products'} onClick={() => onTabChange('admin-products')} />
            <NavItem icon="📊" label={t.stats} active={currentTab === 'admin-dashboard'} onClick={() => onTabChange('admin-dashboard')} />
            <NavItem icon="⚙️" label={t.settings} active={currentTab === 'admin-settings'} onClick={() => onTabChange('admin-settings')} />
          </>
        ) : (
          <>
            <NavItem 
                icon={<CatalogIcon active={currentTab === 'catalog'} />} 
                label={t.catalog} 
                active={currentTab === 'catalog'} 
                onClick={() => onTabChange('catalog')} 
            />
            <NavItem icon="🛒" label={t.cart} active={currentTab === 'cart'} onClick={() => onTabChange('cart')} />
            <NavItem icon="👤" label={t.profile} active={currentTab === 'profile'} onClick={() => onTabChange('profile')} />
          </>
        )}
      </nav>
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1.5 transition-all active:scale-95 px-2">
    <div className={`text-2xl transition-all ${active ? 'scale-110 drop-shadow-md text-blue-600' : 'text-gray-400'}`}>
        {typeof icon === 'string' ? icon : icon}
    </div>
    <span className={`text-[10px] font-bold uppercase tracking-tight ${active ? 'text-blue-600' : 'text-gray-400'}`}>{label}</span>
  </button>
);

const CatalogIcon = ({ active }: { active: boolean }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill={active ? "currentColor" : "none"} 
    stroke="currentColor" 
    strokeWidth={active ? 2 : 1.5} 
    className="w-7 h-7"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
);
