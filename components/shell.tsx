"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartColumn, House, Package, Receipt, Settings, ShoppingBasket } from "lucide-react";
import { HouseholdProvider, useHousehold } from "./household-provider";

const tabs = [
  { href: "/inicio", label: "Inicio", icon: House },
  { href: "/supermercado", label: "Super", icon: ShoppingBasket },
  { href: "/gastos", label: "Gastos", icon: Receipt },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/estadisticas", label: "Datos", icon: ChartColumn },
];

function Frame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { household } = useHousehold();

  return (
    <div className="app-frame">
      <header className="topbar">
        <div>
          <h1>{household.name}</h1>
        </div>
        <Link href="/configuracion" className="icon-button" aria-label="Configuración">
          <Settings size={20} />
        </Link>
      </header>
      <main className="screen">{children}</main>
      <nav className="tabbar" aria-label="Principal">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = pathname === tab.href || (tab.href !== "/inicio" && pathname.startsWith(tab.href));
          return (
            <Link key={tab.href} href={tab.href} className={active ? "tab active" : "tab"}>
              <Icon size={20} />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <HouseholdProvider>
      <Frame>{children}</Frame>
    </HouseholdProvider>
  );
}
