// src/lib/ciphers.ts
// Pure cryptography utility functions for classical ciphers.
// All functions: ignore non-alpha, convert to UPPERCASE, only process A-Z.

// ============================================================
//  SHARED UTILITIES
// ============================================================

export function toAlpha(text: string): string {
    return text.toUpperCase().replace(/[^A-Z]/g, "");
}

function posMod(n: number, m: number): number {
    return ((n % m) + m) % m;
}

function gcd(a: number, b: number): number {
    while (b) {
        [a, b] = [b, a % b];
    }
    return a;
}

function modInverse(a: number, m: number): number {
    a = posMod(a, m);
    for (let x = 1; x < m; x++) {
        if ((a * x) % m === 1) return x;
    }
    throw new Error(`Tidak ada invers modular untuk a=${a} mod ${m}`);
}

export type CipherStep = {
    i?: number;
    char?: string;
    keyChar?: string;
    outputChar?: string;
    formula?: string;
    [key: string]: any; // Allow flexibility for different ciphers
};

// ============================================================
//  VIGENERE CIPHER
//  Encrypt: C = (P + K) mod 26
//  Decrypt: P = (C - K + 26) mod 26
// ============================================================

export function vigenere(
    text: string,
    key: string,
    mode: "encrypt" | "decrypt"
): { result: string; steps: CipherStep[] } {
    const clean = toAlpha(text);
    const cleanKey = toAlpha(key);
    if (!cleanKey) throw new Error("Kunci tidak boleh kosong");

    let result = "";
    const steps: CipherStep[] = [];
    const len = cleanKey.length;
    for (let i = 0; i < clean.length; i++) {
        const p = clean.charCodeAt(i) - 65;
        const keyChar = cleanKey[i % len];
        const k = keyChar.charCodeAt(0) - 65;
        const c = mode === "encrypt" ? posMod(p + k, 26) : posMod(p - k, 26);
        const outChar = String.fromCharCode(c + 65);
        result += outChar;

        steps.push({
            i: i + 1,
            char: clean[i],
            keyChar: keyChar,
            outputChar: outChar,
            formula: mode === "encrypt"
                ? `(${p} + ${k}) mod 26 = ${c}`
                : `(${p} - ${k}) mod 26 = ${c}`
        });
    }
    return { result, steps };
}

// ============================================================
//  AFFINE CIPHER
//  Encrypt: C = (a*P + b) mod 26
//  Decrypt: P = a⁻¹ * (C - b) mod 26
// ============================================================

export function affine(
    text: string,
    a: number,
    b: number,
    mode: "encrypt" | "decrypt"
): { result: string; steps: CipherStep[] } {
    if (gcd(a, 26) !== 1) {
        throw new Error(
            `Nilai a=${a} tidak koprim dengan 26. Nilai valid: 1,3,5,7,9,11,15,17,19,21,23,25`
        );
    }
    const clean = toAlpha(text);
    const aInv = modInverse(a, 26);

    let result = "";
    const steps: CipherStep[] = [];
    for (let i = 0; i < clean.length; i++) {
        const p = clean.charCodeAt(i) - 65;
        const c =
            mode === "encrypt"
                ? posMod(a * p + b, 26)
                : posMod(aInv * (p - b), 26);
        const outChar = String.fromCharCode(c + 65);
        result += outChar;

        steps.push({
            i: i + 1,
            char: clean[i],
            outputChar: outChar,
            formula: mode === "encrypt"
                ? `(${a}*${p} + ${b}) mod 26 = ${c}`
                : `${aInv}*(${p} - ${b}) mod 26 = ${c}`
        });
    }
    return { result, steps };
}

// ============================================================
//  PLAYFAIR CIPHER
// ============================================================

/** Returns flat 25-char array for the 5x5 Playfair matrix (J merged with I) */
export function buildPlayfairMatrix(keyword: string): string[] {
    const seen = new Set<string>();
    const chars: string[] = [];

    for (const ch of toAlpha(keyword)) {
        const c = ch === "J" ? "I" : ch;
        if (!seen.has(c)) {
            seen.add(c);
            chars.push(c);
        }
    }
    for (let i = 0; i < 26; i++) {
        const ch = String.fromCharCode(65 + i);
        if (ch === "J") continue;
        if (!seen.has(ch)) {
            seen.add(ch);
            chars.push(ch);
        }
    }
    return chars; // always exactly 25 chars
}

