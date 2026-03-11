"use client";

import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="size-9 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-600 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
        >
            <span
                className="material-symbols-outlined text-[20px] transition-all duration-300"
                style={{ fontVariationSettings: "'FILL' 1" }}
            >
                {theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
        </button>
    );
}
