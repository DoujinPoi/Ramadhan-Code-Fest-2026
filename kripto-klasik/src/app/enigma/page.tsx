"use client";

import { useState } from "react";
import {
    customEnigma,
    generateRandomKeys,
    isValidForAlphabet
} from "@/lib/ciphers";

// Default keys: Rotor I, II, III wirings from classic Enigma (valid A-Z permutations)
const DEFAULT_KEYS = [
    "EKMFLGDQVZNTOWYHXUSPAIBRCJ",
    "AJDKSIRUXBLHWTMCQGZNPYFVOE",
    "BDFHJLCPRTXVZNYEIWGAKMUSQO",
];

// Removed KEY_COLORS to simplify styling

const MAX_TABLE_ROWS = 40;

interface Step {
    i: number;
    rotorPos: number;
    inputChar: string;
    outputChar: string;
    formula: string;
}

function shuffleAlphaArray(len: number): string[] {
    const arr = Array.from({ length: len }, (_, i) => String.fromCharCode(65 + i));
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export default function EnigmaScreen() {
    const [inputText, setInputText] = useState("");
    const [mode, setMode] = useState<"encrypt" | "decrypt">("encrypt");
    const [outputText, setOutputText] = useState("");
    const [steps, setSteps] = useState<Step[]>([]);
    const [error, setError] = useState("");

    // --- New Enigma State ---
    const [enigmaRotorCount, setEnigmaRotorCount] = useState<3 | 4 | 5 | 6 | 7 | 8 | 9 | 10>(3);
    const [enigmaStartPosition, setEnigmaStartPosition] = useState(0);
    const [enigmaAlphabetLength, setEnigmaAlphabetLength] = useState(5); // Default 5
    const [enigmaKeys, setEnigmaKeys] = useState<{ [key: string]: string[] }>(
        () => generateRandomKeys(3, 5)
    );
    const [enigmaKeyMode, setEnigmaKeyMode] = useState<'random' | 'manual'>('manual');

    // Using simple strings for manual keys in UI 
    const [manualKeyStrings, setManualKeyStrings] = useState<{ [key: string]: string }>({});

    /* ── Key management ── */
    function handleRotorCountChange(count: number) {
        if (count >= 3 && count <= 10) {
            setEnigmaRotorCount(count as 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10);
            setEnigmaStartPosition(0);
            if (enigmaKeyMode === 'random') {
                setEnigmaKeys(generateRandomKeys(count, enigmaAlphabetLength));
            } else {
                const newKeys: { [key: string]: string[] } = {};
                for (let i = 0; i < count; i++) {
                    newKeys[`K${i}`] = enigmaKeys[`K${i}`] || shuffleAlphaArray(enigmaAlphabetLength);
                }
                setEnigmaKeys(newKeys);
            }
        }
    }

    function handleAlphabetLengthChange(len: number) {
        if (len >= 5 && len <= 26) {
            setEnigmaAlphabetLength(len);
            // When alphabet length changes, all keys must be regenerated or adjusted
            setEnigmaKeys(generateRandomKeys(enigmaRotorCount, len));
            setEnigmaKeyMode('random'); // Force random mode as manual keys would be invalid
        }
    }

    function randomizeAllKeys() {
        setEnigmaKeys(generateRandomKeys(enigmaRotorCount, enigmaAlphabetLength));
        setEnigmaKeyMode('random');
    }

    function addKey() {
        if (enigmaRotorCount >= 10) return;
        const newCount = enigmaRotorCount + 1;
        setEnigmaRotorCount(newCount as 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10);
        setEnigmaKeys(prev => ({
            ...prev,
            [`K${newCount - 1}`]: shuffleAlphaArray(enigmaAlphabetLength)
        }));
        setEnigmaKeyMode('manual');
    }

    function removeKey(idx: number) {
        if (enigmaRotorCount <= 3) return; // Keep at least 3
        const newCount = enigmaRotorCount - 1;

        const newKeys: { [key: string]: string[] } = {};
        let currIdx = 0;
        for (let i = 0; i < enigmaRotorCount; i++) {
            if (i === idx) continue;
            newKeys[`K${currIdx}`] = enigmaKeys[`K${i}`];
            currIdx++;
        }

        setEnigmaRotorCount(newCount as 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10);
        setEnigmaKeys(newKeys);
        if (enigmaStartPosition >= newCount) setEnigmaStartPosition(0);
        setSteps([]); setOutputText("");
        setEnigmaKeyMode('manual');
    }

    function updateKey(idx: number, val: string) {
        const upper = val.toUpperCase().replace(/[^A-Z]/g, "").slice(0, enigmaAlphabetLength).split("");
        setEnigmaKeys((prev) => ({
            ...prev,
            [`K${idx}`]: upper
        }));
        setEnigmaKeyMode('manual');
    }

    function randomizeKey(idx: number) {
        setEnigmaKeys((prev) => ({
            ...prev,
            [`K${idx}`]: shuffleAlphaArray(enigmaAlphabetLength)
        }));
        setEnigmaKeyMode('manual');
    }

    function isKeyValid(keyArray: string[]) {
        if (!keyArray) return false;
        const k = keyArray.join("");
        // Check length and if all characters are within the alphabet range
        if (k.length !== enigmaAlphabetLength) return false;
        const alphabetChars = Array.from({ length: enigmaAlphabetLength }, (_, i) => String.fromCharCode(65 + i));
        const keyChars = k.split('');

        // Check if all characters in keyChars are within alphabetChars
        for (const char of keyChars) {
            if (!alphabetChars.includes(char)) {
                return false;
            }
        }

        // Check for duplicates
        return new Set(keyChars).size === enigmaAlphabetLength;
    }

    /* ── Cipher ── */
    function runCipher(m: "encrypt" | "decrypt" = mode) {
        setError("");
        try {
            if (!isValidForAlphabet(inputText, enigmaAlphabetLength)) {
                const maxLetter = String.fromCharCode(64 + enigmaAlphabetLength);
                throw new Error(`Input contains characters outside the ${enigmaAlphabetLength}-letter alphabet (A-${maxLetter})`);
            }
            // Ensure all keys are valid
            for (let i = 0; i < enigmaRotorCount; i++) {
                if (!isKeyValid(enigmaKeys[`K${i}`])) {
                    throw new Error(`K${i}: kunci harus merupakan permutasi valid dari ${enigmaAlphabetLength} huruf (A-${String.fromCharCode(64 + enigmaAlphabetLength)})`);
                }
            }

            const { result, steps: cipherSteps } = customEnigma(
                inputText,
                enigmaRotorCount,
                enigmaStartPosition,
                enigmaKeys,
                enigmaAlphabetLength,
                m
            );
            setOutputText(result);
            setSteps(cipherSteps);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
            setOutputText(""); setSteps([]);
        }
    }

    /* ── Helpers ── */
    const cleanInput = inputText.toUpperCase().replace(/[^A-Z]/g, "");
    const charCount = cleanInput.length;
    const maxLetter = String.fromCharCode(64 + enigmaAlphabetLength);


    return (
        <div className="w-full h-full aero-window flex flex-col shadow-[2px_10px_30px_rgba(0,0,0,0.5)] overflow-hidden">

            {/* Aero Title Bar */}
            <div className="aero-titlebar flex items-center justify-between px-3 py-1.5 select-none relative z-10">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-[#003366] drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">settings_b_roll</span>
                    <span className="text-sm font-semibold text-[#000] drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)] tracking-wide">
                        Enigma Cipher Machine - Kripto Klasik
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
                        <h2 className="text-[#003399] font-semibold text-base mb-1">Enigma Machine Emulator</h2>
                        <p className="text-xs text-slate-700">
                            Simulasi mesin rotor edukatif dengan alfabet custom. Rotor berputar setiap karakter sehingga kunci substitusi berubah secara siklik.
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-2 bg-[#ffeaea] border border-[#bf8e8e] text-[#a00] text-[11px] shadow-[#fff_0_1px_0]">
                        <span className="material-symbols-outlined text-[16px]">error</span>
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

                    {/* Left: Input + Output + Steps */}
                    <div className="lg:col-span-7 flex flex-col gap-4">

                        {/* Input Area */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-end">
                                <label className="text-[13px] text-slate-800 font-semibold">
                                    Input Teks:
                                </label>
                                <span className="text-[11px] text-slate-500 font-semibold">{charCount} karakter</span>
                            </div>
                            <textarea
                                className="w-full h-24 resize-y aero-inset p-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-[#fafffb] font-mono"
                                placeholder={`Masukkan teks yang akan diproses (A-${maxLetter})...`}
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                            />
                        </div>

                        {/* Controls */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-[#e0eaf5] aero-inset p-2.5 mt-1 border border-[#b0b0b0] gap-3 sm:gap-0">
                            <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
                                <span className="text-xs font-semibold text-[#003366]">Mode:</span>
                                <div className="flex gap-3">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="enigma-mode"
                                            checked={mode === "encrypt"}
                                            onChange={() => setMode("encrypt")}
                                            className="mt-0.5"
                                        />
                                        <span className="text-[12px] text-slate-800">Enkripsi</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="enigma-mode"
                                            checked={mode === "decrypt"}
                                            onChange={() => setMode("decrypt")}
                                            className="mt-0.5"
                                        />
                                        <span className="text-[12px] text-slate-800">Dekripsi</span>
                                    </label>
                                </div>
                            </div>

                            <button
                                onClick={() => runCipher()}
                                className="aero-btn w-full sm:w-auto px-6 py-1.5 text-[13px] font-semibold flex items-center gap-2 min-w-[120px] justify-center"
                            >
                                <span className="material-symbols-outlined text-[16px]">{mode === "encrypt" ? "lock" : "lock_open"}</span>
                                Proses
                            </button>
                        </div>

                        {/* Output Area */}
                        <div className="flex flex-col gap-1.5 mt-2">
                            <div className="flex justify-between items-end">
                                <label className="text-[13px] text-slate-800 font-semibold">
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
                            <div className="w-full h-24 aero-inset p-2.5 text-[13px] text-[#000] bg-white overflow-y-auto font-mono break-all leading-relaxed shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]">
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
                                        {steps.length > MAX_TABLE_ROWS ? `Menampilkan ${MAX_TABLE_ROWS} baris awal.` : `Total ${steps.length} operasi.`}
                                    </span>
                                </div>
                                <div className="aero-inset bg-white overflow-y-auto overflow-x-auto flex-1 h-[250px]">
                                    <table className="w-full text-[11px] text-left border-collapse whitespace-nowrap">
                                        <thead className="bg-[linear-gradient(to_bottom,#f0f0f0_0%,#e0e0e0_100%)] sticky top-0 z-10 border-b border-[#a0a0a0] shadow-[0_1px_2px_rgba(0,0,0,0.1)] text-[#333]">
                                            <tr>
                                                <th className="px-2 py-1 font-semibold border-r border-[#c0c0c0] w-8">Idx</th>
                                                <th className="px-2 py-1 font-semibold border-r border-[#c0c0c0]">Pos Rotor</th>
                                                <th className="px-2 py-1 font-semibold border-r border-[#c0c0c0] text-center w-12">In</th>
                                                <th className="px-2 py-1 font-semibold border-r border-[#c0c0c0] text-center w-12">Kunci</th>
                                                <th className="px-2 py-1 font-semibold border-r border-[#c0c0c0] text-center w-12">Out</th>
                                                <th className="px-2 py-1 font-semibold">Formula Detail</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {steps.slice(0, MAX_TABLE_ROWS).map((step) => {
                                                return (
                                                    <tr key={step.i} className={`border-b border-[#f0f0f0] ${step.i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}`}>
                                                        <td className="px-2 py-1 border-r border-[#f0f0f0] font-mono text-slate-500">{step.i}</td>
                                                        <td className="px-2 py-1 border-r border-[#f0f0f0] font-mono">{step.rotorPos}</td>
                                                        <td className="px-2 py-1 border-r border-[#f0f0f0] text-center font-bold text-[#000]">{step.inputChar}</td>
                                                        <td className="px-2 py-1 border-r border-[#f0f0f0] text-center">
                                                            <span className="px-1 rounded text-[9px] font-bold border border-[#a0a0a0] bg-[#f0f0f0] text-slate-700">{`K${step.rotorPos}`}</span>
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
                        <fieldset className="border border-[#b5b5b5] p-3 bg-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,1)] flex flex-col h-full">
                            <legend className="px-2 text-[13px] text-[#003399] font-semibold flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">tune</span>
                                Penyeteman Rotor
                            </legend>

                            <div className="flex flex-col gap-5 mt-2 flex-1">

                                {/* Alfabet properties */}
                                <div className="grid grid-cols-2 gap-4">
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-[11px] text-[#333] font-semibold">Panjang Alfabet:</span>
                                        <div className="flex gap-2 items-center">
                                            <input
                                                className="w-14 aero-inset py-[3px] px-1 text-[13px] text-center text-slate-900 focus:outline-none focus:bg-[#fafffb] border border-[#a0a0a0]"
                                                type="number" max="26" min="5"
                                                value={enigmaAlphabetLength}
                                                onChange={(e) => {
                                                    const v = Math.max(5, Math.min(26, parseInt(e.target.value) || 5));
                                                    handleAlphabetLengthChange(v);
                                                }}
                                            />
                                            <span className="text-[10px] text-slate-600 font-semibold">→ A hingga {maxLetter}</span>
                                        </div>
                                    </label>

                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-[11px] text-[#333] font-semibold">Posisi Awal (K):</span>
                                        <div className="flex gap-2 items-center">
                                            <input
                                                className="w-14 aero-inset py-[3px] px-1 text-[13px] text-center text-slate-900 focus:outline-none focus:bg-[#fafffb] border border-[#a0a0a0]"
                                                type="number" max={enigmaRotorCount - 1} min="0"
                                                value={enigmaStartPosition}
                                                onChange={(e) => {
                                                    const v = Math.max(0, Math.min(enigmaRotorCount - 1, parseInt(e.target.value) || 0));
                                                    setEnigmaStartPosition(v);
                                                }}
                                            />
                                            <span className="text-[10px] text-slate-600 font-semibold">Max: K{enigmaRotorCount - 1}</span>
                                        </div>
                                    </label>
                                </div>



                                {/* Rotor Setup */}
                                <div className="flex flex-col gap-2 flex-1">
                                    <div className="flex items-center justify-between border-b border-[#a0a0a0] pb-2">
                                        <span className="text-[12px] font-semibold text-[#000]">
                                            Daftar Kunci ({enigmaRotorCount})
                                        </span>
                                        <div className="flex gap-1.5">
                                            <button onClick={randomizeAllKeys} className="aero-btn px-2 py-0.5 text-[10px]">Acak Semua</button>
                                            <button onClick={addKey} disabled={enigmaRotorCount >= 10} className="aero-btn px-2 py-0.5 text-[10px] disabled:opacity-50">+ Tambah</button>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2.5 overflow-y-auto pr-1 flex-1 max-h-[320px]">
                                        {Array.from({ length: enigmaRotorCount }).map((_, i) => {
                                            const keyArray = enigmaKeys[`K${i}`] || [];
                                            const keyStr = keyArray.join("");
                                            const valid = isKeyValid(keyArray);
                                            const isStartPos = i === enigmaStartPosition;

                                            return (
                                                <div key={i} className={`flex border ${isStartPos ? 'border-[#0055cc]' : 'border-[#a0a0a0]'} bg-white text-[11px] shadow-sm`}>
                                                    {/* Badge Left */}
                                                    <div className={`w-10 flex flex-col items-center justify-center border-r border-[#a0a0a0] font-bold shadow-[inset_-1px_0_0_rgba(0,0,0,0.1)] gap-0.5 ${isStartPos ? 'bg-[#d1e8ff] text-[#003366]' : 'bg-[#f0f0f0] text-slate-700'}`}>
                                                        <span>K{i}</span>
                                                        {isStartPos && <span className="text-[7px] bg-[#0055cc] text-white px-1 py-[1px] rounded-[2px] uppercase tracking-wider leading-none shadow-sm">Start</span>}
                                                    </div>

                                                    <div className="flex-1 flex flex-col relative">
                                                        <input
                                                            className={`w-full bg-white px-2 py-1.5 font-mono text-[12px] tracking-[0.2em] text-[#000] focus:outline-none focus:bg-[#fafffb] ${!valid ? 'bg-[#fff0f0] text-[#800]' : ''}`}
                                                            maxLength={enigmaAlphabetLength}
                                                            placeholder={`${enigmaAlphabetLength} huruf A-${maxLetter}`}
                                                            type="text"
                                                            value={keyStr}
                                                            onChange={(e) => updateKey(i, e.target.value)}
                                                        />

                                                        {/* Status & Options below input */}
                                                        <div className="flex items-center justify-between px-2 py-1 bg-[linear-gradient(to_bottom,#f8f8f8_0%,#e8e8e8_100%)] border-t border-[#e0e0e0] text-[9px]">
                                                            <div className={`font-semibold ${valid ? "text-[green]" : "text-[red]"}`}>
                                                                {keyStr.length}/{enigmaAlphabetLength}
                                                                {valid ? " (Valid)" : " (Invalid)"}
                                                            </div>
                                                            <div className="flex gap-2.5">
                                                                <button onClick={() => randomizeKey(i)} className="text-[#0033cc] hover:underline font-semibold">Acak</button>
                                                                {enigmaRotorCount > 3 && (
                                                                    <button onClick={() => removeKey(i)} className="text-[#cc0000] hover:underline font-semibold">Hapus</button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
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
