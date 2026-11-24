// Verifica el token de sesión (JWT) que manda el navegador en el header Authorization
const jwt = require('jsonwebtoken');
const { query } = require('../db');

const SECRETO = process.env.JWT_SECRET || 'cafe-central-secreto-dev';

const ROLES = {
    ADMIN: 'Administrador',
    DUENO: 'Dueño de Local',
    COMPRADOR: 'Comprador'
};

// Convierte el nombre del rol que viene de la BD al nombre "oficial" que usa el código.
// Así funciona aunque en la BD los acentos se hayan guardado mal (ej. "DueÃ±o de Local").
function rolCanonico(nombre) {
    const clave = String(nombre || '').toLowerCase().replace(/[^a-z]/g, '');
    if (clave.startsWith('admin')) return ROLES.ADMIN;
    if (clave.startsWith('due')) return ROLES.DUENO;
    if (clave.startsWith('compra') || clave.startsWith('cliente')) return ROLES.COMPRADOR;
    return nombre;
}

// Busca el id_rol en la tabla Rol a partir del nombre oficial del rol
async function idDeRol(rol) {
    const roles = await query('SELECT id_rol, nombre FROM Rol');
    const r = roles.find(x => rolCanonico(x.nombre) === rolCanonico(rol));
    return r ? r.id_rol : null;
}

function crearToken(usuario) {
    return jwt.sign(
        { id: usuario.id, correo: usuario.correo, rol: usuario.rol, nombre: usuario.nombre },
        SECRETO,
        { expiresIn: '8h' }
    );
}

// Obliga a que haya sesión iniciada
function requiereSesion(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Debes iniciar sesión.' });
    try {
        req.usuario = jwt.verify(token, SECRETO);
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Tu sesión expiró. Vuelve a iniciar sesión.' });
    }
}

// Obliga a que el usuario tenga alguno de los roles indicados
function requiereRol(...roles) {
    return [requiereSesion, (req, res, next) => {
        if (!roles.includes(req.usuario.rol)) {
            return res.status(403).json({ error: 'No tienes permiso para hacer esto.' });
        }
        next();
    }];
}

// Devuelve la sucursal del dueño que hizo la petición (o null)
async function sucursalDelDueno(idUsuario) {
    const filas = await query(
        'SELECT TOP 1 * FROM Sucursal WHERE id_dueno = @id ORDER BY id_sucursal',
        { id: idUsuario }
    );
    return filas[0] || null;
}

// Para rutas de dueño: deja en req.sucursal su sucursal. El admin puede ver todo (req.sucursal = null).
async function cargarSucursal(req, res, next) {
    if (req.usuario.rol === ROLES.ADMIN) { req.sucursal = null; return next(); }
    const suc = await sucursalDelDueno(req.usuario.id);
    if (!suc) return res.status(403).json({ error: 'Tu usuario no tiene una sucursal asignada.' });
    req.sucursal = suc;
    next();
}

module.exports = { ROLES, rolCanonico, idDeRol, crearToken, requiereSesion, requiereRol, cargarSucursal, sucursalDelDueno };
