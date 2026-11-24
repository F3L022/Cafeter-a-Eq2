# ☕ Café Central — Backend Node.js + SQL Server

PIA Programación Web · FIME UANL · Equipo 2

## Estructura

```
CafeCentral_Equipo2_PIA/
├── server.js            ← arranca el servidor (Express)
├── package.json
├── .env.example         ← copia como .env y pon tus datos de SQL Server
├── db/
│   └── Cafeteria_BD.sql ← script de la base (con tablas nuevas + datos de ejemplo)
├── src/
│   ├── db.js            ← conexión a SQL Server (paquete mssql)
│   ├── middleware/
│   │   └── auth.js      ← tokens de sesión (JWT) y permisos por rol
│   └── routes/          ← un archivo por recurso de la API
│       ├── auth.js  usuarios.js  productos.js  categorias.js
│       ├── inventario.js  pedidos.js  carrito.js
│       └── sucursal.js  contacto.js
└── public/              ← el frontend (las mismas páginas HTML, css y js)
```

## Cómo correrlo

1. **Instala Node.js** (versión 18 o más nueva): https://nodejs.org

2. **Crea la base de datos**: abre `db/Cafeteria_BD.sql` en SQL Server Management Studio (SSMS) y ejecútalo completo (F5).

3. **Habilita el acceso por usuario y contraseña en SQL Server** (Node no usa la autenticación de Windows):
   - En SSMS: clic derecho al servidor → *Properties* → *Security* → **SQL Server and Windows Authentication mode**.
   - *Security* → *Logins* → `sa` → ponle contraseña y en *Status* márcalo como **Enabled**.
   - Abre **SQL Server Configuration Manager** → *SQL Server Network Configuration* → *Protocols for SQLEXPRESS* → **TCP/IP = Enabled**.
   - En *SQL Server Services* reinicia **SQL Server** y enciende **SQL Server Browser** (lo necesita si usas `SQLEXPRESS`).

4. **Configura la conexión**: copia `.env.example` como `.env` y cambia `DB_USER`, `DB_PASSWORD` y `DB_INSTANCE`.
   - SQL Server Express → `DB_INSTANCE=SQLEXPRESS`
   - SQL Server Developer/normal → deja `DB_INSTANCE=` vacío y usa `DB_PORT=1433`

5. En una terminal, dentro de la carpeta del proyecto:
   ```
   npm install
   npm start
   ```
6. Abre **http://localhost:3000**
   Para probar la conexión: http://localhost:3000/api/salud debe decir `"baseDeDatos":"ok"`.

> Ya no se abren los .html con doble clic: ahora todo se abre desde `http://localhost:3000`, porque las páginas piden los datos al servidor.

## Usuarios de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@cafecentral.com | Felo22 |
| Dueño (Sucursal Centro) | tana@cafecentral.com | Tana11 |
| Dueño (Sucursal Norte) | bae@cafecentral.com | Bae22 |
| Comprador | regina@correo.com | Regina11 |
| Comprador | jesus@correo.com | Jesus22 |
| Comprador | abdiel@correo.com | Abdiel33 |
| Comprador | emmanuel@correo.com | Emmanuel44 |

Si alguien entra desde el login de otro rol (ej. el admin en el de comprador), igual entra y se le manda a su pantalla. El administrador no puede darse de baja a sí mismo y no se puede dar de baja al último administrador activo.

En el script SQL las contraseñas están en texto plano; la primera vez que cada usuario inicia sesión el backend la convierte en hash con **bcrypt**, y los usuarios nuevos se guardan ya con hash.

## Cambios a la base de datos

- **DetallePedido** (nueva): qué productos lleva cada pedido, con el precio del momento.
- **CarritoDetalle** (nueva): productos dentro del carrito de cada comprador.
- **Pedido**: columnas `notas` y `metodo_pago`.
- **Carrito**: un carrito por usuario (`UNIQUE`). **Inventario**: un registro por producto (`UNIQUE`).
- Datos de ejemplo: 12 productos, su inventario, 4 pedidos y una sucursal para Bae.

## API (resumen)

Las rutas marcadas con 🔒 piden el header `Authorization: Bearer <token>` (el frontend lo manda solo).

| Método | Ruta | Quién | Para qué |
|---|---|---|---|
| POST | /api/auth/login | todos | iniciar sesión → `{ token, usuario, redirect }` |
| POST | /api/auth/registro | todos | crear cuenta de comprador |
| GET | /api/productos | todos | menú (`?categoria=Cafés`) |
| GET/POST/PUT/DELETE | /api/productos/mios, /api/productos/:id | 🔒 dueño, admin | administrar productos |
| GET/POST/PUT/DELETE | /api/categorias | lectura: todos · cambios: 🔒 dueño, admin | categorías |
| GET/POST/PUT/DELETE | /api/inventario | 🔒 dueño, admin | inventario |
| GET | /api/carrito | 🔒 comprador | mi carrito |
| POST | /api/carrito/items | 🔒 comprador | agregar producto |
| PUT | /api/carrito/items/:idProducto | 🔒 comprador | cambiar cantidad (0 = quitar) |
| DELETE | /api/carrito | 🔒 comprador | vaciar |
| GET | /api/carrito/todos | 🔒 dueño, admin | carritos abiertos de los clientes |
| GET | /api/pedidos, /api/pedidos/:id | 🔒 todos (cada rol ve lo suyo) | pedidos e historial |
| POST | /api/pedidos | 🔒 comprador | confirmar carrito → pedido (descuenta inventario) |
| PATCH | /api/pedidos/:id/estado | 🔒 dueño, admin | cambiar estado (cancelar regresa el inventario) |
| GET/PUT | /api/sucursal/mia | 🔒 dueño | "Mi Información" |
| GET/POST/PATCH | /api/usuarios | 🔒 admin | alta / baja de usuarios |
| POST | /api/contacto | todos | formulario de contacto |
| GET | /api/contacto | 🔒 admin | ver mensajes |

## Problemas comunes

- **Error 403 al iniciar sesión / acentos raros (`DueÃ±o`, `CafÃ©s`)** → SSMS abrió el script con otra codificación. Ejecuta `db/Reparar_Acentos.sql` en SSMS (no borra nada; también vuelve a dar de ALTA a todos los usuarios). El script principal ya viene guardado con BOM para que no vuelva a pasar.
- **"Tu usuario está dado de baja"** → alguien le dio BAJA en Gestión de Usuarios. Dale ALTA desde el admin o ejecuta `UPDATE Usuario SET activo = 1;`

- **"Login failed for user 'sa'"** → la contraseña del `.env` está mal o no activaste el modo mixto (paso 3).
- **"Failed to connect… could not connect (sequence)"** o **EINSTLOOKUP** → TCP/IP apagado o SQL Server Browser apagado (paso 3).
- **"Cannot open database Cafeteria"** → no ejecutaste el script SQL o `DB_DATABASE` tiene otro nombre.
- **Puerto 3000 ocupado** → cambia `PORT` en el `.env`.
