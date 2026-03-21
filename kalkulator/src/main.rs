// Simple Kalkulator CLI — Rust Edition  v1.0
// github.com/risqinf/kalkulator

use std::collections::HashMap;
use std::fmt;
use std::io::{self, Write};

// ══════════════════════════════════════════════════════════════════
//  ANSI COLOR CONSTANTS
// ══════════════════════════════════════════════════════════════════
const R: &str = "\x1b[0m";
const BOLD: &str = "\x1b[1m";

// Warna teks
const C_CYAN: &str = "\x1b[96m";
const C_GREEN: &str = "\x1b[92m";
const C_YELLOW: &str = "\x1b[93m";
const C_RED: &str = "\x1b[91m";
const C_BLUE: &str = "\x1b[94m";
const C_MAGENTA: &str = "\x1b[95m";
const C_WHITE: &str = "\x1b[97m";
const C_ORANGE: &str = "\x1b[33m";
const C_GRAY: &str = "\x1b[90m";

// ══════════════════════════════════════════════════════════════════
//  DECIMAL — presisi tetap berbasis i128, 18 angka desimal
//  Setara COBOL COMP-3: S9(18)V9(18)
//  Range: ±9_999_999_999_999_999_999.999_999_999_999_999_999
// ══════════════════════════════════════════════════════════════════

/// Skala: 10^18 — satu unit mewakili 0.000_000_000_000_000_001
const SKALA: i128 = 1_000_000_000_000_000_000;
const SKALA_F: f64 = 1_000_000_000_000_000_000.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Decimal(i128); // nilai = Decimal.0 / SKALA

impl Decimal {
    fn nol() -> Self { Decimal(0) }

    fn dari_i128(n: i128) -> Self {
        Decimal(n.saturating_mul(SKALA))
    }

    fn dari_f64(f: f64) -> Self {
        if f.is_nan() || f.is_infinite() {
            return Decimal(i128::MAX); // sentinel — ditangkap saat display
        }
        Decimal((f * SKALA_F).round() as i128)
    }

    fn ke_f64(self) -> f64 {
        self.0 as f64 / SKALA_F
    }

    fn adalah_bulat(self) -> bool {
        self.0 % SKALA == 0
    }

    fn floor(self) -> Self {
        if self.0 >= 0 {
            Decimal((self.0 / SKALA) * SKALA)
        } else {
            let q = self.0 / SKALA;
            let r = self.0 % SKALA;
            if r != 0 { Decimal((q - 1) * SKALA) } else { Decimal(q * SKALA) }
        }
    }

    fn ceil(self) -> Self {
        let f = self.floor();
        if f == self { f } else { Decimal(f.0 + SKALA) }
    }

    fn round(self) -> Self {
        // Bulat setengah ke atas
        let setengah = Decimal(SKALA / 2);
        if self.0 >= 0 {
            (self + setengah).floor()
        } else {
            (self - setengah).ceil()
        }
    }

    fn trunc(self) -> Self {
        Decimal((self.0 / SKALA) * SKALA)
    }

    fn frac(self) -> Self {
        Decimal(self.0 % SKALA)
    }

    fn abs(self) -> Self {
        Decimal(self.0.abs())
    }

    fn signum(self) -> Self {
        Decimal::dari_i128(self.0.signum() as i128)
    }

    fn adalah_nol(self) -> bool { self.0 == 0 }
    fn adalah_negatif(self) -> bool { self.0 < 0 }
}

impl std::ops::Add for Decimal {
    type Output = Decimal;
    fn add(self, rhs: Decimal) -> Decimal { Decimal(self.0.saturating_add(rhs.0)) }
}
impl std::ops::Sub for Decimal {
    type Output = Decimal;
    fn sub(self, rhs: Decimal) -> Decimal { Decimal(self.0.saturating_sub(rhs.0)) }
}
impl std::ops::Neg for Decimal {
    type Output = Decimal;
    fn neg(self) -> Decimal { Decimal(-self.0) }
}
impl std::ops::Mul for Decimal {
    type Output = Decimal;
    fn mul(self, rhs: Decimal) -> Decimal {
        // Gunakan i128 penuh; hindari overflow dengan pembagian bertahap
        // a/S * b/S = (a*b)/S² → bagi S dulu di salah satu operand
        let a = self.0;
        let b = rhs.0;
        // Pecah menjadi bagian bulat dan desimal untuk menghindari overflow
        let a_int = a / SKALA;
        let a_frac = a % SKALA;
        let res = a_int.saturating_mul(b)
            .saturating_add(
                // a_frac * b / SKALA — gunakan i128 checked
                if let Some(p) = a_frac.checked_mul(b) {
                    p / SKALA
                } else {
                    // fallback ke f64 bila overflow
                    ((a_frac as f64 * b as f64) / SKALA_F) as i128
                }
            );
        Decimal(res)
    }
}
impl std::ops::Div for Decimal {
    type Output = Decimal;
    fn div(self, rhs: Decimal) -> Decimal {
        if rhs.0 == 0 { return Decimal(i128::MAX); } // div by zero sentinel
        // (a/S) / (b/S) = a/b → (a * S) / b
        if let Some(scaled) = self.0.checked_mul(SKALA) {
            Decimal(scaled / rhs.0)
        } else {
            // fallback f64
            Decimal::dari_f64(self.ke_f64() / rhs.ke_f64())
        }
    }
}
impl std::ops::Rem for Decimal {
    type Output = Decimal;
    fn rem(self, rhs: Decimal) -> Decimal {
        if rhs.0 == 0 { return Decimal(i128::MAX); }
        Decimal(self.0 % rhs.0)
    }
}

/// Pangkat dengan eksponen Decimal — eksak untuk eksponen integer, f64 fallback sisanya
fn pow_decimal(base: Decimal, exp: Decimal) -> Result<Decimal, KalError> {
    // Cek apakah eksponen adalah integer
    if exp.adalah_bulat() {
        let e = exp.0 / SKALA;
        if e >= 0 && e <= 300 {
            let mut hasil = Decimal::dari_i128(1);
            for _ in 0..e {
                hasil = hasil * base;
                if hasil.0 == i128::MAX || hasil.0 == i128::MIN {
                    return Err(KalError::Overflow);
                }
            }
            return Ok(hasil);
        }
        if e < 0 && e >= -300 {
            // Basis^(-n) = 1 / (basis^n)
            let pos = pow_decimal(base, Decimal::dari_i128(-e))?;
            if pos.adalah_nol() { return Err(KalError::DivByZero); }
            return Ok(Decimal::dari_i128(1) / pos);
        }
    }
    // Eksponen non-integer: fallback f64
    let hasil_f = base.ke_f64().powf(exp.ke_f64());
    if hasil_f.is_nan() { return Err(KalError::MathError("pangkat menghasilkan NaN".into())); }
    if hasil_f.is_infinite() { return Err(KalError::Overflow); }
    Ok(Decimal::dari_f64(hasil_f))
}

