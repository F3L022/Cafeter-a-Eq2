// /api/inventario  (Dueño: su sucursal · Admin: todo)
const router = require('express').Router();
const { query, transaccion } = require('../db');
const { ROLES, requiereRol, cargarSucursal } = require('../middleware/auth');

router.use(requiereRol(ROLES.DUENO, ROLES.ADMIN), cargarSucursal);

const ESTADOS = ['Agotado', 'Poco', 'OK'];

// GET /api/inventario
router.get('/', async (req, res) => {
    const params = {};
    let filtro = '';
    if (req.sucursal) { filtro = ' AND p.id_sucursal = @suc'; params.suc = req.sucursal.id_sucursal; }
    const filas = await query(`
        SELECT i.id_inventario AS id, p.id_producto, p.nombre, i.cantidad, i.stock_minimo AS minimo,
               p.precio, i.estado, i.fecha_actualizacion
        FROM Inventario i JOIN Producto p ON p.id_producto = i.id_producto
        WHERE p.activo = 1${filtro}
        ORDER BY p.nombre`, params);
    filas.forEach(f => { f.estado_texto = ESTADOS[f.estado]; });
    res.json(filas);
});

function leerNumeros(body) {
    const cantidad = parseInt(body.cantidad, 10);
    const minimo = parseInt(body.minimo, 10);
    const precio = Number(body.precio);
    if (!(cantidad >= 0) || !(minimo >= 0) || !(precio >= 0)) {
        throw { status: 400, error: 'Cantidad, stock mínimo y precio deben ser números positivos.' };
    }
    return { cantidad, minimo, precio };
}

// Busca el producto (activo) por nombre dentro de la sucursal del dueño
async function buscarProductoPorNombre(req, nombre) {
    const params = { nombre };
    let filtro = '';
    if (req.sucursal) { filtro = ' AND id_sucursal = @suc'; params.suc = req.sucursal.id_sucursal; }
    const f = await query(`SELECT TOP 1 id_producto FROM Producto WHERE activo = 1 AND nombre = @nombre${filtro}`, params);
    return f[0] || null;
}

// POST /api/inventario   { nombre, cantidad, minimo, precio }
// El producto debe existir (se da de alta en PRODUCTOS). Si ya tiene inventario se actualiza.
router.post('/', async (req, res) => {
    const nombre = String(req.body.nombre || '').trim();
    const n = leerNumeros(req.body);
    const prod = await buscarProductoPorNombre(req, nombre);
    if (!prod) return res.status(404).json({ error: 'El producto "' + nombre + '" no existe. Primero dalo de alta en PRODUCTOS.' });

    await transaccion(async (q) => {
        await q(`
            MERGE Inventario AS t
            USING (SELECT @id AS id_producto) AS s ON t.id_producto = s.id_producto
            WHEN MATCHED THEN UPDATE SET cantidad = @cantidad, stock_minimo = @minimo, fecha_actualizacion = GETDATE()
            WHEN NOT MATCHED THEN INSERT (id_producto, cantidad, stock_minimo) VALUES (@id, @cantidad, @minimo);`,
            { id: prod.id_producto, cantidad: n.cantidad, minimo: n.minimo });
        await q('UPDATE Producto SET precio = @precio WHERE id_producto = @id', { id: prod.id_producto, precio: n.precio });
    });
    res.status(201).json({ ok: true });
});

// Revisa que el registro de inventario sea de la sucursal del dueño
async function inventarioPropio(req, id) {
    const f = await query(`SELECT i.id_inventario, p.id_producto, p.id_sucursal
                           FROM Inventario i JOIN Producto p ON p.id_producto = i.id_producto
                           WHERE i.id_inventario = @id`, { id });
    if (!f.length) throw { status: 404, error: 'Registro de inventario no encontrado.' };
    if (req.sucursal && f[0].id_sucursal !== req.sucursal.id_sucursal) throw { status: 403, error: 'Ese producto no es de tu sucursal.' };
    return f[0];
}

// PUT /api/inventario/:id   { nombre?, cantidad, minimo, precio }
router.put('/:id', async (req, res) => {
    const reg = await inventarioPropio(req, parseInt(req.params.id, 10));
    const n = leerNumeros(req.body);
    const nombre = req.body.nombre ? String(req.body.nombre).trim() : null;

    await transaccion(async (q) => {
        await q(`UPDATE Inventario SET cantidad = @cantidad, stock_minimo = @minimo, fecha_actualizacion = GETDATE()
                 WHERE id_inventario = @id`, { id: reg.id_inventario, cantidad: n.cantidad, minimo: n.minimo });
        await q(`UPDATE Producto SET precio = @precio, nombre = COALESCE(@nombre, nombre), fecha_accion = GETDATE()
                 WHERE id_producto = @idp`, { idp: reg.id_producto, precio: n.precio, nombre });
    });
    res.json({ ok: true });
});

// DELETE /api/inventario/:id   → quita el control de inventario (el producto sigue en el menú)
router.delete('/:id', async (req, res) => {
    const reg = await inventarioPropio(req, parseInt(req.params.id, 10));
    await query('DELETE FROM Inventario WHERE id_inventario = @id', { id: reg.id_inventario });
    res.json({ ok: true });
});

module.exports = router;
