// /api/pedidos
const router = require('express').Router();
const { query, transaccion } = require('../db');
const { ROLES, requiereSesion, requiereRol, sucursalDelDueno } = require('../middleware/auth');

router.use(requiereSesion);

const ESTADOS = { 'Pendiente': 1, 'En preparación': 2, 'Entregado': 3, 'Cancelado': 4 };
// El nombre del estado sale del id (no del texto de la BD) para que no fallen los acentos
const NOMBRE_ESTADO = { 1: 'Pendiente', 2: 'En preparación', 3: 'Entregado', 4: 'Cancelado' };

// Filtro según el rol: el comprador ve los suyos, el dueño los de su sucursal, el admin todos
async function filtroPorRol(usuario) {
    if (usuario.rol === ROLES.COMPRADOR) return { sql: ' AND p.id_cliente = @uid', params: { uid: usuario.id } };
    if (usuario.rol === ROLES.DUENO) {
        const suc = await sucursalDelDueno(usuario.id);
        return { sql: ' AND p.id_sucursal = @suc', params: { suc: suc ? suc.id_sucursal : -1 } };
    }
    return { sql: '', params: {} };
}

// Trae pedidos con sus productos, con la misma forma que usaba el frontend
async function buscarPedidos(usuario, extraSql = '', extraParams = {}) {
    const f = await filtroPorRol(usuario);
    const params = { ...f.params, ...extraParams };
    const pedidos = await query(`
        SELECT p.id_pedido AS id, u.correo, u.nombre_completo AS cliente, p.fecha_hora AS fecha,
               p.id_estado, p.total, p.notas, p.metodo_pago AS pago,
               s.nombre AS sucursal, s.direccion AS sucursal_direccion, s.telefono AS sucursal_telefono
        FROM Pedido p
        JOIN Usuario u ON u.id_usuario = p.id_cliente
        JOIN EstadoPedido e ON e.id_estado = p.id_estado
        JOIN Sucursal s ON s.id_sucursal = p.id_sucursal
        WHERE 1 = 1${f.sql}${extraSql}
        ORDER BY p.id_pedido DESC`, params);
    if (!pedidos.length) return [];

    const detalles = await query(`
        SELECT d.id_pedido, d.id_producto, d.nombre_producto AS nombre, d.precio_unitario AS precio, d.cantidad
        FROM DetallePedido d
        JOIN Pedido p ON p.id_pedido = d.id_pedido
        JOIN EstadoPedido e ON e.id_estado = p.id_estado
        WHERE 1 = 1${f.sql}${extraSql}
        ORDER BY d.id_detalle`, params);

    const porId = {};
    pedidos.forEach(p => { p.estado = NOMBRE_ESTADO[p.id_estado]; delete p.id_estado; p.items = []; porId[p.id] = p; });
    detalles.forEach(d => {
        if (porId[d.id_pedido]) porId[d.id_pedido].items.push({ id_producto: d.id_producto, nombre: d.nombre, precio: d.precio, cantidad: d.cantidad });
    });
    return pedidos;
}

// GET /api/pedidos?estado=Pendiente
router.get('/', async (req, res) => {
    if (req.query.estado) {
        return res.json(await buscarPedidos(req.usuario, ' AND p.id_estado = @estado', { estado: ESTADOS[req.query.estado] || 0 }));
    }
    res.json(await buscarPedidos(req.usuario));
});

// GET /api/pedidos/:id
router.get('/:id', async (req, res) => {
    const lista = await buscarPedidos(req.usuario, ' AND p.id_pedido = @id', { id: parseInt(req.params.id, 10) || 0 });
    if (!lista.length) return res.status(404).json({ error: 'No se encontró el pedido.' });
    res.json(lista[0]);
});

