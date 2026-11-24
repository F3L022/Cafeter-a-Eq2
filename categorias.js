// /api/categorias
const router = require('express').Router();
const { query } = require('../db');
const { ROLES, requiereRol } = require('../middleware/auth');

const puedeEditar = requiereRol(ROLES.DUENO, ROLES.ADMIN);

// GET /api/categorias  (público)
router.get('/', async (req, res) => {
    res.json(await query(`
        SELECT c.id_categoria AS id, c.nombre, c.descripcion,
               (SELECT COUNT(*) FROM Producto p WHERE p.id_categoria = c.id_categoria AND p.activo = 1) AS productos
        FROM Categoria c ORDER BY c.id_categoria`));
});

// POST /api/categorias   { nombre, descripcion? }
router.post('/', puedeEditar, async (req, res) => {
    const nombre = String(req.body.nombre || '').trim();
    const descripcion = req.body.descripcion ? String(req.body.descripcion).trim() : null;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });

    const existe = await query('SELECT 1 AS x FROM Categoria WHERE nombre = @nombre', { nombre });
    if (existe.length) return res.status(409).json({ error: 'Ya existe una categoría con ese nombre.' });

    const filas = await query(`
        INSERT INTO Categoria (nombre, descripcion) OUTPUT INSERTED.id_categoria AS id, INSERTED.nombre, INSERTED.descripcion
        VALUES (@nombre, @descripcion)`, { nombre, descripcion });
    res.status(201).json(filas[0]);
});

// PUT /api/categorias/:id   { nombre, descripcion? }
router.put('/:id', puedeEditar, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const nombre = String(req.body.nombre || '').trim();
    const descripcion = req.body.descripcion ? String(req.body.descripcion).trim() : null;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });

    const repetida = await query('SELECT 1 AS x FROM Categoria WHERE nombre = @nombre AND id_categoria <> @id', { nombre, id });
    if (repetida.length) return res.status(409).json({ error: 'Ya existe una categoría con ese nombre.' });

    const filas = await query(`
        UPDATE Categoria SET nombre = @nombre, descripcion = @descripcion
        OUTPUT INSERTED.id_categoria AS id, INSERTED.nombre, INSERTED.descripcion
        WHERE id_categoria = @id`, { id, nombre, descripcion });
    if (!filas.length) return res.status(404).json({ error: 'Categoría no encontrada.' });
    res.json(filas[0]);
});

// DELETE /api/categorias/:id   (solo si no tiene productos)
router.delete('/:id', puedeEditar, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const usados = await query('SELECT COUNT(*) AS n FROM Producto WHERE id_categoria = @id', { id });
    if (usados[0].n > 0) {
        return res.status(409).json({ error: 'No se puede eliminar: hay productos en esta categoría.' });
    }
    const filas = await query('DELETE FROM Categoria OUTPUT DELETED.id_categoria AS id WHERE id_categoria = @id', { id });
    if (!filas.length) return res.status(404).json({ error: 'Categoría no encontrada.' });
    res.json({ ok: true });
});

module.exports = router;