/// Format Decimal ke string — tampilkan digit yang perlu saja
fn format_decimal(d: Decimal) -> String {
    if d.0 == i128::MAX { return "∞ (overflow)".to_string(); }
    if d.0 == i128::MIN { return "-∞ (overflow)".to_string(); }

    let negatif = d.0 < 0;
    let raw = d.0.unsigned_abs(); // u128
    let skala_u = SKALA as u128;

    let bagian_bulat = raw / skala_u;
    let bagian_desimal = raw % skala_u;

    // Format bagian bulat dengan separator ribuan
    let bulat_str = format_ribuan_u128(bagian_bulat);

    let hasil = if bagian_desimal == 0 {
        bulat_str
    } else {
        // Format 18 digit desimal, hapus trailing zero
        let des_str = format!("{:018}", bagian_desimal);
        let des_trim = des_str.trim_end_matches('0');
        format!("{}.{}", bulat_str, des_trim)
    };

    if negatif { format!("-{}", hasil) } else { hasil }
}

fn format_ribuan_u128(n: u128) -> String {
    let s = n.to_string();
    let chars: Vec<char> = s.chars().collect();
    let mut result = String::new();
    for (i, ch) in chars.iter().enumerate() {
        if i > 0 && (chars.len() - i) % 3 == 0 {
            result.push('_');
        }
        result.push(*ch);
    }
    result
}

// ══════════════════════════════════════════════════════════════════
//  TOKEN — unit terkecil dari ekspresi
// ══════════════════════════════════════════════════════════════════
#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    Number(Decimal),       // literal angka: 3.14, 1e-9, 0xff
    Ident(String),         // fungsi atau variabel: sin, sqrt, x
    Op(String),            // operator: +, -, *, /, ^, %, //, **
    LParen,                // (
    RParen,                // )
    Comma,                 // ,
}

// ══════════════════════════════════════════════════════════════════
//  ERROR
// ══════════════════════════════════════════════════════════════════
#[derive(Debug, Clone)]
pub enum KalError {
    ParseError(String),
    MathError(String),
    UndefinedVar(String),
    UnknownFunc(String),
    ArgsError(String),
    DivByZero,
    NegSqrt,
    NegLog,
    Overflow,
}

impl fmt::Display for KalError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            KalError::ParseError(s)  => write!(f, "Kesalahan sintaks  : {}", s),
            KalError::MathError(s)   => write!(f, "Kesalahan matematik: {}", s),
            KalError::UndefinedVar(s)=> write!(f, "Variabel tidak ada : '{}'", s),
            KalError::UnknownFunc(s) => write!(f, "Fungsi tidak dikenal: '{}'", s),
            KalError::ArgsError(s)   => write!(f, "Argumen salah      : {}", s),
            KalError::DivByZero      => write!(f, "Pembagian dengan nol"),
            KalError::NegSqrt        => write!(f, "Akar dari bilangan negatif"),
            KalError::NegLog         => write!(f, "Logaritma dari bilangan ≤ 0"),
            KalError::Overflow       => write!(f, "Hasil terlalu besar (overflow)"),
        }
    }
}

/// Normalise titik ribuan gaya Indonesia/Eropa → angka bersih.
///
/// Aturan:
///   • Jika bagian kiri bukan "0" dan bagian kanan tepat 3 digit
///     → titik adalah separator ribuan, hapus.
///     "100.000"   → "100000"
///     "1.000.000" → "1000000"
///     "1.000.5"   → "1000.5"
///   • Jika bagian kiri "0" atau panjang kanan bukan 3
///     → titik adalah desimal, biarkan.
///     "0.001"     → "0.001"
///     "3.14"      → "3.14"
fn normalise_titik_ribuan(s: &str) -> String {
    if !s.contains('.') {
        return s.to_string();
    }

    let parts: Vec<&str> = s.split('.').collect();
    let n = parts.len();

    let is_ribuan_part = |bagian: &str| -> bool {
        bagian.len() == 3 && bagian.chars().all(|c| c.is_ascii_digit())
    };

    if n == 2 {
        let (kiri, kanan) = (parts[0], parts[1]);
        // Kiri "0" → pasti desimal
        if kiri == "0" {
            return s.to_string();
        }
        if is_ribuan_part(kanan) {
            return format!("{}{}", kiri, kanan);
        }
        return s.to_string();
    }

    // Multiple dots: gabung yang ribuan, hentikan saat desimal
    let mut hasil = parts[0].to_string();
    let kiri_nol = parts[0] == "0";
    for i in 1..n {
        let bagian = parts[i];
        if kiri_nol {
            // Kiri nol → semua sisa adalah bagian desimal
            hasil.push('.');
            hasil.push_str(&parts[i..].join("."));
            break;
        }
        if is_ribuan_part(bagian) {
            hasil.push_str(bagian);
        } else {
            hasil.push('.');
            hasil.push_str(bagian);
            break;
        }
    }
    hasil
}

/// Parse string desimal secara eksak ke Decimal (tanpa floating point error)
/// Mendukung: "3.14", "1e6", "1.5e-3", "-2.7"
fn parse_decimal_str(s: &str) -> Option<Decimal> {
    // Tangani notasi ilmiah lewat f64 (presisi cukup untuk eksponen)
    if s.contains('e') || s.contains('E') {
        let f: f64 = s.parse().ok()?;
        return Some(Decimal::dari_f64(f));
    }
    let negatif = s.starts_with('-');
    let s = if negatif { &s[1..] } else { s };
    let s = if s.starts_with('+') { &s[1..] } else { s };

    let (bulat_str, desimal_str) = if let Some(dot) = s.find('.') {
        (&s[..dot], &s[dot+1..])
    } else {
        (s, "")
    };

    let bulat: i128 = if bulat_str.is_empty() { 0 } else { bulat_str.parse().ok()? };

    // Desimal: ambil tepat 18 digit, pad atau potong
    let mut des_str = desimal_str.to_string();
    des_str.truncate(18);
    let kurang = 18 - des_str.len();
    for _ in 0..kurang { des_str.push('0'); }
    let des: i128 = des_str.parse().ok()?;

    let nilai = bulat.checked_mul(SKALA)?.checked_add(des)?;
    Some(Decimal(if negatif { -nilai } else { nilai }))
}

// ══════════════════════════════════════════════════════════════════
//  LEXER — teks → stream of Token
// ══════════════════════════════════════════════════════════════════
pub struct Lexer {
    chars: Vec<char>,
    pos: usize,
}