function matrixPos(matrix: string[], ch: string): [number, number] {
    const c = ch === "J" ? "I" : ch;
    const idx = matrix.indexOf(c);
    if (idx === -1) throw new Error(`Karakter '${ch}' tidak ditemukan di matriks`);
    return [Math.floor(idx / 5), idx % 5];
}

function prepareDigraphs(text: string): string[] {
    const clean = toAlpha(text).replace(/J/g, "I").split("");
    const digraphs: string[] = [];
    let i = 0;
    while (i < clean.length) {
        const a = clean[i];
        let b = clean[i + 1];
        if (b === undefined) {
            b = "X";
            i++;
        } else if (a === b) {
            b = "X";
            i++;
        } else {
            i += 2;
        }
        digraphs.push(a + b);
    }
    return digraphs;
}

export function playfair(
    text: string,
    keyword: string,
    mode: "encrypt" | "decrypt"
): { result: string; steps: CipherStep[] } {
    if (!toAlpha(keyword)) throw new Error("Kata kunci tidak boleh kosong");
    const matrix = buildPlayfairMatrix(keyword);
    const digraphs = prepareDigraphs(text);
    const dir = mode === "encrypt" ? 1 : -1;

    let result = "";
    const steps: CipherStep[] = [];
    for (let i = 0; i < digraphs.length; i++) {
        const pair = digraphs[i];
        const [r1, c1] = matrixPos(matrix, pair[0]);
        const [r2, c2] = matrixPos(matrix, pair[1]);
        let outPair = "";
        let formula = "";

        if (r1 === r2) {
            // Same row: shift columns
            outPair = matrix[r1 * 5 + posMod(c1 + dir, 5)] +
                matrix[r2 * 5 + posMod(c2 + dir, 5)];
            formula = `Baris sama (Baris ${r1 + 1}), Shift Kolom ${dir > 0 ? 'Kanan' : 'Kiri'}`;
        } else if (c1 === c2) {
            // Same column: shift rows
            outPair = matrix[posMod(r1 + dir, 5) * 5 + c1] +
                matrix[posMod(r2 + dir, 5) * 5 + c2];
            formula = `Kolom sama (Kolom ${c1 + 1}), Shift Baris ${dir > 0 ? 'Bawah' : 'Atas'}`;
        } else {
            // Rectangle: swap columns
            outPair = matrix[r1 * 5 + c2] + matrix[r2 * 5 + c1];
            formula = `Segi empat, Swap Kolom: [${r1 + 1},${c1 + 1}] & [${r2 + 1},${c2 + 1}]`;
        }
        result += outPair;

        steps.push({
            i: i + 1,
            char: pair,
            outputChar: outPair,
            formula: formula
        });
    }
    return { result, steps };
}

// ============================================================
//  HILL CIPHER — N×N (supports 2, 3, 4, 5)
// ============================================================

/** Recursive Laplace expansion determinant (exact integer) */
function detNxN(m: number[][]): number {
    const n = m.length;
    if (n === 1) return m[0][0];
    if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];
    let d = 0;
    for (let j = 0; j < n; j++) {
        const minor = m
            .slice(1)
            .map((row) => [...row.slice(0, j), ...row.slice(j + 1)]);
        d += (j % 2 === 0 ? 1 : -1) * m[0][j] * detNxN(minor);
    }
    return d;
}

/** Classical adjugate: adj[i][j] = (-1)^(i+j) * det(minor_ji) */
function adjugateNxN(m: number[][]): number[][] {
    const n = m.length;
    return Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => {
            const minor = m
                .filter((_, r) => r !== j)
                .map((row) => row.filter((_, c) => c !== i));
            return ((i + j) % 2 === 0 ? 1 : -1) * detNxN(minor);
        })
    );
}

