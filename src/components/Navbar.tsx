"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, PiggyBank, LayoutDashboard } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    {
      name: "Quincena",
      href: "/",
      icon: Wallet,
    },
    {
      name: "Ahorros",
      href: "/ahorros",
      icon: PiggyBank,
    },
    {
      name: "Ajustes",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[90] bg-white/90 backdrop-blur-lg border-t border-slate-100 max-w-[500px] mx-auto">
      <div className="flex items-center justify-around py-3 px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 transition-all group ${
                isActive ? "text-nu-purple" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <div
                className={`p-2 rounded-2xl transition-all ${
                  isActive
                    ? "bg-nu-purple/10 text-nu-purple scale-105"
                    : "group-active:scale-95"
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-[10px] font-black tracking-tight ${isActive ? "text-nu-purple font-black" : "font-bold"}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