impl Lexer {
    pub fn new(input: &str) -> Self {
        Self {
            chars: input.chars().collect(),
            pos: 0,
        }
    }

    fn peek(&self) -> Option<char> {
        self.chars.get(self.pos).copied()
    }

    fn skip_whitespace(&mut self) {
        while let Some(c) = self.peek() {
            if c.is_whitespace() { self.pos += 1; } else { break; }
        }
    }

    fn read_number(&mut self) -> Result<Decimal, KalError> {
        let start = self.pos;
        let mut has_exp = false;

        // Cek prefix hex: 0x...
        if self.peek() == Some('0') {
            self.pos += 1;
            if self.peek() == Some('x') || self.peek() == Some('X') {
                self.pos += 1;
                let mut hex = String::new();
                while let Some(c) = self.peek() {
                    if c.is_ascii_hexdigit() { hex.push(c); self.pos += 1; }
                    else { break; }
                }
                return i128::from_str_radix(&hex, 16)
                    .map(Decimal::dari_i128)
                    .map_err(|_| KalError::ParseError(format!("Hex tidak valid: 0x{}", hex)));
            }
            // Cek prefix binary: 0b...
            if self.peek() == Some('b') || self.peek() == Some('B') {
                self.pos += 1;
                let mut bin = String::new();
                while let Some(c) = self.peek() {
                    if c == '0' || c == '1' { bin.push(c); self.pos += 1; }
                    else { break; }
                }
                return i128::from_str_radix(&bin, 2)
                    .map(Decimal::dari_i128)
                    .map_err(|_| KalError::ParseError(format!("Binary tidak valid: 0b{}", bin)));
            }
            // Kembali untuk baca ulang sebagai desimal normal
            self.pos = start;
        }

        while let Some(c) = self.peek() {
            match c {
                '0'..='9' => { self.pos += 1; }
                '.' if !has_exp => {
                    // Baca titik — bisa separator ribuan atau desimal
                    // Keputusan diambil nanti di normalise_titik_ribuan
                    self.pos += 1;
                }
                'e' | 'E' if !has_exp => {
                    has_exp = true;
                    self.pos += 1;
                    if let Some(s) = self.peek() {
                        if s == '+' || s == '-' { self.pos += 1; }
                    }
                }
                '_' => { self.pos += 1; }
                _ => break,
            }
        }

        let raw: String = self.chars[start..self.pos]
            .iter()
            .collect();

        // Normalise: hilangkan _ sebagai separator ribuan
        let raw = raw.replace('_', "");

        // Deteksi titik sebagai separator ribuan (gaya Indonesia):
        // Pola: digit(s) diikuti satu atau lebih kelompok .ddd (tepat 3 digit)
        // tanpa bagian desimal sejati di belakangnya.
        // Contoh: "100.000" "1.000.000" → ribuan
        // Tapi "3.14" "100.5" → desimal biasa
        let raw = normalise_titik_ribuan(&raw);

        // Parse secara eksak
        parse_decimal_str(&raw)
            .ok_or_else(|| KalError::ParseError(format!("Angka tidak valid: '{}'", raw)))
    }

    fn read_ident(&mut self) -> String {
        let mut s = String::new();
        while let Some(c) = self.peek() {
            if c.is_alphanumeric() || c == '_' { s.push(c); self.pos += 1; }
            else { break; }
        }
        s
    }

    pub fn tokenize(&mut self) -> Result<Vec<Token>, KalError> {
        let mut tokens = Vec::new();

        loop {
            self.skip_whitespace();
            match self.peek() {
                None => break,
                Some(c) => match c {
                    '0'..='9' | '.' => {
                        let n = self.read_number()?;
                        tokens.push(Token::Number(n));
                    }
                    'a'..='z' | 'A'..='Z' | '_' => {
                        let ident = self.read_ident();
                        tokens.push(Token::Ident(ident));
                    }
                    '+' | '-' | '%' | '!' => {
                        self.pos += 1;
                        tokens.push(Token::Op(c.to_string()));
                    }
                    '*' => {
                        self.pos += 1;
                        if self.peek() == Some('*') {
                            self.pos += 1;
                            tokens.push(Token::Op("**".to_string())); // alias ^
                        } else {
                            tokens.push(Token::Op("*".to_string()));
                        }
                    }
                    '/' => {
                        self.pos += 1;
                        if self.peek() == Some('/') {
                            self.pos += 1;
                            tokens.push(Token::Op("//".to_string())); // floor division
                        } else {
                            tokens.push(Token::Op("/".to_string()));
                        }
                    }
                    '^' => { self.pos += 1; tokens.push(Token::Op("^".to_string())); }
                    '(' => { self.pos += 1; tokens.push(Token::LParen); }
                    ')' => { self.pos += 1; tokens.push(Token::RParen); }
                    ',' => { self.pos += 1; tokens.push(Token::Comma); }
                    '#' => {
                        // komentar — abaikan sisa baris
                        while self.peek().map_or(false, |c| c != '\n') { self.pos += 1; }
                    }
                    _ => {
                        return Err(KalError::ParseError(format!(
                            "Karakter tak dikenal: '{}'", c
                        )));
                    }
                }
            }
        }
        Ok(tokens)
    }
}

// ══════════════════════════════════════════════════════════════════
//  PARSER (Shunting-Yard) — tokens → RPN (Reverse Polish Notation)
// ══════════════════════════════════════════════════════════════════
fn precedence(op: &str) -> u8 {
    match op {
        "+" | "-"  => 1,
        "*" | "/" | "//" | "%" => 2,
        "^" | "**" => 3,
        "!"        => 4, // factorial (postfix unary)
        _          => 0,
    }
}

fn is_right_assoc(op: &str) -> bool {
    op == "^" || op == "**"
}

fn is_unary_prefix(op: &str) -> bool {
    op == "u-" || op == "u+"
}

