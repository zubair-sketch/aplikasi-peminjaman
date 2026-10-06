const express = require('express');
const mysql = require('mysql2');
const path = require('path');

const app = express();

// Middleware parsing data dari form / JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Menyajikan file statis dari folder 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Koneksi Database dengan MySQL Pool & SSL
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

// Routing Halaman Utama
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Get Data Barang
app.get('/api/barang', (req, res) => {
  db.query('SELECT * FROM barang', (err, results) => {
    if (err) {
      console.error('Error DB:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json(results);
  });
});

// API Tambah Barang (Auto-generate ID & QR Code)
app.post('/api/barang', (req, res) => {
  // Ambil data dari req.body dengan nilai default jika kosong
  const id = req.body.id || 'BRG-' + Date.now();
  const nama = req.body.nama || '';
  const kategori = req.body.kategori || '';
  const status = req.body.status || 'tersedia';
  const qr_code = req.body.qr_code || id;

  if (!nama || !kategori) {
    return res.status(400).json({ 
      success: false, 
      message: 'Nama dan Kategori tidak boleh kosong!' 
    });
  }

  const query = 'INSERT INTO barang (id, nama, kategori, status, qr_code) VALUES (?, ?, ?, ?, ?)';

  db.query(query, [id, nama, kategori, status, qr_code], (err, result) => {
    if (err) {
      console.error('MySQL Error:', err.message);
      // Kirim detail error MySQL ke frontend agar mudah ditelusuri
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, message: 'Barang berhasil ditambahkan', id });
  });
});

// Wajib mengekspor app untuk Vercel Serverless
module.exports = app;