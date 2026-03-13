Repository ini kemungkinan adalah sandbox atau project eksperimen untuk mencoba fitur, package, atau sekadar belajar bahasa pemrograman Go (Golang). 
Langkah-Langkah
Pastikan kamu sudah install Go di komputermu. Kalau belum, bisa cek go version di terminal.
1. Clone & Masuk ke Folder
Ambil reponya dari Git dan masuk ke direktorinya.
git clone https://github.com/IMPHNEN/Ramadhan-Code-Fest-2026.git
cd Ramadhan-Code-Fest-2026/rhan-nyoba-golang

2. Siapkan Dependencies
Kalau di dalam repo ada file go.mod, pastikan semua library yang dibutuhkan sudah terunduh.
go mod tidy

3. Build
Perintah ini akan mengkompilasi source code menjadi file executable yang siap jalan.
# Build standar (nama file output biasanya sama dengan nama folder/modul)
go build

# Atau build dengan nama output custom (misal: rhan_app)
go build -o rhan_app main.go

4. Install
Langkah ini opsional. Kalau kamu mau file executable tadi terpasang di sistem (masuk ke direktori $GOPATH/bin) supaya aplikasinya bisa dipanggil langsung dari terminal di mana saja:
go install

5. Jalanin (Run)
Ada dua cara santai buat ngejalanin programnya:
# Cara 1: Eksekusi langsung dari source code (paling enak buat proses development)
go run main.go

# Cara 2: Jalanin file executable dari hasil "go build" di langkah 3
./rhan_app   # (Kalau di Windows jalankan rhan_app.exe)

Ada struktur folder spesifik atau error yang muncul pas kamu coba run?