/// Mengubah infix token list → postfix (RPN) token list
pub fn shunting_yard(tokens: Vec<Token>) -> Result<Vec<Token>, KalError> {
    let mut output: Vec<Token> = Vec::new();
    let mut op_stack: Vec<Token> = Vec::new();
    // argc stack: berapa argumen tiap fungsi
    let mut argc_stack: Vec<usize> = Vec::new();

    let mut prev_was_value = false; // untuk deteksi unary minus

    for token in tokens {
        match &token {
            Token::Number(_) => {
                output.push(token);
                prev_was_value = true;
            }

            Token::Ident(_) => {
                // Bisa jadi fungsi (akan diikuti '(') atau variabel/konstanta
                op_stack.push(token);
                prev_was_value = false;
            }

            Token::Op(op) if op == "-" || op == "+" => {
                if !prev_was_value {
                    // Unary
                    let uop = if op == "-" { "u-" } else { "u+" };
                    op_stack.push(Token::Op(uop.to_string()));
                    prev_was_value = false;
                } else {
                    pop_ops_to_output(op, &mut output, &mut op_stack);
                    op_stack.push(Token::Op(op.to_string()));
                    prev_was_value = false;
                }
            }

            Token::Op(op) if op == "!" => {
                // postfix unary factorial — langsung ke output sebagai operator
                output.push(Token::Op("!".to_string()));
                prev_was_value = true;
            }

            Token::Op(op) => {
                pop_ops_to_output(op, &mut output, &mut op_stack);
                op_stack.push(Token::Op(op.clone()));
                prev_was_value = false;
            }

            Token::LParen => {
                // Jika top stack adalah Ident (fungsi), siapkan argc
                if let Some(Token::Ident(_)) = op_stack.last() {
                    argc_stack.push(1);
                }
                op_stack.push(Token::LParen);
                prev_was_value = false;
            }

            Token::Comma => {
                // Selesaikan operator sampai LParen
                while let Some(top) = op_stack.last() {
                    if top == &Token::LParen { break; }
                    output.push(op_stack.pop().unwrap());
                }
                if let Some(n) = argc_stack.last_mut() {
                    *n += 1;
                }
                prev_was_value = false;
            }

            Token::RParen => {
                while let Some(top) = op_stack.last() {
                    if top == &Token::LParen { break; }
                    output.push(op_stack.pop().unwrap());
                }
                if op_stack.last() != Some(&Token::LParen) {
                    return Err(KalError::ParseError("Kurung tutup tanpa pasangan".to_string()));
                }
                op_stack.pop(); // buang LParen

                // Jika ada fungsi di atas stack, keluarkan
                if let Some(Token::Ident(name)) = op_stack.last() {
                    let argc = argc_stack.pop().unwrap_or(1);
                    let func_token = Token::Ident(format!("{}#{}", name, argc));
                    output.push(func_token);
                    op_stack.pop();
                }
                prev_was_value = true;
            }
        }
    }

    while let Some(top) = op_stack.pop() {
        if top == Token::LParen {
            return Err(KalError::ParseError("Kurung buka tanpa penutup".to_string()));
        }
        output.push(top);
    }

    Ok(output)
}

fn pop_ops_to_output(op: &str, output: &mut Vec<Token>, op_stack: &mut Vec<Token>) {
    while let Some(top) = op_stack.last() {
        match top {
            Token::Op(top_op) if !is_unary_prefix(top_op) => {
                let top_op = top_op.clone();
                if top_op == "u-" || top_op == "u+" {
                    break;
                }
                let should_pop = if is_right_assoc(op) {
                    precedence(&top_op) > precedence(op)
                } else {
                    precedence(&top_op) >= precedence(op)
                };
                if should_pop {
                    output.push(op_stack.pop().unwrap());
                } else {
                    break;
                }
            }
            Token::Ident(_) => {
                output.push(op_stack.pop().unwrap());
            }
            _ => break,
        }
    }
}

// ══════════════════════════════════════════════════════════════════
//  EVALUATOR — evaluasi RPN dengan stack
// ══════════════════════════════════════════════════════════════════

/// Konteks evaluasi: variabel + mode sudut
pub struct Konteks {
    pub vars: HashMap<String, Decimal>,
    pub sudut_radian: bool,
}

impl Konteks {
    pub fn new() -> Self {
        let mut vars: HashMap<String, Decimal> = HashMap::new();
        // Konstanta bawaan — disimpan sebagai Decimal presisi penuh
        vars.insert("pi".into(),    parse_decimal_str("3.141592653589793238").unwrap());
        vars.insert("e".into(),     parse_decimal_str("2.718281828459045235").unwrap());
        vars.insert("phi".into(),   parse_decimal_str("1.618033988749894848").unwrap());
        vars.insert("tau".into(),   parse_decimal_str("6.283185307179586476").unwrap());
        vars.insert("sqrt2".into(), parse_decimal_str("1.414213562373095048").unwrap());
        vars.insert("ln2".into(),   parse_decimal_str("0.693147180559945309").unwrap());
        vars.insert("ln10".into(),  parse_decimal_str("2.302585092994045684").unwrap());
        vars.insert("eps".into(),   Decimal::dari_f64(f64::EPSILON));
        vars.insert("inf".into(),   Decimal(i128::MAX));
        Self { vars, sudut_radian: false }
    }

    fn to_rad(&self, x: Decimal) -> f64 {
        if self.sudut_radian { x.ke_f64() } else { x.ke_f64().to_radians() }
    }
    fn from_rad_f(&self, x: f64) -> Decimal {
        let deg = if self.sudut_radian { x } else { x.to_degrees() };
        Decimal::dari_f64(deg)
    }
    fn dari_f64_hasil(&self, f: f64) -> Result<Decimal, KalError> {
        if f.is_nan()      { return Err(KalError::MathError("Hasil NaN".into())); }
        if f.is_infinite() { return Err(KalError::Overflow); }
        Ok(Decimal::dari_f64(f))
    }
}

/// Fungsi factorial (integer) — eksak dengan i128
fn factorial(n: Decimal) -> Result<Decimal, KalError> {
    if n.adalah_negatif() {
        return Err(KalError::MathError("Faktorial bilangan negatif".into()));
    }
    if !n.adalah_bulat() {
        // Gamma approximation via f64
        let g = gamma(n.ke_f64() + 1.0);
        return Ok(Decimal::dari_f64(g));
    }
    let ni = (n.0 / SKALA) as u64;
    if ni > 25 {
        // Lebih dari 25!: gunakan f64 (presisi cukup untuk tampilan)
        if ni > 170 { return Err(KalError::Overflow); }
        let mut hasil = 1.0f64;
        for i in 2..=ni { hasil *= i as f64; }
        return Ok(Decimal::dari_f64(hasil));
    }
    // Eksak untuk 0!..25! menggunakan i128
    let mut hasil: i128 = 1;
    for i in 2..=ni {
        hasil = hasil.checked_mul(i as i128)
            .ok_or(KalError::Overflow)?;
    }
    Ok(Decimal::dari_i128(hasil))
}

