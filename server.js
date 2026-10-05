const express = require('express');
const QRCode = require('qrcode');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public')); // Menyajikan file tampilan frontend

// Konfigurasi Koneksi MySQL (Mendukung XAMPP Lokal & Cloud Hosting)
const mysql = require('mysql2');

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const path = require('path');

// Menyajikan file statis dari folder 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Mengarahkan halaman utama (/) ke index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ====================================================
// 1. FITUR CRUD BARANG
// ====================================================

// Tambah Barang Baru & Generate QR
app.post('/api/barang', (req, res) => {
  const { id, nama, kategori, status, qr_code } = req.body;
  
  const query = 'INSERT INTO barang (id, nama, kategori, status, qr_code) VALUES (?, ?, ?, ?, ?)';
  
  db.query(query, [id, nama, kategori, status || 'tersedia', qr_code], (err, result) => {
    if (err) {
      console.error('Error DB:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, message: 'Barang berhasil ditambahkan' });
  });
});

// Ambil Semua Daftar Barang
app.get('/api/barang', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM barang ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ pesan: 'Gagal mengambil data barang', error: err.message });
    }
});

// Hapus Barang
app.delete('/api/barang/:id', async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM barang WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ pesan: 'Barang tidak ditemukan' });
        }
        res.json({ pesan: 'Barang berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ pesan: 'Gagal menghapus barang', error: err.message });
    }
});

// ====================================================
// 2. FITUR PEMINJAMAN & PENGEMBALIAN VIA SCAN QR
// ====================================================

// Transaksi Peminjaman
app.post('/api/pinjam', async (req, res) => {
    const { barangId, peminjam } = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [barangRows] = await connection.execute('SELECT * FROM barang WHERE id = ? FOR UPDATE', [barangId]);
        if (barangRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ pesan: 'Barang tidak ditemukan' });
        }

        const barang = barangRows[0];
        if (barang.status === 'dipinjam') {
            await connection.rollback();
            return res.status(400).json({ pesan: 'Barang sedang dipinjam' });
        }

        await connection.execute('UPDATE barang SET status = "dipinjam" WHERE id = ?', [barangId]);

        const trxId = `TRX-${Date.now()}`;
        await connection.execute(
            'INSERT INTO peminjaman (id, barang_id, peminjam, status) VALUES (?, ?, ?, "aktif")',
            [trxId, barangId, peminjam]
        );

        await connection.commit();
        res.status(201).json({ pesan: 'Peminjaman berhasil dicatat' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ pesan: 'Gagal memproses peminjaman', error: err.message });
    } finally {
        connection.release();
    }
});

// Transaksi Pengembalian
app.post('/api/kembali', async (req, res) => {
    const { barangId } = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [barangRows] = await connection.execute('SELECT * FROM barang WHERE id = ? FOR UPDATE', [barangId]);
        if (barangRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ pesan: 'Barang tidak ditemukan' });
        }

        const barang = barangRows[0];
        if (barang.status === 'tersedia') {
            await connection.rollback();
            return res.status(400).json({ pesan: 'Barang sudah berada di inventaris' });
        }

        await connection.execute('UPDATE barang SET status = "tersedia" WHERE id = ?', [barangId]);
        await connection.execute(
            'UPDATE peminjaman SET tanggal_kembali = NOW(), status = "selesai" WHERE barang_id = ? AND status = "aktif"',
            [barangId]
        );

        await connection.commit();
        res.json({ pesan: 'Pengembalian barang berhasil' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ pesan: 'Gagal memproses pengembalian', error: err.message });
    } finally {
        connection.release();
    }
});

app.listen(PORT, () => {
    console.log(`Server berjalan di fetch('/api/barang'):${PORT}`);
    module.exports = app;
});