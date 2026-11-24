// /api/usuarios  →  gestión de usuarios (solo Administrador)
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { ROLES, rolCanonico, idDeRol, requiereRol } = require('../middleware/auth');

router.use(requiereRol(ROLES.ADMIN));

// GET /api/usuarios
router.get('/', async (req, res) => {
    const filas = await query(`
        SELECT u.id_usuario AS id, u.nombre_completo AS nombre, u.correo, u.telefono,
               r.nombre AS rol, u.activo, u.fecha_registro
        FROM Usuario u JOIN Rol r ON r.id_rol = u.id_rol
        ORDER BY u.id_usuario`);
    filas.forEach(f => { f.rol = rolCanonico(f.rol); f.yo = f.id === req.usuario.id; });
    res.json(filas);
});

// POST /api/usuarios   { nombre, correo, rol, contrasena, telefono? }
router.post('/', async (req, res) => {
    const nombre = String(req.body.nombre || '').trim();
    const correo = String(req.body.correo || '').trim().toLowerCase();
    const rol = String(req.body.rol || '');
    const contrasena = String(req.body.contrasena || '');
    const telefono = req.body.telefono ? String(req.body.telefono).trim() : null;

    if (!nombre || !correo || !rol) return res.status(400).json({ error: 'Nombre, correo y tipo de usuario son obligatorios.' });
    if (contrasena.length < 4) return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres.' });

    const existe = await query('SELECT 1 AS x FROM Usuario WHERE LOWER(correo) = @correo', { correo });
    if (existe.length) return res.status(409).json({ error: 'Ya existe un usuario con ese correo.' });

    const idRol = await idDeRol(rol);
    if (!idRol) return res.status(400).json({ error: 'Tipo de usuario no válido.' });

    const hash = await bcrypt.hash(contrasena, 10);
    const filas = await query(`
        INSERT INTO Usuario (id_rol, nombre_completo, correo, contrasena_hash, telefono)
        OUTPUT INSERTED.id_usuario AS id
        VALUES (@idRol, @nombre, @correo, @hash, @telefono)`,
        { nombre, correo, hash, telefono, idRol });

    res.status(201).json({ id: filas[0].id, nombre, correo, rol: rolCanonico(rol), activo: true });
});

// PATCH /api/usuarios/:id/estado   { activo: true|false }   → dar de alta / baja
router.patch('/:id/estado', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const activo = req.body.activo ? 1 : 0;
    if (id === req.usuario.id && !activo) {
        return res.status(400).json({ error: 'No puedes darte de baja a ti mismo.' });
    }
    if (!activo) {
        // Que nunca se quede el sistema sin ningún administrador activo
        const usuarios = await query(`SELECT u.id_usuario, u.activo, r.nombre AS rol
                                      FROM Usuario u JOIN Rol r ON r.id_rol = u.id_rol`);
        const objetivo = usuarios.find(u => u.id_usuario === id);
        const adminsActivos = usuarios.filter(u => u.activo && rolCanonico(u.rol) === ROLES.ADMIN);
        if (objetivo && rolCanonico(objetivo.rol) === ROLES.ADMIN && adminsActivos.length <= 1) {
            return res.status(400).json({ error: 'No se puede dar de baja al único administrador activo.' });
        }
    }
    const filas = await query(`
        UPDATE Usuario SET activo = @activo OUTPUT INSERTED.id_usuario AS id, INSERTED.activo
        WHERE id_usuario = @id`, { id, activo });
    if (!filas.length) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json(filas[0]);
});

module.exports = router;