/// Lanczos approximation untuk Gamma function
fn gamma(z: f64) -> f64 {
    const G: f64 = 7.0;
    const C: [f64; 9] = [
        0.99999999999980993,
        676.5203681218851,
        -1259.1392167224028,
        771.32342877765313,
        -176.61502916214059,
        12.507343278686905,
        -0.13857109526572012,
        9.9843695780195716e-6,
        1.5056327351493116e-7,
    ];
    if z < 0.5 {
        std::f64::consts::PI / ((std::f64::consts::PI * z).sin() * gamma(1.0 - z))
    } else {
        let z = z - 1.0;
        let mut x = C[0];
        for (i, &c) in C[1..].iter().enumerate() {
            x += c / (z + i as f64 + 1.0);
        }
        let t = z + G + 0.5;
        (2.0 * std::f64::consts::PI).sqrt() * t.powf(z + 0.5) * (-t).exp() * x
    }
}

/// nCr — kombinasi
fn nkr(n: Decimal, r: Decimal) -> Result<Decimal, KalError> {
    if r.adalah_negatif() || r > n { return Ok(Decimal::nol()); }
    Ok(factorial(n)? / (factorial(r)? * factorial(n - r)?))
}

/// nPr — permutasi
fn npr(n: Decimal, r: Decimal) -> Result<Decimal, KalError> {
    if r.adalah_negatif() || r > n { return Ok(Decimal::nol()); }
    Ok(factorial(n)? / factorial(n - r)?)
}

/// GCD (algoritma Euclid) — bekerja pada bagian integer
fn gcd(a: Decimal, b: Decimal) -> Decimal {
    let (mut a, mut b) = (
        (a.abs().0 / SKALA) as u128,
        (b.abs().0 / SKALA) as u128,
    );
    while b != 0 { let t = b; b = a % b; a = t; }
    Decimal::dari_i128(a as i128)
}

/// Evaluasi satu token fungsi/operator pada stack nilai
fn eval_func(name_raw: &str, stack: &mut Vec<Decimal>, ctx: &Konteks) -> Result<(), KalError> {
    let (name, argc) = if let Some(idx) = name_raw.find('#') {
        let n = &name_raw[..idx];
        let a: usize = name_raw[idx+1..].parse().unwrap_or(1);
        (n, a)
    } else {
        (name_raw, 1usize)
    };

    macro_rules! pop {
        () => {{
            stack.pop().ok_or_else(|| KalError::ParseError("Stack kosong".into()))?
        }};
    }

    // Variabel / konstanta
    if argc == 1 && !name_raw.contains('#') {
        if let Some(&v) = ctx.vars.get(name) {
            stack.push(v);
            return Ok(());
        }
    }

    match name {
        // ── Fungsi 1 argumen ────────────────────────────
        "sqrt" | "akar" => {
            let x = pop!();
            if x.adalah_negatif() { return Err(KalError::NegSqrt); }
            stack.push(ctx.dari_f64_hasil(x.ke_f64().sqrt())?);
        }
        "cbrt" | "akar3" => { let x = pop!(); stack.push(ctx.dari_f64_hasil(x.ke_f64().cbrt())?); }
        "abs"   => { let x = pop!(); stack.push(x.abs()); }
        "ceil"  | "langit" => { let x = pop!(); stack.push(x.ceil()); }
        "floor" | "lantai" => { let x = pop!(); stack.push(x.floor()); }
        "round" | "bulat"  => { let x = pop!(); stack.push(x.round()); }
        "trunc" | "potong" => { let x = pop!(); stack.push(x.trunc()); }
        "frac"  => { let x = pop!(); stack.push(x.frac()); }
        "sign"  => { let x = pop!(); stack.push(x.signum()); }
        "exp"   => { let x = pop!(); stack.push(ctx.dari_f64_hasil(x.ke_f64().exp())?); }
        "exp2"  => { let x = pop!(); stack.push(ctx.dari_f64_hasil(x.ke_f64().exp2())?); }
        "ln"    => {
            let x = pop!();
            if !x.adalah_negatif() && !x.adalah_nol() {
                stack.push(ctx.dari_f64_hasil(x.ke_f64().ln())?);
            } else { return Err(KalError::NegLog); }
        }
        "log" | "log10" => {
            let x = pop!();
            if !x.adalah_negatif() && !x.adalah_nol() {
                stack.push(ctx.dari_f64_hasil(x.ke_f64().log10())?);
            } else { return Err(KalError::NegLog); }
        }
        "log2" => {
            let x = pop!();
            if !x.adalah_negatif() && !x.adalah_nol() {
                stack.push(ctx.dari_f64_hasil(x.ke_f64().log2())?);
            } else { return Err(KalError::NegLog); }
        }
        // Trigonometri
        "sin" => { let x = pop!(); stack.push(ctx.dari_f64_hasil(ctx.to_rad(x).sin())?); }
        "cos" => { let x = pop!(); stack.push(ctx.dari_f64_hasil(ctx.to_rad(x).cos())?); }
        "tan" => { let x = pop!(); stack.push(ctx.dari_f64_hasil(ctx.to_rad(x).tan())?); }
        "cot" => { let x = pop!(); stack.push(ctx.dari_f64_hasil(1.0 / ctx.to_rad(x).tan())?); }
        "sec" => { let x = pop!(); stack.push(ctx.dari_f64_hasil(1.0 / ctx.to_rad(x).cos())?); }
        "csc" => { let x = pop!(); stack.push(ctx.dari_f64_hasil(1.0 / ctx.to_rad(x).sin())?); }
        "asin" | "arcsin" => {
            let x = pop!();
            if x.abs() > Decimal::dari_i128(1) { return Err(KalError::MathError("arcsin: x harus dalam [-1,1]".into())); }
            stack.push(ctx.from_rad_f(x.ke_f64().asin()));
        }
        "acos" | "arccos" => {
            let x = pop!();
            if x.abs() > Decimal::dari_i128(1) { return Err(KalError::MathError("arccos: x harus dalam [-1,1]".into())); }
            stack.push(ctx.from_rad_f(x.ke_f64().acos()));
        }
        "atan" | "arctan" => { let x = pop!(); stack.push(ctx.from_rad_f(x.ke_f64().atan())); }
        "sinh"  => { let x = pop!(); stack.push(ctx.dari_f64_hasil(x.ke_f64().sinh())?); }
        "cosh"  => { let x = pop!(); stack.push(ctx.dari_f64_hasil(x.ke_f64().cosh())?); }
        "tanh"  => { let x = pop!(); stack.push(ctx.dari_f64_hasil(x.ke_f64().tanh())?); }
        "asinh" => { let x = pop!(); stack.push(ctx.dari_f64_hasil(x.ke_f64().asinh())?); }
        "acosh" => {
            let x = pop!();
            if x < Decimal::dari_i128(1) { return Err(KalError::MathError("acosh: x harus ≥ 1".into())); }
            stack.push(ctx.dari_f64_hasil(x.ke_f64().acosh())?);
        }
        "atanh" => {
            let x = pop!();
            if x.abs() >= Decimal::dari_i128(1) { return Err(KalError::MathError("atanh: x harus dalam (-1,1)".into())); }
            stack.push(ctx.dari_f64_hasil(x.ke_f64().atanh())?);
        }
        "fak" | "fact" | "factorial" => { let x = pop!(); stack.push(factorial(x)?); }
        "gamma" => { let x = pop!(); stack.push(ctx.dari_f64_hasil(gamma(x.ke_f64()))?); }
        "rad"   => { let x = pop!(); stack.push(ctx.dari_f64_hasil(x.ke_f64().to_radians())?); }
        "deg"   => { let x = pop!(); stack.push(ctx.dari_f64_hasil(x.ke_f64().to_degrees())?); }
        "reciprocal" | "inv" => {
            let x = pop!();
            if x.adalah_nol() { return Err(KalError::DivByZero); }
            stack.push(Decimal::dari_i128(1) / x);
        }
        "sq" | "kuadrat" => { let x = pop!(); stack.push(x * x); }
        "cube"  => { let x = pop!(); stack.push(x * x * x); }

        // ── Fungsi 2 argumen ────────────────────────────
        "pow" => {
            let b = pop!(); let a = pop!();
            stack.push(pow_decimal(a, b)?);
        }
        "root" => {
            let n = pop!(); let x = pop!();
            if x.adalah_negatif() && !n.adalah_bulat() { return Err(KalError::NegSqrt); }
            stack.push(ctx.dari_f64_hasil(x.ke_f64().powf(1.0 / n.ke_f64()))?);
        }
        "logn" | "logbase" => {
            let base = pop!(); let x = pop!();
            if x.adalah_nol() || x.adalah_negatif() { return Err(KalError::NegLog); }
            if base.adalah_nol() || base.adalah_negatif() || base == Decimal::dari_i128(1) {
                return Err(KalError::MathError("Base log harus > 0 dan ≠ 1".into()));
            }
            stack.push(ctx.dari_f64_hasil(x.ke_f64().ln() / base.ke_f64().ln())?);
        }
        "max"  => { let b = pop!(); let a = pop!(); stack.push(if a > b { a } else { b }); }
        "min"  => { let b = pop!(); let a = pop!(); stack.push(if a < b { a } else { b }); }
        "mod"  => {
            let b = pop!(); let a = pop!();
            if b.adalah_nol() { return Err(KalError::DivByZero); }
            stack.push(a % b);
        }
        "gcd"  => { let b = pop!(); let a = pop!(); stack.push(gcd(a, b)); }
        "lcm"  => {
            let b = pop!(); let a = pop!();
            let g = gcd(a, b);
            if g.adalah_nol() { stack.push(Decimal::nol()); }
            else { stack.push((a * b).abs() / g); }
        }
        "hypot" => {
            let b = pop!(); let a = pop!();
            stack.push(ctx.dari_f64_hasil(a.ke_f64().hypot(b.ke_f64()))?);
        }
        "atan2" => {
            let b = pop!(); let a = pop!();
            stack.push(ctx.from_rad_f(a.ke_f64().atan2(b.ke_f64())));
        }
        "nkr" | "kombinasi" | "C" => { let r = pop!(); let n = pop!(); stack.push(nkr(n, r)?); }
        "npr" | "permutasi" | "P" => { let r = pop!(); let n = pop!(); stack.push(npr(n, r)?); }

        // ── Fungsi 3 argumen ────────────────────────────
        "clamp" => {
            let hi = pop!(); let lo = pop!(); let x = pop!();
            stack.push(if x < lo { lo } else if x > hi { hi } else { x });
        }
        "lerp" => {
            let t = pop!(); let b = pop!(); let a = pop!();
            stack.push(a + (b - a) * t);
        }

        _ => { return Err(KalError::UnknownFunc(name.to_string())); }
    }
    Ok(())
}