function matVecMulN(m: number[][], v: number[]): number[] {
    return m.map((row) =>
        posMod(
            row.reduce((sum, val, j) => sum + val * v[j], 0),
            26
        )
    );
}

/** Compute determinant mod 26 for UI display */
export function hillDeterminant(flatKey: number[], n: number): number {
    const m = Array.from({ length: n }, (_, i) =>
        flatKey.slice(i * n, (i + 1) * n)
    );
    return posMod(detNxN(m), 26);
}

export function hill(
    text: string,
    flatKey: number[],
    n: number,
    mode: "encrypt" | "decrypt"
): { result: string; steps: CipherStep[] } {
    if (flatKey.length !== n * n)
        throw new Error(`Kunci harus berisi ${n * n} nilai untuk matriks ${n}×${n}`);

    const m = Array.from({ length: n }, (_, i) =>
        flatKey.slice(i * n, (i + 1) * n)
    );

    const det = posMod(detNxN(m), 26);
    if (gcd(det, 26) !== 1) {
        throw new Error(
            `Determinan (det mod 26 = ${det}) tidak koprim dengan 26. Matriks tidak invertibel!`
        );
    }

    let keyMatrix = m;
    if (mode === "decrypt") {
        const detInv = modInverse(det, 26);
        keyMatrix = adjugateNxN(m).map((row) =>
            row.map((v) => posMod(v * detInv, 26))
        );
    }

    let clean = toAlpha(text);
    if (!clean) throw new Error("Teks input tidak boleh kosong");
    while (clean.length % n !== 0) clean += "X";

    let result = "";
    const steps: CipherStep[] = [];

    // Function to calculate and stringify block multiplication
    function getFormula(block: number[], enc: number[], kMat: number[][]) {
        return enc.map((e, rIdx) => {
            const rowCalc = block.map((v, cIdx) => `${kMat[rIdx][cIdx]}*${v}`).join(" + ");
            return `(${rowCalc}) mod 26 = ${e}`;
        }).join(" | ");
    }

    for (let i = 0; i < clean.length; i += n) {
        const block = Array.from({ length: n }, (_, j) => clean.charCodeAt(i + j) - 65);
        const enc = matVecMulN(keyMatrix, block);
        const inStr = clean.slice(i, i + n);
        const outStr = enc.map((x) => String.fromCharCode(x + 65)).join("");
        result += outStr;

        steps.push({
            i: (i / n) + 1,
            char: inStr,
            outputChar: outStr,
            formula: getFormula(block, enc, keyMatrix),
            blockVec: `[${block.join(', ')}]`,
            outVec: `[${enc.join(', ')}]`
        });
    }
    return { result, steps };
}

// ============================================================
//  ENIGMA M3 CIPHER
//  Reciprocal: same function encrypts and decrypts
// ============================================================

const ROTOR_WIRINGS: Record<string, string> = {
    I: "EKMFLGDQVZNTOWYHXUSPAIBRCJ",
    II: "AJDKSIRUXBLHWTMCQGZNPYFVOE",
    III: "BDFHJLCPRTXVZNYEIWGAKMUSQO",
    IV: "ESOVPZJAYQUIRHXLNFTGKDCMWB",
    V: "VZBRGITYUPSDNHLXAWMJQOFECK",
};

/** Notch position (0-based): when rotor shows this letter, next rotor steps */
const ROTOR_NOTCH: Record<string, number> = {
    I: 16, // Q → R
    II: 4,  // E → F
    III: 21, // V → W
    IV: 9,  // J → K
    V: 25, // Z → A
};

const REFLECTOR_WIRINGS: Record<string, string> = {
    B: "YRUHQSLDPXNGOKMIEBFZCWVJAT",
    C: "FVPJIAOYEDRZXWGCTKUQSBNMHL",
};

function rotorForward(wiring: string, signal: number, pos: number): number {
    return posMod(wiring.charCodeAt(posMod(signal + pos, 26)) - 65 - pos, 26);
}

function rotorBackward(wiring: string, signal: number, pos: number): number {
    const target = String.fromCharCode(65 + posMod(signal + pos, 26));
    return posMod(wiring.indexOf(target) - pos, 26);
}

