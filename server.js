// Café Central - Servidor Node.js (Express + SQL Server)
// Ejecutar:  npm install   y luego   npm start   →  http://localhost:3000
require('dotenv').config();
const path = require('path');
const express = require('express');
const { getPool } = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ---------- API ----------
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/usuarios', require('./src/routes/usuarios'));
app.use('/api/categorias', require('./src/routes/categorias'));
app.use('/api/productos', require('./src/routes/productos'));
app.use('/api/inventario', require('./src/routes/inventario'));
app.use('/api/pedidos', require('./src/routes/pedidos'));
app.use('/api/carrito', require('./src/routes/carrito'));
app.use('/api/sucursal', require('./src/routes/sucursal'));
app.use('/api/contacto', require('./src/routes/contacto'));

// Prueba rápida de conexión: http://localhost:3000/api/salud
app.get('/api/salud', async (req, res) => {
    try {
        await (await getPool()).request().query('SELECT 1 AS ok');
        res.json({ servidor: 'ok', baseDeDatos: 'ok' });
    } catch (e) {
        res.status(500).json({ servidor: 'ok', baseDeDatos: 'error', detalle: e.message });
    }
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada: ' + req.method + ' ' + req.originalUrl }));

// ---------- Páginas (frontend) ----------
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Manejo de errores ----------
app.use((err, req, res, next) => {
    // Errores "esperados" que lanzamos en las rutas:  throw { status: 400, error: '...' }
    if (err && err.status && err.error) return res.status(err.status).json({ error: err.error });
    // JSON mal formado
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON no válido.' });

    console.error(err);
    const sinConexion = err && (err.code === 'ESOCKET' || err.code === 'ELOGIN' || err.code === 'ETIMEOUT' || err.code === 'EINSTLOOKUP');
    res.status(500).json({
        error: sinConexion
            ? 'No se pudo conectar a la base de datos. Revisa el archivo .env y que SQL Server esté encendido.'
            : 'Error interno del servidor.'
    });
});

app.listen(PORT, () => {
    console.log('☕ Café Central corriendo en http://localhost:' + PORT);
    getPool().catch(e => console.error('✖ No se pudo conectar a SQL Server:', e.message));
});