pub fn evaluasi_rpn(rpn: Vec<Token>, ctx: &mut Konteks) -> Result<Decimal, KalError> {
    let mut stack: Vec<Decimal> = Vec::new();

    for token in rpn {
        match token {
            Token::Number(n) => stack.push(n),

            Token::Op(ref op) => {
                match op.as_str() {
                    "u-" => {
                        let x = stack.pop()
                            .ok_or_else(|| KalError::ParseError("Stack kosong".into()))?;
                        stack.push(-x);
                    }
                    "u+" => { /* no-op */ }
                    "!" => {
                        let x = stack.pop()
                            .ok_or_else(|| KalError::ParseError("Stack kosong".into()))?;
                        stack.push(factorial(x)?);
                    }
                    _ => {
                        let b = stack.pop()
                            .ok_or_else(|| KalError::ParseError(format!("Stack kosong untuk op '{}'", op)))?;
                        let a = stack.pop()
                            .ok_or_else(|| KalError::ParseError(format!("Stack kosong untuk op '{}'", op)))?;
                        let res = match op.as_str() {
                            "+"  => a + b,
                            "-"  => a - b,
                            "*"  => a * b,
                            "/"  => {
                                if b.adalah_nol() { return Err(KalError::DivByZero); }
                                a / b
                            }
                            "//" => {
                                if b.adalah_nol() { return Err(KalError::DivByZero); }
                                (a / b).floor()
                            }
                            "^" | "**" => pow_decimal(a, b)?,
                            "%"  => {
                                if b.adalah_nol() { return Err(KalError::DivByZero); }
                                a % b
                            }
                            _ => return Err(KalError::ParseError(format!("Op tidak dikenal: '{}'", op))),
                        };
                        if res.0 == i128::MAX || res.0 == i128::MIN {
                            return Err(KalError::Overflow);
                        }
                        stack.push(res);
                    }
                }
            }

            Token::Ident(name) => {
                if name.contains('#') {
                    eval_func(&name, &mut stack, ctx)?;
                } else {
                    if let Some(&v) = ctx.vars.get(&name.to_lowercase()) {
                        stack.push(v);
                    } else {
                        return Err(KalError::UndefinedVar(name));
                    }
                }
            }

            _ => {}
        }
    }

    stack.pop().ok_or_else(|| KalError::ParseError("Ekspresi menghasilkan stack kosong".into()))
}

// ══════════════════════════════════════════════════════════════════
//  PIPELINE UTAMA: ekspresi string → Decimal
// ══════════════════════════════════════════════════════════════════
pub fn hitung(input: &str, ctx: &mut Konteks) -> Result<Decimal, KalError> {
    let mut lexer = Lexer::new(input);
    let tokens = lexer.tokenize()?;
    if tokens.is_empty() {
        return Err(KalError::ParseError("Ekspresi kosong".into()));
    }
    let rpn = shunting_yard(tokens)?;
    evaluasi_rpn(rpn, ctx)
}