/**
 * Enigma M3 simulation (no plugboard, no ring settings).
 * rotors: ['I','II','III'] — left to right
 * initialPositions: [0..25] each — left to right  (A=0, Z=25)
 * Same function is used for both encrypt and decrypt (reciprocal property).
 */
export function enigma(
    text: string,
    rotors: string[],
    reflector: string,
    initialPositions: number[]
): string {
    const clean = toAlpha(text);
    if (!REFLECTOR_WIRINGS[reflector])
        throw new Error(`Reflektor '${reflector}' tidak dikenal`);
    for (const r of rotors) {
        if (!ROTOR_WIRINGS[r]) throw new Error(`Rotor '${r}' tidak dikenal`);
    }

    const pos = [...initialPositions];
    const reflWiring = REFLECTOR_WIRINGS[reflector];
    let result = "";

    for (const ch of clean) {
        // --- Stepping (double-stepping anomaly) ---
        if (pos[1] === ROTOR_NOTCH[rotors[1]]) {
            // Middle at notch: left and middle both step
            pos[0] = posMod(pos[0] + 1, 26);
            pos[1] = posMod(pos[1] + 1, 26);
        } else if (pos[2] === ROTOR_NOTCH[rotors[2]]) {
            // Right at notch: middle steps
            pos[1] = posMod(pos[1] + 1, 26);
        }
        pos[2] = posMod(pos[2] + 1, 26); // Right always steps

        // --- Signal path ---
        let signal = ch.charCodeAt(0) - 65;

        // Forward: right → middle → left
        signal = rotorForward(ROTOR_WIRINGS[rotors[2]], signal, pos[2]);
        signal = rotorForward(ROTOR_WIRINGS[rotors[1]], signal, pos[1]);
        signal = rotorForward(ROTOR_WIRINGS[rotors[0]], signal, pos[0]);

        // Reflector
        signal = reflWiring.charCodeAt(signal) - 65;

        // Backward: left → middle → right
        signal = rotorBackward(ROTOR_WIRINGS[rotors[0]], signal, pos[0]);
        signal = rotorBackward(ROTOR_WIRINGS[rotors[1]], signal, pos[1]);
        signal = rotorBackward(ROTOR_WIRINGS[rotors[2]], signal, pos[2]);

        result += String.fromCharCode(65 + signal);
    }
    return result;
}

// ============================================================
//  ENIGMA/ROTOR CIPHER (Custom Alphabet Length Version)
// ============================================================

export type RotorCount = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Generate custom alphabet based on length
 * Example: length 5 -> ['A', 'B', 'C', 'D', 'E']
 */
export function generateAlphabet(length: number): string[] {
    if (length < 5 || length > 26) {
        throw new Error("Panjang alfabet harus antara 5 dan 26");
    }
    return Array.from({ length }, (_, i) => String.fromCharCode(65 + i));
}

/**
 * Generate randomized keys for each rotor position
 * Each key is a shuffled version of the alphabet
 */
