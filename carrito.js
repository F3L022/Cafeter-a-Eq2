// /api/carrito
const router = require('express').Router();
const { query } = require('../db');
const { ROLES, requiereRol, sucursalDelDueno } = require('../middleware/auth');

const ITEMS_SQL = `
    SELECT cd.id_producto, p.nombre, p.precio, cd.cantidad
    FROM Carrito c
    JOIN CarritoDetalle cd ON cd.id_carrito = c.id_carrito
    JOIN Producto p ON p.id_producto = cd.id_producto
    WHERE c.id_usuario = @uid AND p.activo = 1
    ORDER BY p.nombre`;

// GET /api/carrito/todos   → carritos abiertos de todos los clientes (Dueño / Admin)
router.get('/todos', requiereRol(ROLES.DUENO, ROLES.ADMIN), async (req, res) => {
    const params = {};
    let filtro = '';
    if (req.usuario.rol === ROLES.DUENO) {
        const suc = await sucursalDelDueno(req.usuario.id);
        filtro = ' AND p.id_sucursal = @suc';
        params.suc = suc ? suc.id_sucursal : -1;
    }
    const filas = await query(`
        SELECT u.id_usuario, u.correo, u.nombre_completo AS nombre, p.id_producto, p.nombre AS producto, p.precio, cd.cantidad
        FROM Carrito c
        JOIN Usuario u ON u.id_usuario = c.id_usuario
        JOIN CarritoDetalle cd ON cd.id_carrito = c.id_carrito
        JOIN Producto p ON p.id_producto = cd.id_producto
        WHERE p.activo = 1${filtro}
        ORDER BY u.nombre_completo, p.nombre`, params);

    const porUsuario = {};
    filas.forEach(f => {
        if (!porUsuario[f.id_usuario]) porUsuario[f.id_usuario] = { correo: f.correo, nombre: f.nombre, items: [] };
        porUsuario[f.id_usuario].items.push({ id_producto: f.id_producto, nombre: f.producto, precio: f.precio, cantidad: f.cantidad });
    });
    res.json(Object.values(porUsuario));
});

// ---- El resto es del Comprador (su propio carrito) ----
router.use(requiereRol(ROLES.COMPRADOR));

async function idCarrito(uid) {
    const f = await query(`
        IF NOT EXISTS (SELECT 1 FROM Carrito WHERE id_usuario = @uid)
            INSERT INTO Carrito (id_usuario) VALUES (@uid);
        SELECT id_carrito FROM Carrito WHERE id_usuario = @uid;`, { uid });
    return f[0].id_carrito;
}

async function enviarCarrito(req, res) {
    res.json(await query(ITEMS_SQL, { uid: req.usuario.id }));
}

// GET /api/carrito
router.get('/', enviarCarrito);

// POST /api/carrito/items   { id_producto | nombre, cantidad? (default 1) }  → suma al carrito
router.post('/items', async (req, res) => {
    const cantidad = parseInt(req.body.cantidad || 1, 10);
    if (!(cantidad > 0)) return res.status(400).json({ error: 'Cantidad no válida.' });

    const prod = await query(`
        SELECT TOP 1 id_producto FROM Producto
        WHERE activo = 1 AND (id_producto = @id OR nombre = @nombre)`,
        { id: parseInt(req.body.id_producto, 10) || 0, nombre: String(req.body.nombre || '') });
    if (!prod.length) return res.status(404).json({ error: 'Ese producto no está disponible.' });

    const carrito = await idCarrito(req.usuario.id);
    await query(`
        MERGE CarritoDetalle AS t
        USING (SELECT @car AS id_carrito, @prod AS id_producto) AS s
           ON t.id_carrito = s.id_carrito AND t.id_producto = s.id_producto
        WHEN MATCHED THEN UPDATE SET cantidad = t.cantidad + @cant
        WHEN NOT MATCHED THEN INSERT (id_carrito, id_producto, cantidad) VALUES (@car, @prod, @cant);`,
        { car: carrito, prod: prod[0].id_producto, cant: cantidad });
    await enviarCarrito(req, res);
});

// PUT /api/carrito/items/:idProducto   { cantidad }   → 0 o menos lo quita
router.put('/items/:idProducto', async (req, res) => {
    const prod = parseInt(req.params.idProducto, 10);
    const cantidad = parseInt(req.body.cantidad, 10) || 0;
    const carrito = await idCarrito(req.usuario.id);
    if (cantidad <= 0) {
        await query('DELETE FROM CarritoDetalle WHERE id_carrito = @car AND id_producto = @prod', { car: carrito, prod });
    } else {
        await query('UPDATE CarritoDetalle SET cantidad = @cant WHERE id_carrito = @car AND id_producto = @prod',
            { car: carrito, prod, cant: cantidad });
    }
    await enviarCarrito(req, res);
});

// DELETE /api/carrito   → vaciar
router.delete('/', async (req, res) => {
    const carrito = await idCarrito(req.usuario.id);
    await query('DELETE FROM CarritoDetalle WHERE id_carrito = @car', { car: carrito });
    res.json([]);
});

module.exports = router;