/// Coba parse penugasan: "var = ekspresi"
fn coba_parse_penugasan(input: &str) -> Option<(String, String)> {
    if let Some(idx) = input.find('=') {
        let kiri = input[..idx].trim();
        let kanan = input[idx+1..].trim();
        // Pastikan kiri adalah identifier valid
        if kiri.chars().all(|c| c.is_alphanumeric() || c == '_')
           && kiri.chars().next().map_or(false, |c| c.is_alphabetic() || c == '_')
        {
            return Some((kiri.to_string(), kanan.to_string()));
        }
    }
    None
}

// ══════════════════════════════════════════════════════════════════
//  FORMAT OUTPUT
// ══════════════════════════════════════════════════════════════════
fn format_angka(d: Decimal) -> String {
    format_decimal(d)
}

// ══════════════════════════════════════════════════════════════════
//  UI — tampilan terminal
// ══════════════════════════════════════════════════════════════════

const SEP: &str = "  ────────────────────────────────────────────────────";

fn clear_screen() {
    print!("\x1b[2J\x1b[H");
}

fn tampil_header() {
    println!();
    println!("  {}{}Simple Kalkulator CLI{}", BOLD, C_YELLOW, R);
    println!("  {}Rust Edition  —  45+ fungsi{}", C_GRAY, R);
    println!("  {}github.com/risqinf/kalkulator{}", C_GRAY, R);
    println!("{}{}", SEP, R);
    println!();
}

// helper: cetak baris item bantuan
// format:  "  cmd_str   keterangan"
fn baris(cmd: &str, ket: &str) {
    println!("  {}{:<20}{}{}", C_GREEN, cmd, R, ket);
}

fn judul_seksi(teks: &str) {
    println!();
    println!("  {}{}{}", BOLD, C_YELLOW, teks);
    println!("  {}{}{}", C_GRAY, "─".repeat(teks.len()), R);
}

fn tampil_bantuan() {
    println!();
    println!("  {}{}PANDUAN LENGKAP{}", BOLD, C_CYAN, R);
    println!("{}", SEP);

    judul_seksi("OPERATOR");
    baris("+  -  *  /",    "penjumlahan, pengurangan, perkalian, pembagian");
    baris("^  atau **",    "pangkat:  2^10 = 1024");
    baris("%",             "modulo (sisa bagi):  17 % 5 = 2");
    baris("//",            "pembagian bulat bawah:  17 // 5 = 3");
    baris("n!",            "faktorial postfix:  7! = 5040");
    baris("()",            "pengelompokan:  (2 + 3) * 4 = 20");

    judul_seksi("AKAR & EKSPONEN");
    baris("sqrt(x)",       "akar kuadrat");
    baris("cbrt(x)",       "akar kubik");
    baris("root(x, n)",    "akar ke-n:  root(32, 5) = 2");
    baris("sq(x)",         "kuadrat x²:  sq(9) = 81");
    baris("cube(x)",       "pangkat tiga x³");
    baris("exp(x)",        "e pangkat x");
    baris("exp2(x)",       "2 pangkat x:  exp2(8) = 256");
    baris("pow(a, b)",     "a pangkat b");

    judul_seksi("LOGARITMA");
    baris("ln(x)",         "logaritma natural (basis e)");
    baris("log(x)",        "logaritma basis 10");
    baris("log2(x)",       "logaritma basis 2");
    baris("logn(x, b)",    "logaritma basis b:  logn(8, 2) = 3");

    judul_seksi("TRIGONOMETRI  (default: derajat — ketik /radian untuk ganti)");
    baris("sin  cos  tan", "sinus, kosinus, tangen");
    baris("cot  sec  csc", "kotangen, sekan, kosekan");
    baris("asin  acos",    "arcsin, arccos — output dalam satuan aktif");
    baris("atan  atan2",   "arctan, atan2(y, x)");
    baris("sinh  cosh  tanh", "hiperbolik dasar");
    baris("asinh acosh atanh", "invers hiperbolik");
    baris("rad(x)  deg(x)", "konversi derajat↔radian");

    judul_seksi("PEMBULATAN & UTILITAS");
    baris("abs(x)",        "nilai mutlak");
    baris("floor(x)",      "bulat ke bawah");
    baris("ceil(x)",       "bulat ke atas");
    baris("round(x)",      "bulat terdekat");
    baris("trunc(x)",      "potong desimal");
    baris("frac(x)",       "bagian desimal:  frac(3.14) = 0.14");
    baris("sign(x)",       "tanda bilangan: -1, 0, atau 1");
    baris("inv(x)",        "resiprokal 1/x");
    baris("clamp(x,lo,hi)","batasi nilai:  clamp(15, 0, 10) = 10");
    baris("lerp(a,b,t)",   "interpolasi linear:  lerp(0, 100, 0.5) = 50");

    judul_seksi("MATEMATIKA LANJUTAN");
    baris("gcd(a, b)",     "FPB:  gcd(48, 36) = 12");
    baris("lcm(a, b)",     "KPK:  lcm(4, 6) = 12");
    baris("hypot(a, b)",   "hipotenusa √(a²+b²):  hypot(3,4) = 5");
    baris("max(a, b)",     "nilai maksimum");
    baris("min(a, b)",     "nilai minimum");
    baris("fak(n)",        "faktorial:  fak(10) = 3_628_800");
    baris("nkr(n, r)",     "kombinasi C(n,r):  nkr(10,3) = 120");
    baris("npr(n, r)",     "permutasi P(n,r):  npr(5,2) = 20");
    baris("gamma(x)",      "fungsi Gamma Γ(x)");

    judul_seksi("KONSTANTA BAWAAN");
    baris("pi",            "π  = 3.141592653589793");
    baris("e",             "e  = 2.718281828459045");
    baris("phi",           "φ  = 1.618033988749895  (rasio emas)");
    baris("tau",           "τ  = 6.283185307179586  (2π)");
    baris("sqrt2",         "√2 = 1.4142135623730951");
    baris("ln2  ln10",     "ln(2), ln(10)");
    baris("eps",           "epsilon mesin f64 = 2.22e-16");

    judul_seksi("VARIABEL");
    baris("x = 3.14",      "simpan nilai ke variabel x");
    baris("y = x * 2",     "gunakan variabel dalam ekspresi");
    baris("ans",           "hasil kalkulasi terakhir (otomatis)");
    baris("vars",          "lihat semua variabel yang tersimpan");

    judul_seksi("FORMAT INPUT");
    baris("0xFF",          "heksadesimal");
    baris("0b1010",        "biner");
    baris("1_000_000",     "separator ribuan (diabaikan)");
    baris("1.5e-9",        "notasi ilmiah");

    judul_seksi("PERINTAH");
    baris("bantuan / ?",   "tampilkan panduan ini");
    baris("riwayat / r",   "lihat 20 kalkulasi terakhir");
    baris("vars",          "lihat semua variabel");
    baris("bersih",        "bersihkan layar");
    baris("/radian",       "mode sudut: radian");
    baris("/derajat",      "mode sudut: derajat (default)");
    baris("keluar / q",    "keluar dari program");

    println!();
    println!("{}", SEP);
    println!();
}

