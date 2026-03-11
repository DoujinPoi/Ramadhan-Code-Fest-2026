"use client";

import { useState } from "react";
import { playfair, buildPlayfairMatrix, toAlpha, CipherStep } from "@/lib/ciphers";

export default function PlayfairScreen() {
    const [inputText, setInputText] = useState("");
    const [keyword, setKeyword] = useState("");
    const [outputText, setOutputText] = useState("");
    const [steps, setSteps] = useState<CipherStep[]>([]);
    const [mode, setMode] = useState<"encrypt" | "decrypt">("encrypt");

    const matrix = buildPlayfairMatrix(keyword || "A");

    function runCipher(m: "encrypt" | "decrypt" = mode) {
        try {
            const { result, steps: cipherSteps } = playfair(inputText, keyword, m);
            setOutputText(result);
            setSteps(cipherSteps);
        } catch (e: unknown) {
            setOutputText(`❌ Error: ${e instanceof Error ? e.message : String(e)}`);
            setSteps([]);
        }
    }

    const charCount = toAlpha(inputText).length;

    return (
        <div className="w-full h-full aero-window flex flex-col shadow-[2px_10px_30px_rgba(0,0,0,0.5)] overflow-hidden">

            {/* Aero Title Bar */}
            <div className="aero-titlebar flex items-center justify-between px-3 py-1.5 select-none relative z-10">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-[#003366] drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">grid_view</span>
                    <span className="text-sm font-semibold text-[#000] drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)] tracking-wide">
                        Playfair Cipher - Kripto Klasik
                    </span>
                </div>

                {/* Window Controls */}
                <div className="flex items-center gap-[2px] pr-1">
                    <button disabled className="w-8 h-5 rounded-[3px] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.4)_0%,rgba(255,255,255,0)_100%)] border border-white/40 flex items-center justify-center opacity-50 cursor-default">
                        <span className="w-2.5 h-[2px] bg-black/50 translate-y-[3px]"></span>
                    </button>
                    <button disabled className="w-8 h-5 rounded-[3px] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.4)_0%,rgba(255,255,255,0)_100%)] border border-white/40 flex items-center justify-center opacity-50 cursor-default">
                        <span className="w-2.5 h-2.5 border-2 border-black/50"></span>
                    </button>
                    <button
                        onClick={() => { setInputText(""); setOutputText(""); }}
                        className="w-11 h-5 rounded-[4px] bg-[linear-gradient(to_bottom,#f4a4a4_0%,#e04343_45%,#c72222_50%,#bd1515_100%)] border border-[#a32222] hover:bg-[linear-gradient(to_bottom,#fbbebe_0%,#f05050_45%,#dd2f2f_50%,#d21e1e_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),_0_1px_2px_rgba(0,0,0,0.3)] flex items-center justify-center text-white text-[12px] font-bold transition-all ml-1"
                        title="Bersihkan Teks"
                    >
                        <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] relative -top-[1px]">✕</span>
                    </button>
                </div>
            </div>

            {/* Window Content */}
            <div className="aero-content flex-1 p-5 bg-[#f0f0f0] flex flex-col gap-5 overflow-y-auto">

                {/* Top Info Area */}
                <div className="flex bg-white aero-inset p-4 gap-4 items-start">
                    <span className="material-symbols-outlined text-[32px] text-[#2c628b] drop-shadow-sm">info</span>
                    <div>
                        <h2 className="text-[#003399] font-semibold text-base mb-1">Playfair Cipher Encryption Module</h2>
                        <p className="text-xs text-slate-700">
                            Metode enkripsi digraph substitusi klasik yang menggunakan matriks 5×5 untuk mengamankan pesan Anda.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

                    {/* Left: Input + Output */}
                    <div className="lg:col-span-7 flex flex-col gap-4">

                        {/* Input Area */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-end">
                                <label className="text-[13px] text-slate-800">
                                    Input Teks:
                                </label>
                                <span className="text-[11px] text-slate-500">{charCount} karakter</span>
                            </div>
                            <textarea
                                className="w-full h-32 resize-y aero-inset p-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-[#fafffb]"
                                placeholder="Masukkan teks di sini..."
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                            />
                        </div>

                        {/* Controls */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-[#e0eaf5] aero-inset p-2.5 mt-1 gap-3 sm:gap-0">
                            <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
                                <span className="text-xs font-semibold text-[#003366]">Mode:</span>
                                <div className="flex gap-3">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="mode"
                                            checked={mode === "encrypt"}
                                            onChange={() => setMode("encrypt")}
                                            className="mt-0.5"
                                        />
                                        <span className="text-xs text-slate-800">Enkripsi</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="mode"
                                            checked={mode === "decrypt"}
                                            onChange={() => setMode("decrypt")}
                                            className="mt-0.5"
                                        />
                                        <span className="text-xs text-slate-800">Dekripsi</span>
                                    </label>
                                </div>
                            </div>

                            <button
                                onClick={() => runCipher()}
                                className="aero-btn w-full sm:w-auto px-6 py-1.5 text-[13px] font-semibold flex items-center gap-2 min-w-[120px] justify-center"
                            >
                                <span className="material-symbols-outlined text-[16px]">{mode === "encrypt" ? "lock" : "lock_open"}</span>
                                Jalankan
                            </button>
                        </div>

                        {/* Output Area */}
                        <div className="flex flex-col gap-1.5 mt-2">
                            <div className="flex justify-between items-end">
                                <label className="text-[13px] text-slate-800">
                                    Hasil Output:
                                </label>
                                <button
                                    onClick={() => outputText && navigator.clipboard.writeText(outputText)}
                                    className="aero-btn px-2 py-0.5 text-[11px] flex items-center gap-1"
                                >
                                    <span className="material-symbols-outlined text-[12px]">content_copy</span>
                                    Salin
                                </button>
                            </div>
                            <div className="w-full h-24 aero-inset p-2.5 text-[13px] text-slate-900 bg-white overflow-y-auto font-mono break-all leading-relaxed shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]">
                                {outputText ? (
                                    outputText
                                ) : (
                                    <span className="text-slate-400 italic font-sans text-[12px]">Hasil akan muncul di sini...</span>
                                )}
                            </div>
                        </div>

                        {/* Steps Table */}
                        {steps.length > 0 && (
                            <fieldset className="border border-[#b5b5b5] p-2 bg-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,1)] mt-2 flex flex-col flex-1 min-h-[250px]">
                                <legend className="px-2 text-[12px] text-[#003399] font-semibold flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">table_chart</span>
                                    Log Pemrosesan Diglifi
                                </legend>
                                <div className="flex justify-between items-center mb-1.5 px-1">
                                    <span className="text-[10px] text-slate-500">
                                        Total {steps.length} operasi digraf.
                                    </span>
                                </div>
                                <div className="aero-inset bg-white overflow-y-auto overflow-x-auto flex-1 max-h-[250px]">
                                    <table className="w-full text-[11px] text-left border-collapse whitespace-nowrap">
                                        <thead className="bg-[linear-gradient(to_bottom,#f0f0f0_0%,#e0e0e0_100%)] sticky top-0 z-10 border-b border-[#a0a0a0] shadow-[0_1px_2px_rgba(0,0,0,0.1)] text-[#333]">
                                            <tr>
                                                <th className="px-2 py-1 font-semibold border-r border-[#c0c0c0] w-8">Idx</th>
                                                <th className="px-2 py-1 font-semibold border-r border-[#c0c0c0] text-center w-12">In</th>
                                                <th className="px-2 py-1 font-semibold border-r border-[#c0c0c0] text-center w-12">Out</th>
                                                <th className="px-2 py-1 font-semibold">Aturan</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {steps.map((step) => {
                                                return (
                                                    <tr key={step.i} className={`border-b border-[#f0f0f0] ${(step.i ?? 0) % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}`}>
                                                        <td className="px-2 py-1 border-r border-[#f0f0f0] font-mono text-slate-500">{step.i}</td>
                                                        <td className="px-2 py-1 border-r border-[#f0f0f0] text-center font-bold text-[#000]">{step.char}</td>
                                                        <td className="px-2 py-1 border-r border-[#f0f0f0] text-center font-bold text-[#0033bb]">{step.outputChar}</td>
                                                        <td className="px-2 py-1 font-mono text-slate-600 truncate">{step.formula}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </fieldset>
                        )}

                    </div>

                    {/* Right: config */}
                    <div className="lg:col-span-5 flex flex-col gap-4 pb-4 lg:pb-0">
                        <fieldset className="border border-[#b5b5b5] p-4 bg-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,1)]">
                            <legend className="px-2 text-[13px] text-[#003399] font-semibold flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">settings</span>
                                Konfigurasi Kunci
                            </legend>

                            <div className="flex flex-col gap-5 mt-2">
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-xs text-slate-800">Kata Kunci (Keyword):</span>
                                    <div className="relative">
                                        <input
                                            className="w-full aero-inset py-1.5 pl-2 pr-8 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-[#fafffb]"
                                            type="text"
                                            value={keyword}
                                            placeholder="SECRET KEY"
                                            onChange={(e) => setKeyword(e.target.value.toUpperCase())}
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                                            <span className="material-symbols-outlined text-[16px]">vpn_key</span>
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 italic mt-0.5">
                                        * Huruf &apos;J&apos; digabungkan dengan &apos;I&apos;.
                                    </p>
                                </label>

                                <div className="border-t border-[#d5d5d5] shadow-[0_1px_0_rgba(255,255,255,0.8)]" />

                                <div className="flex flex-col gap-2">
                                    <span className="text-xs text-slate-800 font-semibold mb-1">Matriks Playfair (5×5):</span>
                                    <div className="grid grid-cols-5 gap-[1px] bg-[#a0a0a0] p-[1px] shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)] mx-auto w-fit">
                                        {matrix.map((char, index) => (
                                            <div
                                                key={index}
                                                className={`size-9 flex items-center justify-center font-bold text-[13px] font-mono ${char === 'I'
                                                    ? 'bg-[linear-gradient(to_bottom,#d1e8ff_0%,#a8d1ff_100%)] text-[#003366] text-[10px]'
                                                    : 'bg-[linear-gradient(to_bottom,#fafafa_0%,#e5e5e5_100%)] text-slate-800'
                                                    }`}
                                            >
                                                {char === 'I' ? 'I/J' : char}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </fieldset>
                    </div>
                </div>

            </div>
        </div>
    );
}
