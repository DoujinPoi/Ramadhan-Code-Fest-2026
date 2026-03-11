"use client";

import { useState, useMemo } from "react";
import { hill, hillDeterminant, toAlpha, CipherStep } from "@/lib/ciphers";

function gcd(a: number, b: number): number {
    while (b) { [a, b] = [b, a % b]; }
    return a;
}

type MatrixSize = 2 | 3 | 4 | 5;

const DEFAULT_MATRICES: Record<MatrixSize, number[]> = {
    2: [3, 3, 2, 5],
    3: [6, 24, 1, 13, 16, 10, 20, 17, 15],
    4: [3, 0, 0, 0, 0, 5, 0, 0, 0, 0, 7, 0, 0, 0, 0, 9],
    5: [3, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 9, 0, 0, 0, 0, 0, 11],
};

const GRID_COLS: Record<MatrixSize, string> = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
};

export default function HillScreen() {
    const [inputText, setInputText] = useState("");
    const [matrixSize, setMatrixSize] = useState<MatrixSize>(3);
    const [matrixValues, setMatrixValues] = useState<Record<MatrixSize, number[]>>({
        ...DEFAULT_MATRICES,
    });
    const [outputText, setOutputText] = useState("");
    const [steps, setSteps] = useState<CipherStep[]>([]);
    const [mode, setMode] = useState<"encrypt" | "decrypt">("encrypt");

    const currentMatrix = matrixValues[matrixSize];

    const det = useMemo(
        () => hillDeterminant(currentMatrix, matrixSize),
        [currentMatrix, matrixSize]
    );
    const isValid = gcd(det, 26) === 1;

    const rawDet = useMemo(() => {
        function detRaw(m: number[][]): number {
            const sz = m.length;
            if (sz === 1) return m[0][0];
            if (sz === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];
            let d = 0;
            for (let j = 0; j < sz; j++) {
                const minor = m.slice(1).map((row) => [
                    ...row.slice(0, j),
                    ...row.slice(j + 1),
                ]);
                d += (j % 2 === 0 ? 1 : -1) * m[0][j] * detRaw(minor);
            }
            return d;
        }
        const m = Array.from({ length: matrixSize }, (_, i) =>
            currentMatrix.slice(i * matrixSize, (i + 1) * matrixSize)
        );
        return detRaw(m);
    }, [currentMatrix, matrixSize]);

    function updateCell(i: number, val: string) {
        const v = Math.max(0, Math.min(25, parseInt(val) || 0));
        setMatrixValues((prev) => ({
            ...prev,
            [matrixSize]: prev[matrixSize].map((x, idx) => (idx === i ? v : x)),
        }));
    }

    function changeSize(newSize: MatrixSize) {
        setMatrixSize(newSize);
        setOutputText("");
        setSteps([]);
    }

    function resetMatrix() {
        setMatrixValues((prev) => ({
            ...prev,
            [matrixSize]: [...DEFAULT_MATRICES[matrixSize]],
        }));
    }

    function randomize() {
        const n = matrixSize;
        setMatrixValues((prev) => ({
            ...prev,
            [n]: Array.from({ length: n * n }, () => Math.floor(Math.random() * 26)),
        }));
    }

    function runCipher(m: "encrypt" | "decrypt" = mode) {
        try {
            const { result, steps: cipherSteps } = hill(inputText, currentMatrix, matrixSize, m);
            setOutputText(result);
            setSteps(cipherSteps);
        } catch (e: unknown) {
            setOutputText(`❌ Error: ${e instanceof Error ? e.message : String(e)}`);
            setSteps([]);
        }
    }

    const charCount = toAlpha(inputText).length;

    const SIZES: MatrixSize[] = [2, 3, 4, 5];

    return (
        <div className="w-full h-full aero-window flex flex-col shadow-[2px_10px_30px_rgba(0,0,0,0.5)] overflow-hidden">

            {/* Aero Title Bar */}
            <div className="aero-titlebar flex items-center justify-between px-3 py-1.5 select-none relative z-10">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-[#003366] drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">grid_4x4</span>
                    <span className="text-sm font-semibold text-[#000] drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)] tracking-wide">
                        Hill Cipher - Kripto Klasik
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
                        <h2 className="text-[#003399] font-semibold text-base mb-1">Hill Cipher Encryption Module</h2>
                        <p className="text-xs text-slate-700">
                            Enkripsi pesan menggunakan aljabar linear dan matriks modular. Membutuhkan matriks kunci yang invertibel modulo 26.
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
                                <span className="text-[11px] text-slate-500">
                                    {charCount} karakter
                                    {charCount % matrixSize !== 0 && charCount > 0 && ` → dipad ke ${charCount + (matrixSize - (charCount % matrixSize))} dengan 'X'`}
                                </span>
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
                                            name="hill-mode"
                                            checked={mode === "encrypt"}
                                            onChange={() => setMode("encrypt")}
                                            className="mt-0.5"
                                        />
                                        <span className="text-xs text-slate-800">Enkripsi</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="hill-mode"
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
                                disabled={!isValid && mode === "decrypt"}
                                className="aero-btn w-full sm:w-auto px-6 py-1.5 text-[13px] font-semibold flex items-center gap-2 min-w-[120px] justify-center disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    Log Pemrosesan Blok Matriks
                                </legend>
                                <div className="flex justify-between items-center mb-1.5 px-1">
                                    <span className="text-[10px] text-slate-500">
                                        Total {steps.length} operasi blok ({matrixSize} huruf).
                                    </span>
                                </div>
                                <div className="aero-inset bg-white overflow-y-auto overflow-x-auto flex-1 max-h-[250px]">
                                    <table className="w-full text-[11px] text-left border-collapse whitespace-nowrap">
                                        <thead className="bg-[linear-gradient(to_bottom,#f0f0f0_0%,#e0e0e0_100%)] sticky top-0 z-10 border-b border-[#a0a0a0] shadow-[0_1px_2px_rgba(0,0,0,0.1)] text-[#333]">
                                            <tr>
                                                <th className="px-2 py-1 font-semibold border-r border-[#c0c0c0] w-8">Blok</th>
                                                <th className="px-2 py-1 font-semibold border-r border-[#c0c0c0] text-center w-12">In</th>
                                                <th className="px-2 py-1 font-semibold border-r border-[#c0c0c0] text-center">Vektor In</th>
                                                <th className="px-2 py-1 font-semibold border-r border-[#c0c0c0] text-center w-12">Out</th>
                                                <th className="px-2 py-1 font-semibold border-r border-[#c0c0c0] text-center">Vektor Out</th>
                                                <th className="px-2 py-1 font-semibold">Perkalian Baris per Elemen</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {steps.map((step) => {
                                                return (
                                                    <tr key={step.i} className={`border-b border-[#f0f0f0] ${(step.i ?? 0) % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}`}>
                                                        <td className="px-2 py-1 border-r border-[#f0f0f0] font-mono text-slate-500">{step.i}</td>
                                                        <td className="px-2 py-1 border-r border-[#f0f0f0] text-center font-bold text-[#000] tracking-widest">{step.char}</td>
                                                        <td className="px-2 py-1 border-r border-[#f0f0f0] text-center text-slate-700 font-mono text-[10px]">{step.blockVec}</td>
                                                        <td className="px-2 py-1 border-r border-[#f0f0f0] text-center font-bold text-[#0033bb] tracking-widest">{step.outputChar}</td>
                                                        <td className="px-2 py-1 border-r border-[#f0f0f0] text-center text-slate-700 font-mono text-[10px]">{step.outVec}</td>
                                                        <td className="px-2 py-1 font-mono text-slate-600 truncate text-[10px]">{step.formula}</td>
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
                        <fieldset className="border border-[#b5b5b5] p-3 bg-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,1)] h-full">
                            <legend className="px-2 text-[13px] text-[#003399] font-semibold flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">tune</span>
                                Konfigurasi Matriks Kunci
                            </legend>

                            <div className="flex flex-col gap-4 mt-2">
                                {/* Size selector */}
                                <div className="flex items-center gap-2 justify-between border-b border-[#c0c0c0] pb-3">
                                    <span className="text-xs text-slate-800">Ukuran Matriks:</span>
                                    <div className="flex gap-1">
                                        {SIZES.map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => changeSize(s)}
                                                className={`px-2 py-0.5 text-[11px] font-semibold border rounded-sm transition-colors ${matrixSize === s
                                                    ? 'bg-[#003399] text-white border-[#002266]'
                                                    : 'bg-[#e0e0e0] text-slate-700 border-[#a0a0a0] hover:bg-[#d0d0d0]'
                                                    }`}
                                            >
                                                {s}x{s}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Matrix inputs */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-slate-800">Nilai Sel (0-25):</span>
                                        <div className="flex gap-1">
                                            <button onClick={resetMatrix} className="aero-btn px-2 py-0.5 text-[10px]">Reset</button>
                                            <button onClick={randomize} className="aero-btn px-2 py-0.5 text-[10px]">Acak</button>
                                        </div>
                                    </div>
                                    <div className="bg-[#e0eaf5] aero-inset p-4 flex justify-center items-center min-h-[180px]">
                                        <div className={`grid ${GRID_COLS[matrixSize]} gap-1`}>
                                            {currentMatrix.map((val, i) => (
                                                <input
                                                    key={`${matrixSize}-${i}`}
                                                    className="w-10 h-10 text-center text-[13px] font-mono font-bold bg-white border border-[#a0a0a0] focus:border-[#003399] focus:outline-none focus:bg-[#fafffb]"
                                                    max="25"
                                                    min="0"
                                                    type="number"
                                                    value={val}
                                                    onChange={(e) => updateCell(i, e.target.value)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Validation info */}
                                <div className={`mt-1 p-2 border ${isValid ? 'border-[#8ebf8e] bg-[#eaffea]' : 'border-[#bf8e8e] bg-[#ffeaea]'} text-[11px] flex items-start gap-2`}>
                                    <span className={`material-symbols-outlined text-[14px] ${isValid ? 'text-green-700' : 'text-red-700'}`}>
                                        {isValid ? 'check_circle' : 'error'}
                                    </span>
                                    <div className="flex flex-col flex-1">
                                        <span className={`font-semibold ${isValid ? 'text-green-800' : 'text-red-800'}`}>
                                            {isValid ? 'Matriks Invertibel (Valid)' : 'Matriks Tidak Dapat Diinvers!'}
                                        </span>
                                        <div className="grid grid-cols-2 mt-1 text-slate-600 gap-y-0.5">
                                            <span>Determinan: <b>{rawDet}</b></span>
                                            <span>Det mod 26: <b>{det}</b></span>
                                            <span className="col-span-2">GCD(Det, 26): <b>{gcd(det, 26)}</b> (Pasti 1)</span>
                                        </div>
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
