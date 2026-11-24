// /api/productos
const router = require('express').Router();
const { query, transaccion } = require('../db');
const { ROLES, requiereRol, cargarSucursal } = require('../middleware/auth');

const SELECT_PRODUCTO = `
    SELECT p.id_producto AS id, p.nombre, p.descripcion, p.precio, p.imagen_url,
           c.nombre AS categoria, p.id_categoria, p.id_sucursal, s.nombre AS sucursal,
           i.cantidad AS existencia, i.stock_minimo
    FROM Producto p
    JOIN Categoria c ON c.id_categoria = p.id_categoria
    JOIN Sucursal s ON s.id_sucursal = p.id_sucursal
    LEFT JOIN Inventario i ON i.id_producto = p.id_producto
    WHERE p.activo = 1`;

// GET /api/productos?categoria=Cafés   (público: el menú)
router.get('/', async (req, res) => {
    const params = {};
    let filtro = '';
    if (req.query.categoria) { filtro = ' AND c.nombre = @categoria'; params.categoria = String(req.query.categoria); }
    res.json(await query(SELECT_PRODUCTO + filtro + ' ORDER BY c.id_categoria, p.nombre', params));
});

// ---- A partir de aquí solo Dueño (su sucursal) o Admin (todo) ----
const soloDueno = [...requiereRol(ROLES.DUENO, ROLES.ADMIN), cargarSucursal];

// GET /api/productos/mios
router.get('/mios', soloDueno, async (req, res) => {
    if (!req.sucursal) return res.json(await query(SELECT_PRODUCTO + ' ORDER BY p.id_producto'));
    res.json(await query(SELECT_PRODUCTO + ' AND p.id_sucursal = @suc ORDER BY p.id_producto',
        { suc: req.sucursal.id_sucursal }));
});

// Valida los datos del formulario y busca la categoría por nombre o id
async function leerDatos(body) {
    const nombre = String(body.nombre || '').trim();
    const precio = Number(body.precio);
    if (!nombre) throw { status: 400, error: 'El nombre del producto es obligatorio.' };
    if (!isFinite(precio) || precio < 0) throw { status: 400, error: 'El precio no puede ser negativo.' };

    const cat = await query(
        'SELECT id_categoria FROM Categoria WHERE nombre = @c OR CAST(id_categoria AS NVARCHAR(10)) = @c',
        { c: String(body.categoria || body.id_categoria || '') });
    if (!cat.length) throw { status: 400, error: 'La categoría no existe.' };

    return {
        nombre, precio, id_categoria: cat[0].id_categoria,
        descripcion: body.descripcion ? String(body.descripcion) : null,
        imagen_url: body.imagen_url ? String(body.imagen_url) : null
    };
}

async function nombreRepetido(nombre, idSucursal, idExcluir = 0) {
    const f = await query(`SELECT 1 AS x FROM Producto WHERE activo = 1 AND nombre = @nombre
                           AND id_sucursal = @suc AND id_producto <> @id`,
        { nombre, suc: idSucursal, id: idExcluir });
    return f.length > 0;
}

// Revisa que el producto exista y sea de la sucursal del dueño
async function productoPropio(req, id) {
    const f = await query('SELECT * FROM Producto WHERE id_producto = @id AND activo = 1', { id });
    if (!f.length) throw { status: 404, error: 'Producto no encontrado.' };
    if (req.sucursal && f[0].id_sucursal !== req.sucursal.id_sucursal) throw { status: 403, error: 'Ese producto no es de tu sucursal.' };
    return f[0];
}

// POST /api/productos   { nombre, precio, categoria, descripcion?, imagen_url?, id_sucursal? (admin) }
router.post('/', soloDueno, async (req, res) => {
    const d = await leerDatos(req.body);
    const idSucursal = req.sucursal ? req.sucursal.id_sucursal : parseInt(req.body.id_sucursal || 1, 10);
    if (await nombreRepetido(d.nombre, idSucursal)) return res.status(409).json({ error: 'Ya tienes un producto con ese nombre.' });

    const nuevo = await transaccion(async (q) => {
        const f = await q(`
            INSERT INTO Producto (id_sucursal, id_categoria, nombre, descripcion, precio, imagen_url, accion)
            OUTPUT INSERTED.id_producto AS id
            VALUES (@suc, @cat, @nombre, @descripcion, @precio, @imagen_url, 1)`,
            { suc: idSucursal, cat: d.id_categoria, nombre: d.nombre, descripcion: d.descripcion, precio: d.precio, imagen_url: d.imagen_url });
        // Cada producto nuevo entra al inventario con 0 piezas
        await q('INSERT INTO Inventario (id_producto, cantidad, stock_minimo) VALUES (@id, 0, 5)', { id: f[0].id });
        return f[0];
    });
    res.status(201).json(nuevo);
});

// PUT /api/productos/:id
router.put('/:id', soloDueno, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const actual = await productoPropio(req, id);
    const d = await leerDatos(req.body);
    if (await nombreRepetido(d.nombre, actual.id_sucursal, id)) return res.status(409).json({ error: 'Ya tienes un producto con ese nombre.' });

    await query(`
        UPDATE Producto SET nombre = @nombre, precio = @precio, id_categoria = @cat,
               descripcion = COALESCE(@descripcion, descripcion), imagen_url = COALESCE(@imagen_url, imagen_url),
               fecha_accion = GETDATE()
        WHERE id_producto = @id`,
        { id, nombre: d.nombre, precio: d.precio, cat: d.id_categoria, descripcion: d.descripcion, imagen_url: d.imagen_url });
    res.json({ ok: true });
});

// DELETE /api/productos/:id   → baja lógica (los pedidos viejos lo siguen referenciando)
router.delete('/:id', soloDueno, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await productoPropio(req, id);
    await transaccion(async (q) => {
        await q('UPDATE Producto SET activo = 0, accion = 2, fecha_accion = GETDATE() WHERE id_producto = @id', { id });
        await q('DELETE FROM CarritoDetalle WHERE id_producto = @id', { id });
    });
    res.json({ ok: true });
});

module.exports = router;
