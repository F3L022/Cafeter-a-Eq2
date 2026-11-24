// /api/sucursal  →  "Mi Información" del dueño
const router = require('express').Router();
const { query } = require('../db');
const { ROLES, requiereRol, cargarSucursal } = require('../middleware/auth');

const CAMPOS = `id_sucursal AS id, nombre, direccion, telefono, descripcion`;

// GET /api/sucursal   (público: datos de las sucursales para el ticket, "sobre nosotros", etc.)
router.get('/', async (req, res) => {
    res.json(await query(`SELECT ${CAMPOS} FROM Sucursal ORDER BY id_sucursal`));
});

// GET /api/sucursal/mia
router.get('/mia', requiereRol(ROLES.DUENO), cargarSucursal, async (req, res) => {
    const s = req.sucursal;
    res.json({ id: s.id_sucursal, nombre: s.nombre, direccion: s.direccion, telefono: s.telefono, descripcion: s.descripcion });
});

// PUT /api/sucursal/mia   { nombre, direccion, telefono, descripcion }
router.put('/mia', requiereRol(ROLES.DUENO), cargarSucursal, async (req, res) => {
    const nombre = String(req.body.nombre || '').trim();
    const direccion = String(req.body.direccion || '').trim();
    const telefono = String(req.body.telefono || '').replace(/\s+/g, '').slice(0, 15);
    const descripcion = req.body.descripcion ? String(req.body.descripcion).trim().slice(0, 500) : null;
    if (!nombre || !direccion || !telefono) {
        return res.status(400).json({ error: 'Nombre, dirección y teléfono son obligatorios.' });
    }
    const f = await query(`
        UPDATE Sucursal SET nombre = @nombre, direccion = @direccion, telefono = @telefono, descripcion = @descripcion
        OUTPUT INSERTED.id_sucursal AS id, INSERTED.nombre, INSERTED.direccion, INSERTED.telefono, INSERTED.descripcion
        WHERE id_sucursal = @id`,
        { id: req.sucursal.id_sucursal, nombre, direccion, telefono, descripcion });
    res.json(f[0]);
});

module.exports = router;