export function generateRandomKeys(
    rotorCount: number,
    alphabetLength: number
): { [key: string]: string[] } {
    const alphabet = generateAlphabet(alphabetLength);
    const keys: { [key: string]: string[] } = {};

    for (let i = 0; i < rotorCount; i++) {
        const shuffled = [...alphabet];
        for (let j = shuffled.length - 1; j > 0; j--) {
            const k = Math.floor(Math.random() * (j + 1));
            [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
        }
        keys[`K${i}`] = shuffled;
    }

    return keys;
}

/**
 * Validate if text only contains letters within the custom alphabet
 */
export function isValidForAlphabet(text: string, alphabetLength: number): boolean {
    const maxCharCode = 64 + alphabetLength;
    for (const char of text.toUpperCase()) {
        if (char === " ") continue;
        const code = char.charCodeAt(0);
        if (code < 65 || code > maxCharCode) return false;
    }
    return true;
}

/**
 * Get the index of a letter in the custom alphabet (0 to length-1)
 */
function getLetterIndex(letter: string, alphabetLength: number): number {
    const upper = letter.toUpperCase();
    const code = upper.charCodeAt(0);
    if (code < 65 || code > 64 + alphabetLength) return -1;
    return code - 65;
}

/**
 * Encrypt/Decrypt using the Enigma rotor cipher with custom alphabet length
 */
export function customEnigma(
    text: string,
    rotorCount: RotorCount | number,
    startPosition: number,
    keys: { [key: string]: string[] },
    alphabetLength: number,
    mode: "encrypt" | "decrypt"
): { result: string; steps: any[] } {
    const keyNames = Object.keys(keys).sort();
    let result = "";
    let currentPosition = startPosition % rotorCount;
    const alphabet = generateAlphabet(alphabetLength);
    const steps = [];

    for (let i = 0; i < text.length; i++) {
        const originalChar = text[i];
        const char = originalChar.toUpperCase();

        // Preserve non-alphabetic/spaces
        if (char === " " || char < "A" || char > String.fromCharCode(64 + alphabetLength)) {
            result += originalChar;
            continue;
        }

        const currentKey = keys[keyNames[currentPosition]];
        let substitutedChar = "";

        if (mode === "encrypt") {
            const letterIndex = getLetterIndex(char, alphabetLength);
            if (letterIndex !== -1) {
                substitutedChar = currentKey[letterIndex];
                result += substitutedChar;
            } else {
                result += char;
            }
        } else {
            const letterIndex = currentKey.indexOf(char);
            if (letterIndex !== -1) {
                substitutedChar = alphabet[letterIndex];
                result += substitutedChar;
            } else {
                result += char;
            }
        }

        steps.push({
            i: steps.length,
            rotorPos: currentPosition,
            inputChar: char,
            outputChar: substitutedChar,
            formula: mode === "encrypt"
                ? `K${currentPosition}[${char}] = ${substitutedChar}`
                : `K${currentPosition}⁻¹[${char}] = ${substitutedChar}`,
        });

        // Advance position
        currentPosition = (currentPosition + 1) % rotorCount;
    }

    return { result, steps };
}

/**
 * Parse a key string like "D,A,H,C,F,B,G,E" into an array
 */
export function parseKeyString(
    input: string,
    expectedLength: number
): { valid: boolean; key?: string[]; error?: string; alphabetLength?: number } {
    if (!input || input.trim() === "") {
        return { valid: false, error: "Kunci tidak boleh kosong" };
    }

    const parts = input.split(",").map((p) => p.trim().toUpperCase()).filter((p) => p);

    if (parts.length === 0) return { valid: false, error: "Tidak ada huruf valid yang ditemukan" };
    if (parts.some((p) => p.length === 0)) return { valid: false, error: "Format tidak valid - hapus koma ekstra" };
    if (parts.some((p) => p.length > 1)) return { valid: false, error: "Setiap entri harus berupa satu huruf panjangnya" };

    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const letter of parts) {
        if (seen.has(letter)) duplicates.push(letter);
        seen.add(letter);
    }
    if (duplicates.length > 0) return { valid: false, error: `Huruf duplikat: ${duplicates.join(", ")}` };

    const maxCharCode = Math.max(...parts.map((p) => p.charCodeAt(0)));
    const detectedLength = maxCharCode - 64;

    if (detectedLength < 5 || detectedLength > 26) {
        return { valid: false, error: "Huruf harus dalam rentang A hingga Z (max 26)" };
    }

    for (const letter of parts) {
        const code = letter.charCodeAt(0);
        if (code < 65 || code > 64 + detectedLength) {
            return {
                valid: false,
                error: `Huruf '${letter}' di luar batas alfabet (A-${String.fromCharCode(64 + detectedLength)})`,
            };
        }
    }

    if (expectedLength > 0 && parts.length !== expectedLength) {
        return {
            valid: false,
            error: `Diharapkan panjang ${expectedLength} huruf, tetapi didapatkan ${parts.length}`,
            alphabetLength: detectedLength,
        };
    }

    return { valid: true, key: parts, alphabetLength: detectedLength };
}

