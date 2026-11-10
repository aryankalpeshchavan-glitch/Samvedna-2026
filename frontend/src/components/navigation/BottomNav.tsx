import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from 'motion/react';
import { Home, AlertTriangle, Activity, Users, Bell, LifeBuoy, LucideIcon } from 'lucide-react';
import { SosState } from '../../types/emergency';
import { useTranslation } from '../../i18n/LanguageContext';

export type TabType = 'home' | 'incident' | 'status' | 'family' | 'alerts' | 'help';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  sosState: SosState;
}

interface TabItem {
  id: TabType;
  labelKey: string;
  icon: LucideIcon;
  badge?: boolean;
}

interface DockItemProps {
  tab: TabItem;
  isActive: boolean;
  onSelect: () => void;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  mouseY: ReturnType<typeof useMotionValue<number>>;
  label: string;
  index: number;
  total: number;
}

function DockItem({ tab, isActive, onSelect, mouseX, mouseY, label, index, total }: DockItemProps) {
  const itemRef = useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const Icon = tab.icon;

  const distance = useTransform([mouseX, mouseY], (coords: number[]) => {
    const x = coords[0];
    const y = coords[1];
    const bounds = itemRef.current?.getBoundingClientRect();
    if (!bounds) return 150;

    const isDesktop = window.innerWidth >= 1024;
    if (isDesktop) {
      return y - (bounds.y + bounds.height / 2);
    }
    return x - (bounds.x + bounds.width / 2);
  });

  const widthSync = useTransform(distance, [-140, 0, 140], [44, 64, 44]);
  const iconSizeSync = useTransform(distance, [-140, 0, 140], [20, 30, 20]);

  const width = useSpring(widthSync, { mass: 0.1, stiffness: 170, damping: 12 });
  const iconSize = useSpring(iconSizeSync, { mass: 0.1, stiffness: 170, damping: 12 });

  // Tooltip positioning: On mobile, avoid clipping on the left edge (first item) and right edge (last item)
  const mobileTooltipAlign =
    index === 0
      ? 'left-0 translate-x-0'
      : index === total - 1
      ? 'right-0 translate-x-0 left-auto'
      : 'left-1/2 -translate-x-1/2';

  return (
    <div className="relative flex items-center justify-center">
      {/*
        TOOLTIP — two-layer structure:
        Layer 1 (outer): absolute positioning wrapper — handles placement (desktop: right, mobile: above).
                         Uses mobileTooltipAlign to prevent edge clipping on the first and last mobile items.
                         No transform animations here, only Tailwind positioning.
        Layer 2 (inner): motion.div — handles ONLY opacity/scale animation via Framer Motion.
                         No Tailwind translate classes on this element to avoid transform conflicts.
      */}

      {/* Desktop tooltip wrapper: positioned to the right, vertically centred */}
      <div
        className="hidden lg:block absolute left-full ml-3 top-1/2 -translate-y-1/2 pointer-events-none z-50"
        aria-hidden="true"
      >
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.88 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-[#202622] text-[#FAF9F3] text-[11px] font-heading font-bold shadow-lg border border-white/10 origin-left"
              role="tooltip"
            >
              {label}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile tooltip wrapper: positioned above the icon with edge-clipping protection */}
      <div
        className={`lg:hidden absolute bottom-full mb-2 pointer-events-none z-50 ${mobileTooltipAlign}`}
        aria-hidden="true"
      >
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.88 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-[#202622] text-[#FAF9F3] text-[11px] font-heading font-bold shadow-lg border border-white/10 origin-bottom"
              role="tooltip"
            >
              {label}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Dock Item Button */}
      <motion.button
        ref={itemRef}
        style={{ width, height: width }}
        onClick={onSelect}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        className={`relative flex items-center justify-center rounded-2xl transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#23483A] shadow-sm tactile-press ${
          isActive
            ? 'bg-[#23483A] text-[#FAF9F3] shadow-md'
            : 'bg-[#F4F1E8] text-[#536A72] hover:text-[#202622] hover:bg-[#E8E6DC]'
        }`}
        aria-label={`Navigate to ${label}`}
        aria-describedby={isHovered ? `tooltip-${tab.id}` : undefined}
      >
        <motion.div style={{ width: iconSize, height: iconSize }} className="flex items-center justify-center relative">
          <Icon className="w-full h-full" />
          {tab.badge && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#8E2F2B] animate-ping border border-[#FAF9F3]" />
          )}
        </motion.div>

        {/* Active Indicator Dot */}
        {isActive && (
          <span className="absolute bottom-1 lg:bottom-auto lg:right-1 w-1.5 h-1.5 rounded-full bg-[#FAF9F3]" />
        )}
      </motion.button>
    </div>
  );
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, sosState }) => {
  const { t } = useTranslation();
  const mouseX = useMotionValue(Infinity);
  const mouseY = useMotionValue(Infinity);

  const tabs: TabItem[] = [
    { id: 'home', labelKey: 'nav.map', icon: Home },
    { id: 'incident', labelKey: 'nav.report', icon: AlertTriangle },
    { id: 'status', labelKey: 'nav.sosStatus', icon: Activity, badge: sosState !== 'IDLE' },
    { id: 'family', labelKey: 'nav.family', icon: Users },
    { id: 'alerts', labelKey: 'nav.alerts', icon: Bell },
    { id: 'help', labelKey: 'nav.help', icon: LifeBuoy },
  ];

  return (
    <nav
      onMouseMove={(e) => {
        mouseX.set(e.clientX);
        mouseY.set(e.clientY);
      }}
      onMouseLeave={() => {
        mouseX.set(Infinity);
        mouseY.set(Infinity);
      }}
      className="fixed z-40 font-sans max-w-full px-2 lg:px-0 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 lg:bottom-auto lg:left-4 lg:top-1/2 lg:-translate-y-1/2 lg:translate-x-0"
    >
      <div className="flex flex-row lg:flex-col items-center space-x-2 sm:space-x-3 lg:space-x-0 lg:space-y-3 px-3 py-2 lg:px-2 lg:py-3 rounded-3xl bg-[#FAF9F3]/95 backdrop-blur-md border border-[#C7B89B]/60 shadow-xl border-t border-t-white/40">
        {tabs.map((tab, idx) => {
          const isActive = activeTab === tab.id;
          const label = t(tab.labelKey);

          return (
            <DockItem
              key={tab.id}
              tab={tab}
              isActive={isActive}
              onSelect={() => onTabChange(tab.id)}
              mouseX={mouseX}
              mouseY={mouseY}
              label={label}
              index={idx}
              total={tabs.length}
            />
          );
        })}
      </div>
    </nav>
  );
};
