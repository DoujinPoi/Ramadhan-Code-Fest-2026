"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface SidebarLinkProps {
    href: string;
    label: string;
    onClick?: () => void;
}

const SidebarLink = ({ href, label, onClick }: SidebarLinkProps) => {
    const pathname = usePathname();
    const isActive = pathname === href;

    const baseClasses =
        "group flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-[3px] transition-all duration-100 border text-sm";

    // Win7 Explorer selection style (light blue gradient, soft border)
    const activeClasses =
        "bg-[linear-gradient(to_bottom,rgba(235,244,253,0.9)_0%,rgba(201,224,247,0.9)_100%)] text-[#004e98] border-[#84acdd] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]";
    const inactiveClasses =
        "text-slate-700 hover:bg-[linear-gradient(to_bottom,rgba(250,252,254,0.8)_0%,rgba(234,246,253,0.8)_100%)] hover:border-[#b8d6fb] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] border-transparent";

    return (
        <Link
            href={href}
            onClick={onClick}
            className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
        >
            <span>{label}</span>
        </Link>
    );
};

const Sidebar = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            {/* Mobile Toggle Button (Visible only on mobile) */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden fixed top-3 left-3 z-[60] p-1.5 flex items-center justify-center bg-[linear-gradient(to_bottom,rgba(255,255,255,0.8)_0%,rgba(235,244,253,0.9)_100%)] border border-[#84acdd] rounded-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),_0_2px_5px_rgba(0,0,0,0.2)] text-[#004e98] transition-all"
                aria-label="Toggle Sidebar"
            >
                <span className="material-symbols-outlined text-[20px]">{isOpen ? "close" : "menu"}</span>
            </button>

            {/* Overlay for mobile when sidebar is open */}
            {isOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-[40] transition-opacity"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <aside className={`
                fixed md:static inset-y-0 left-0 z-[50]
                transform ${isOpen ? "translate-x-0" : "-translate-x-full"} transition-transform duration-300 ease-in-out
                md:transform-none md:translate-x-0
                w-64 flex-shrink-0 flex flex-col bg-[rgba(240,245,255,0.95)] md:bg-[rgba(240,245,255,0.65)] backdrop-blur-xl border-r border-white/60 h-full overflow-y-auto shadow-[2px_0_15px_rgba(0,0,0,0.1)]
            `}>
                <div className="flex flex-col h-full p-4 pb-4">
                    {/* Add mt-14 on mobile to prevent overlap with the fixed toggle button */}
                    <div className="flex items-center gap-3 mb-6 px-2 mt-10 md:mt-0">
                        <div className="size-8 flex-shrink-0 flex items-center justify-center text-[#11689b]">
                            {/* Using a shield to represent crypto/security */}
                            <span className="material-symbols-outlined text-[32px] filled drop-shadow-sm">
                                shield
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-[#003366] text-lg font-bold leading-none tracking-tight drop-shadow-[0_1px_0_rgba(255,255,255,0.8)] whitespace-nowrap">
                                Kriptografi Klasik
                            </h1>
                        </div>
                    </div>

                    <nav className="flex flex-col gap-0.5 mt-2 overflow-y-auto pb-4">
                        <div className="flex px-2 py-1 mb-1 text-xs font-bold text-[#11689b] uppercase tracking-wider items-center gap-1 drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
                            <span className="material-symbols-outlined text-[14px]">folder_open</span>
                            Algorithms
                        </div>
                        <SidebarLink href="/" label="Vigenère Cipher" onClick={() => setIsOpen(false)} />
                        <SidebarLink href="/affine" label="Affine Cipher" onClick={() => setIsOpen(false)} />
                        <SidebarLink href="/playfair" label="Playfair Cipher" onClick={() => setIsOpen(false)} />
                        <SidebarLink href="/hill" label="Hill Cipher" onClick={() => setIsOpen(false)} />
                        <SidebarLink href="/enigma" label="Enigma Cipher" onClick={() => setIsOpen(false)} />
                    </nav>

                    <div className="flex mt-auto pt-6 px-2 justify-center md:justify-start">
                        <p className="text-[10px] text-slate-500 font-medium leading-tight text-center md:text-left">
                            created by Dzaki Eka Atmaja (21120123130068)
                        </p>
                    </div>
                </div>
            </aside>
        </>
    );
};
export default Sidebar;