fn tampil_vars(ctx: &Konteks) {
    let builtin = ["pi","e","phi","tau","sqrt2","ln2","ln10","eps","inf","nan"];
    let user_vars: Vec<_> = ctx.vars.iter()
        .filter(|(k, _)| !builtin.contains(&k.as_str()))
        .collect();

    println!();
    println!("  {}{}Variabel Tersimpan{}", BOLD, C_MAGENTA, R);
    println!("{}", SEP);

    if user_vars.is_empty() {
        println!("  {}(belum ada variabel){}", C_GRAY, R);
    } else {
        let mut sorted: Vec<_> = user_vars;
        sorted.sort_by_key(|(k, _)| (*k).clone());
        for (k, v) in sorted {
            let val_str = format_angka(*v);
            println!("  {}{:<14}{} = {}{}{}",
                C_CYAN, k, R,
                C_YELLOW, val_str, R);
        }
    }
    println!();
}

fn tampil_riwayat(riwayat: &[(String, Decimal)]) {
    println!();
    println!("  {}{}Riwayat Kalkulasi{}", BOLD, C_ORANGE, R);
    println!("{}", SEP);

    if riwayat.is_empty() {
        println!("  {}(riwayat kosong){}", C_GRAY, R);
    } else {
        for (i, (expr, hasil)) in riwayat.iter().enumerate() {
            let h = format_angka(*hasil);
            let expr_trim = if expr.len() > 30 {
                format!("{}…", &expr[..29])
            } else {
                expr.clone()
            };
            println!("  {}{:>2}.{}  {}{:<32}{} {}{}{}",
                C_GRAY, i + 1, R,
                C_WHITE, expr_trim, R,
                C_YELLOW, h, R);
        }
    }
    println!();
}

fn tampil_hasil(ekspresi: &str, hasil: Decimal, no: u32, sudut_radian: bool) {
    let val_str = format_angka(hasil);
    let mode = if sudut_radian { "RAD" } else { "DEG" };

    println!();
    println!("  {}#{} [{}]{}", C_GRAY, no, mode, R);
    println!("  {}ekspresi  {}{}", C_GRAY, R, ekspresi);
    println!("  {}hasil     {}{}{}{}",
        C_GRAY, BOLD, C_YELLOW, val_str, R);
    println!();
}

fn tampil_error(pesan: &str) {
    println!();
    println!("  {}{}! error  {}{}{}", BOLD, C_RED, R, C_RED, pesan);
    println!("{}", R);
}

fn tampil_info(pesan: &str) {
    println!("  {}{}>{} {}", BOLD, C_BLUE, R, pesan);
}

fn tampil_sukses_var(nama: &str, nilai: Decimal) {
    println!("  {}ok  {}variabel {}{}{} = {}{}{}",
        C_GREEN, R,
        C_CYAN, nama, R,
        C_YELLOW, format_angka(nilai), R);
    println!();
}

fn tampil_prompt(no: u32, mode: &str) {
    print!("  {}{}[{:03}|{}]{}  ",
        BOLD, C_CYAN, no, mode, R);
    io::stdout().flush().unwrap();
}

// ══════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════
fn main() {
    clear_screen();
    tampil_header();
    tampil_info("bantuan / ?   untuk daftar fungsi lengkap");
    tampil_info("Contoh:  sqrt(2) * pi   sin(30)   nkr(10, 3)   x = 5");
    println!();

    let mut ctx = Konteks::new();
    let mut riwayat: Vec<(String, Decimal)> = Vec::new();
    let mut op_ke: u32 = 1;

    let stdin = io::stdin();

    loop {
        let mode = if ctx.sudut_radian { "RAD" } else { "DEG" };
        tampil_prompt(op_ke, mode);

        let mut input = String::new();
        match stdin.read_line(&mut input) {
            Ok(0) => break,
            Ok(_) => {}
            Err(e) => { tampil_error(&format!("Gagal membaca input: {}", e)); break; }
        }

        let input = input.trim();
        if input.is_empty() { continue; }

        // ── Perintah sistem ────────────────────────────
        match input.to_lowercase().as_str() {
            "keluar" | "exit" | "quit" | "q" => {
                println!();
                println!("{}", SEP);
                println!("  total kalkulasi  {}{}{}{}",
                    BOLD, C_YELLOW, op_ke - 1, R);
                println!("  {}github.com/risqinf/kalkulator{}", C_GRAY, R);
                println!("{}", SEP);
                println!();
                break;
            }
            "bantuan" | "help" | "?" | "h" => {
                tampil_bantuan();
                continue;
            }
            "riwayat" | "history" | "r" => {
                tampil_riwayat(&riwayat);
                continue;
            }
            "vars" | "variabel" | "var" => {
                tampil_vars(&ctx);
                continue;
            }
            "bersih" | "clear" | "cls" => {
                clear_screen();
                tampil_header();
                continue;
            }
            "/radian" | "radian" | "rad" => {
                ctx.sudut_radian = true;
                tampil_info("mode sudut: RADIAN");
                continue;
            }
            "/derajat" | "derajat" | "deg" => {
                ctx.sudut_radian = false;
                tampil_info("mode sudut: DERAJAT");
                continue;
            }
            _ => {}
        }

        // ── Penugasan variabel: "nama = ekspresi" ──────
        if let Some((nama, ekspresi)) = coba_parse_penugasan(input) {
            match hitung(&ekspresi, &mut ctx) {
                Ok(nilai) => {
                    ctx.vars.insert(nama.clone(), nilai);
                    tampil_sukses_var(&nama, nilai);
                }
                Err(e) => tampil_error(&e.to_string()),
            }
            continue;
        }

        // ── Kalkulasi biasa ────────────────────────────
        match hitung(input, &mut ctx) {
            Ok(hasil) => {
                tampil_hasil(input, hasil, op_ke, ctx.sudut_radian);
                // Simpan ke "ans" (bisa dipakai ekspresi berikutnya)
                ctx.vars.insert("ans".into(), hasil);
                // Riwayat maks 20
                if riwayat.len() >= 20 { riwayat.remove(0); }
                riwayat.push((input.to_string(), hasil));
                op_ke += 1;
            }
            Err(e) => {
                tampil_error(&e.to_string());
            }
        }
    }
}