// POST /api/pedidos   { notas?, pago? }   → convierte el carrito del comprador en pedido
router.post('/', requiereRol(ROLES.COMPRADOR), async (req, res) => {
    const notas = req.body.notas ? String(req.body.notas).slice(0, 300) : null;
    const pago = ['Efectivo', 'Tarjeta', 'Transferencia'].includes(req.body.pago) ? req.body.pago : 'Efectivo';

    const idPedido = await transaccion(async (q) => {
        // Precio y existencia se toman de la BD (no del navegador)
        const items = await q(`
            SELECT cd.id_producto, cd.cantidad, pr.nombre, pr.precio, pr.id_sucursal, pr.activo, i.cantidad AS existencia
            FROM Carrito c
            JOIN CarritoDetalle cd ON cd.id_carrito = c.id_carrito
            JOIN Producto pr ON pr.id_producto = cd.id_producto
            LEFT JOIN Inventario i WITH (UPDLOCK) ON i.id_producto = pr.id_producto
            WHERE c.id_usuario = @uid`, { uid: req.usuario.id });

        if (!items.length) throw { status: 400, error: 'Tu carrito está vacío.' };
        const sucursales = [...new Set(items.map(i => i.id_sucursal))];
        if (sucursales.length > 1) throw { status: 400, error: 'Tu carrito tiene productos de distintas sucursales. Haz un pedido por sucursal.' };

        for (const it of items) {
            if (!it.activo) throw { status: 400, error: '"' + it.nombre + '" ya no está disponible. Quítalo del carrito.' };
            if (it.existencia !== null && it.existencia < it.cantidad) {
                throw { status: 400, error: 'Solo quedan ' + it.existencia + ' de "' + it.nombre + '".' };
            }
        }

        const total = items.reduce((t, it) => t + it.precio * it.cantidad, 0);
        const ped = await q(`
            INSERT INTO Pedido (id_cliente, id_sucursal, id_estado, total, notas, metodo_pago)
            OUTPUT INSERTED.id_pedido AS id
            VALUES (@uid, @suc, 1, @total, @notas, @pago)`,
            { uid: req.usuario.id, suc: sucursales[0], total, notas, pago });
        const id = ped[0].id;

        for (const it of items) {
            await q(`INSERT INTO DetallePedido (id_pedido, id_producto, nombre_producto, cantidad, precio_unitario)
                     VALUES (@id, @prod, @nombre, @cant, @precio)`,
                { id, prod: it.id_producto, nombre: it.nombre, cant: it.cantidad, precio: it.precio });
            await q(`UPDATE Inventario SET cantidad = cantidad - @cant, fecha_actualizacion = GETDATE()
                     WHERE id_producto = @prod`, { prod: it.id_producto, cant: it.cantidad });
        }

        // Vaciar el carrito
        await q(`DELETE cd FROM CarritoDetalle cd JOIN Carrito c ON c.id_carrito = cd.id_carrito
                 WHERE c.id_usuario = @uid`, { uid: req.usuario.id });
        return id;
    });

    const lista = await buscarPedidos(req.usuario, ' AND p.id_pedido = @id', { id: idPedido });
    res.status(201).json(lista[0]);
});

// PATCH /api/pedidos/:id/estado   { estado: 'En preparación' }   (Dueño / Admin)
router.patch('/:id/estado', requiereRol(ROLES.DUENO, ROLES.ADMIN), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const nuevo = ESTADOS[req.body.estado];
    if (!nuevo) return res.status(400).json({ error: 'Estado no válido.' });

    const lista = await buscarPedidos(req.usuario, ' AND p.id_pedido = @id', { id });
    if (!lista.length) return res.status(404).json({ error: 'No se encontró el pedido.' });
    const anterior = ESTADOS[lista[0].estado];

    await transaccion(async (q) => {
        // Al cancelar se regresan las piezas al inventario; al "des-cancelar" se vuelven a descontar
        if (anterior !== 4 && nuevo === 4) {
            await q(`UPDATE i SET i.cantidad = i.cantidad + d.cantidad, i.fecha_actualizacion = GETDATE()
                     FROM Inventario i JOIN DetallePedido d ON d.id_producto = i.id_producto
                     WHERE d.id_pedido = @id`, { id });
        } else if (anterior === 4 && nuevo !== 4) {
            const faltan = await q(`SELECT d.nombre_producto FROM DetallePedido d
                                    JOIN Inventario i ON i.id_producto = d.id_producto
                                    WHERE d.id_pedido = @id AND i.cantidad < d.cantidad`, { id });
            if (faltan.length) throw { status: 400, error: 'No hay existencia suficiente de "' + faltan[0].nombre_producto + '".' };
            await q(`UPDATE i SET i.cantidad = i.cantidad - d.cantidad, i.fecha_actualizacion = GETDATE()
                     FROM Inventario i JOIN DetallePedido d ON d.id_producto = i.id_producto
                     WHERE d.id_pedido = @id`, { id });
        }
        await q('UPDATE Pedido SET id_estado = @estado WHERE id_pedido = @id', { id, estado: nuevo });
    });

    res.json({ id, estado: req.body.estado });
});

module.exports = router;
