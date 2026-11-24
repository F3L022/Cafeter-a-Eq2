// /api/contacto
const router = require('express').Router();
const { query } = require('../db');
const { ROLES, requiereRol } = require('../middleware/auth');

// POST /api/contacto   { nombre, correo, telefono?, mensaje }   (público)
router.post('/', async (req, res) => {
    const nombre = String(req.body.nombre || '').trim().slice(0, 100);
    const correo = String(req.body.correo || '').trim().slice(0, 100);
    const telefono = req.body.telefono ? String(req.body.telefono).replace(/\s+/g, '').slice(0, 15) : null;
    const mensaje = String(req.body.mensaje || '').trim().slice(0, 1000);
    if (!nombre || !correo || !mensaje) return res.status(400).json({ error: 'Nombre, correo y mensaje son obligatorios.' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return res.status(400).json({ error: 'El correo no es válido.' });

    await query(`INSERT INTO MensajeContacto (nombre, correo, telefono, mensaje)
                 VALUES (@nombre, @correo, @telefono, @mensaje)`, { nombre, correo, telefono, mensaje });
    res.status(201).json({ ok: true });
});

// GET /api/contacto   → bandeja de mensajes (Admin)
router.get('/', requiereRol(ROLES.ADMIN), async (req, res) => {
    res.json(await query(`SELECT id_mensaje AS id, nombre, correo, telefono, mensaje, fecha_envio, leido
                          FROM MensajeContacto ORDER BY fecha_envio DESC`));
});

// PATCH /api/contacto/:id/leido
router.patch('/:id/leido', requiereRol(ROLES.ADMIN), async (req, res) => {
    await query('UPDATE MensajeContacto SET leido = 1 WHERE id_mensaje = @id', { id: parseInt(req.params.id, 10) });
    res.json({ ok: true });
});

module.exports = router;
