// Conexión a SQL Server con el paquete "mssql"
const sql = require('mssql');

const config = {
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_DATABASE || 'Cafeteria',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        encrypt: false,               // en local no se usa cifrado
        trustServerCertificate: true  // evita error de certificado autofirmado
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

// Con instancia con nombre (ej. SQLEXPRESS) se usa instanceName; si no, el puerto
if (process.env.DB_INSTANCE) {
    config.options.instanceName = process.env.DB_INSTANCE;
} else {
    config.port = parseInt(process.env.DB_PORT || '1433', 10);
}

let poolPromise = null;

function getPool() {
    if (!poolPromise) {
        poolPromise = new sql.ConnectionPool(config).connect()
            .then(pool => {
                console.log('✔ Conectado a SQL Server (' + config.database + ')');
                return pool;
            })
            .catch(err => {
                poolPromise = null; // permite reintentar en la siguiente petición
                throw err;
            });
    }
    return poolPromise;
}

/**
 * Ejecuta una consulta con parámetros.
 *   query('SELECT * FROM Usuario WHERE correo = @correo', { correo: 'a@b.com' })
 * Los parámetros evitan inyección SQL (nunca concatenes texto del usuario en la consulta).
 */
async function query(texto, params = {}, transaccion = null) {
    const request = transaccion ? new sql.Request(transaccion) : (await getPool()).request();
    for (const [nombre, valor] of Object.entries(params)) {
        request.input(nombre, valor);
    }
    const result = await request.query(texto);
    return result.recordset || [];
}

/** Ejecuta varias consultas dentro de una transacción (todo o nada). */
async function transaccion(fn) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
        const resultado = await fn((texto, params) => query(texto, params, tx));
        await tx.commit();
        return resultado;
    } catch (err) {
        try { await tx.rollback(); } catch (e) { /* ya se había cancelado */ }
        throw err;
    }
}

module.exports = { sql, getPool, query, transaccion };
