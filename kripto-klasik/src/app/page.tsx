"use client";

import { useState } from "react";
import { vigenere, toAlpha, CipherStep } from "@/lib/ciphers";

export default function VigenereScreen() {
  const [inputText, setInputText] = useState("");
  const [cipherKey, setCipherKey] = useState("");
  const [outputText, setOutputText] = useState("");
  const [steps, setSteps] = useState<CipherStep[]>([]);
  const [mode, setMode] = useState<"encrypt" | "decrypt">("encrypt");
  const [status, setStatus] = useState<"ready" | "ok" | "error">("ready");
  const [elapsed, setElapsed] = useState(0);

  function runCipher(m: "encrypt" | "decrypt" = mode) {
    const t0 = performance.now();
    try {
      const { result, steps: cipherSteps } = vigenere(inputText, cipherKey, mode);
      setOutputText(result);
      setSteps(cipherSteps);
      setStatus("ok");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutputText(`❌ Error: ${msg}`);
      setSteps([]);
      setStatus("error");
    }
    setElapsed(Math.round(performance.now() - t0));
  }

  function handleCopy() {
    if (outputText) navigator.clipboard.writeText(outputText);
  }

  const charCount = toAlpha(inputText).length;
  const lineCount = outputText ? Math.ceil(outputText.length / 60) : 5;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 5) }, (_, i) => i + 1);

  return (
    <div className="w-full h-full aero-window flex flex-col shadow-[2px_10px_30px_rgba(0,0,0,0.5)] overflow-hidden">

      {/* Aero Title Bar */}
      <div className="aero-titlebar flex items-center justify-between px-3 py-1.5 select-none relative z-10">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-[#003366] drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">verified_user</span>
          <span className="text-sm font-semibold text-[#000] drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)] tracking-wide">
            Vigenère Cipher - Kripto Klasik
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
            onClick={() => window.location.reload()}
            className="w-11 h-5 rounded-[4px] bg-[linear-gradient(to_bottom,#f4a4a4_0%,#e04343_45%,#c72222_50%,#bd1515_100%)] border border-[#a32222] hover:bg-[linear-gradient(to_bottom,#fbbebe_0%,#f05050_45%,#dd2f2f_50%,#d21e1e_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),_0_1px_2px_rgba(0,0,0,0.3)] flex items-center justify-center text-white text-[12px] font-bold transition-all ml-1"
            title="Reset"
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
            <h2 className="text-[#003399] font-semibold text-base mb-1">Vigenère Cipher Encryption Module</h2>
            <p className="text-xs text-slate-700">
              Metode enkripsi teks alfabetik dengan menggunakan serangkaian sandi Caesar berdasarkan huruf-huruf pada kata kunci.
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
                      name="vigenere-mode"
                      checked={mode === "encrypt"}
                      onChange={() => setMode("encrypt")}
                      className="mt-0.5"
                    />
                    <span className="text-xs text-slate-800">Enkripsi</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="vigenere-mode"
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
                  onClick={handleCopy}
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
                  Log Pemrosesan
                </legend>
                <div className="flex justify-between items-center mb-1.5 px-1">
                  <span className="text-[10px] text-slate-500">
                    Total {steps.length} operasi.
                  </span>
                </div>
                <div className="aero-inset bg-white overflow-y-auto overflow-x-auto flex-1 max-h-[250px]">
                  <table className="w-full text-[11px] text-left border-collapse whitespace-nowrap">
                    <thead className="bg-[linear-gradient(to_bottom,#f0f0f0_0%,#e0e0e0_100%)] sticky top-0 z-10 border-b border-[#a0a0a0] shadow-[0_1px_2px_rgba(0,0,0,0.1)] text-[#333]">
                      <tr>
                        <th className="px-2 py-1 font-semibold border-r border-[#c0c0c0] w-8">Idx</th>
                        <th className="px-2 py-1 font-semibold border-r border-[#c0c0c0] text-center w-12">In</th>
                        <th className="px-2 py-1 font-semibold border-r border-[#c0c0c0] text-center w-12">Kunci</th>
                        <th className="px-2 py-1 font-semibold border-r border-[#c0c0c0] text-center w-12">Out</th>
                        <th className="px-2 py-1 font-semibold">Formula Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {steps.map((step) => {
                        return (
                          <tr key={step.i} className={`border-b border-[#f0f0f0] ${(step.i ?? 0) % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}`}>
                            <td className="px-2 py-1 border-r border-[#f0f0f0] font-mono text-slate-500">{step.i}</td>
                            <td className="px-2 py-1 border-r border-[#f0f0f0] text-center font-bold text-[#000]">{step.char}</td>
                            <td className="px-2 py-1 border-r border-[#f0f0f0] text-center">
                              <span className="px-1 rounded text-[10px] font-bold border border-[#a0a0a0] bg-[#f0f0f0] text-slate-700">{step.keyChar}</span>
                            </td>
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
                <span className="material-symbols-outlined text-[14px]">tune</span>
                Konfigurasi Kunci
              </legend>

              <div className="flex flex-col gap-5 mt-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-slate-800">Kata Kunci (Hanya Alfabet):</span>
                  <div className="relative">
                    <input
                      className="w-full aero-inset py-1.5 pl-2 pr-8 text-[13px] text-slate-900 focus:outline-none focus:bg-[#fafffb]"
                      type="text"
                      placeholder="Contoh: SECRETKEY"
                      value={cipherKey}
                      onChange={(e) => setCipherKey(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                      <span className="material-symbols-outlined text-[16px]">vpn_key</span>
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 italic mt-0.5">
                    * Kunci harus berupa huruf A-Z tanpa spasi.
                  </p>
                </label>
              </div>
            </fieldset>
          </div>
        </div>

      </div>
    </div>
  );
}
