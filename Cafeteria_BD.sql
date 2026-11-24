-- Script SQL Server para Base de Datos Café Central
-- Proyecto Programación Web - FIME UANL
--
-- Cambios para el backend en Node.js:
--   * Pedido: columnas notas y metodo_pago
--   * NUEVA tabla DetallePedido (los productos de cada pedido)
--   * NUEVA tabla CarritoDetalle (los productos de cada carrito)
--   * Carrito: un solo carrito por usuario (UNIQUE)
--   * Datos de ejemplo: productos, inventario y pedidos
--
-- Si ya creaste la base antes y quieres empezar de cero, descomenta esto:
-- USE master;
-- ALTER DATABASE Cafeteria SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
-- DROP DATABASE Cafeteria;
-- GO

CREATE DATABASE Cafeteria;
GO

USE Cafeteria;
GO

-- 1. Tabla Rol
CREATE TABLE Rol (
    id_rol INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(30) NOT NULL UNIQUE,
    descripcion NVARCHAR(150) NULL
);

-- 2. Tabla Usuario
CREATE TABLE Usuario (
    id_usuario INT IDENTITY(1,1) PRIMARY KEY,
    id_rol INT NOT NULL,
    nombre_completo NVARCHAR(100) NOT NULL,
    correo NVARCHAR(100) NOT NULL UNIQUE,
    contrasena_hash NVARCHAR(255) NOT NULL,
    telefono NVARCHAR(15) NULL,
    activo BIT NOT NULL DEFAULT 1,
    fecha_registro DATETIME2 NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (id_rol) REFERENCES Rol(id_rol)
);

-- 3. Tabla Sucursal
CREATE TABLE Sucursal (
    id_sucursal INT IDENTITY(1,1) PRIMARY KEY,
    id_dueno INT NOT NULL,
    nombre NVARCHAR(100) NOT NULL,
    direccion NVARCHAR(200) NOT NULL,
    telefono NVARCHAR(15) NOT NULL,
    descripcion NVARCHAR(500) NULL,
    FOREIGN KEY (id_dueno) REFERENCES Usuario(id_usuario)
);

-- 4. Tabla Categoria
CREATE TABLE Categoria (
    id_categoria INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(50) NOT NULL UNIQUE,
    descripcion NVARCHAR(200) NULL
);

-- 5. Tabla Producto
CREATE TABLE Producto (
    id_producto INT IDENTITY(1,1) PRIMARY KEY,
    id_sucursal INT NOT NULL,
    id_categoria INT NOT NULL,
    nombre NVARCHAR(100) NOT NULL,
    descripcion NVARCHAR(300) NULL,
    precio DECIMAL(10,2) NOT NULL,
    imagen_url NVARCHAR(255) NULL,
    activo BIT NOT NULL DEFAULT 1,
    accion TINYINT NOT NULL DEFAULT 1, -- 1: Agregado, 2: Eliminado
    fecha_accion DATETIME2 NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (id_sucursal) REFERENCES Sucursal(id_sucursal),
    FOREIGN KEY (id_categoria) REFERENCES Categoria(id_categoria)
);

-- 6. Tabla Inventario (una fila por producto)
CREATE TABLE Inventario (
    id_inventario INT IDENTITY(1,1) PRIMARY KEY,
    id_producto INT NOT NULL UNIQUE,
    cantidad INT NOT NULL,
    stock_minimo INT NOT NULL,
    estado AS (CASE WHEN cantidad = 0 THEN 0 WHEN cantidad <= stock_minimo THEN 1 ELSE 2 END), -- 0: Agotado, 1: Poco, 2: OK
    fecha_actualizacion DATETIME2 NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (id_producto) REFERENCES Producto(id_producto)
);

-- 7. Tabla EstadoPedido
CREATE TABLE EstadoPedido (
    id_estado TINYINT PRIMARY KEY,
    nombre NVARCHAR(30) NOT NULL UNIQUE
);

-- 8. Tabla Pedido
CREATE TABLE Pedido (
    id_pedido INT IDENTITY(1,1) PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_sucursal INT NOT NULL,
    id_estado TINYINT NOT NULL,
    fecha_hora DATETIME2 NOT NULL DEFAULT GETDATE(),
    total DECIMAL(10,2) NOT NULL,
    notas NVARCHAR(300) NULL,
    metodo_pago NVARCHAR(20) NOT NULL DEFAULT 'Efectivo',
    FOREIGN KEY (id_cliente) REFERENCES Usuario(id_usuario),
    FOREIGN KEY (id_sucursal) REFERENCES Sucursal(id_sucursal),
    FOREIGN KEY (id_estado) REFERENCES EstadoPedido(id_estado)
);

-- 8b. NUEVA: Tabla DetallePedido (qué productos lleva cada pedido)
-- Se guarda el nombre y precio del momento de la compra para que el ticket
-- no cambie si después se modifica el producto.
CREATE TABLE DetallePedido (
    id_detalle INT IDENTITY(1,1) PRIMARY KEY,
    id_pedido INT NOT NULL,
    id_producto INT NOT NULL,
    nombre_producto NVARCHAR(100) NOT NULL,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (id_pedido) REFERENCES Pedido(id_pedido) ON DELETE CASCADE,
    FOREIGN KEY (id_producto) REFERENCES Producto(id_producto)
);

-- 9. Tabla Carrito (uno por usuario)
CREATE TABLE Carrito (
    id_carrito INT IDENTITY(1,1) PRIMARY KEY,
    id_usuario INT NOT NULL UNIQUE,
    fecha_creacion DATETIME2 NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario)
);

-- 9b. NUEVA: Tabla CarritoDetalle (productos dentro del carrito)
CREATE TABLE CarritoDetalle (
    id_carrito INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    PRIMARY KEY (id_carrito, id_producto),
    FOREIGN KEY (id_carrito) REFERENCES Carrito(id_carrito) ON DELETE CASCADE,
    FOREIGN KEY (id_producto) REFERENCES Producto(id_producto)
);

-- 10. Tabla MensajeContacto
CREATE TABLE MensajeContacto (
    id_mensaje INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(100) NOT NULL,
    correo NVARCHAR(100) NOT NULL,
    telefono NVARCHAR(15) NULL,
    mensaje NVARCHAR(1000) NOT NULL,
    fecha_envio DATETIME2 NOT NULL DEFAULT GETDATE(),
    leido BIT NOT NULL DEFAULT 0
);
GO

-- Inserción de Datos Iniciales (Catalogos y Usuarios con Contraseñas requeridas)
INSERT INTO Rol (nombre, descripcion) VALUES
(N'Administrador', N'Control total del sistema y usuarios'),
(N'Dueño de Local', N'Administración de la sucursal, inventario y productos'),
(N'Comprador', N'Cliente final que consulta menú y realiza compras');

INSERT INTO EstadoPedido (id_estado, nombre) VALUES
(1, N'Pendiente'),
(2, N'En preparación'),
(3, N'Entregado'),
(4, N'Cancelado');

INSERT INTO Categoria (nombre, descripcion) VALUES
(N'Cafés', N'Bebidas calientes y frías a base de espresso'),
(N'Postres', N'Panadería, pasteles y repostería selecta'),
(N'Bebidas', N'Aguas, jugos naturales y refrescos');

-- Usuarios requeridos
-- Las contraseñas van en texto plano aquí; el backend las convierte a hash (bcrypt)
-- automáticamente la primera vez que cada usuario inicia sesión.
INSERT INTO Usuario (id_rol, nombre_completo, correo, contrasena_hash, telefono) VALUES
(1, N'Felipe Tello (Admin)', 'admin@cafecentral.com', 'Felo22', '8110000001'),
(2, N'Tana (Dueño)', 'tana@cafecentral.com', 'Tana11', '8110000002'),
(2, N'Bae (Dueño)', 'bae@cafecentral.com', 'Bae22', '8110000003'),
(3, N'Regina Sandoval', 'regina@correo.com', 'Regina11', '8110000004'),
(3, N'Jesús Arce', 'jesus@correo.com', 'Jesus22', '8110000005'),
(3, N'Angel Gamez', 'abdiel@correo.com', 'Abdiel33', '8110000006'),
(3, N'Emmanuel Romero', 'emmanuel@correo.com', 'Emmanuel44', '8110000007');

INSERT INTO Sucursal (id_dueno, nombre, direccion, telefono, descripcion) VALUES
(2, N'Café Central - Sucursal Centro', N'Av. Café #123, Centro', '8112345678', N'La mejor experiencia en café'),
(3, N'Café Central - Sucursal Norte', N'Av. Universidad #456, San Nicolás', '8187654321', N'Café de especialidad cerca de FIME');

-- Productos del menú (Sucursal Centro). Los nombres coinciden con las tarjetas del menú.
INSERT INTO Producto (id_sucursal, id_categoria, nombre, precio) VALUES
(1, 1, N'Americano', 45), (1, 1, N'Cappuccino', 60), (1, 1, N'Latte', 65), (1, 1, N'Frappé', 70),
(1, 2, N'Cheesecake', 65), (1, 2, N'Brownie', 50), (1, 2, N'Pastel', 60), (1, 2, N'Galletas', 35),
(1, 3, N'Agua natural', 20), (1, 3, N'Agua mineral', 25), (1, 3, N'Jugo natural', 35), (1, 3, N'Chocolate frío', 45);

INSERT INTO Inventario (id_producto, cantidad, stock_minimo) VALUES
(1, 40, 10), (2, 35, 10), (3, 30, 10), (4, 20, 5),
(5, 8, 5), (6, 15, 5), (7, 3, 5), (8, 25, 5),
(9, 50, 10), (10, 30, 10), (11, 0, 5), (12, 18, 5);

-- Pedidos de ejemplo
INSERT INTO Pedido (id_cliente, id_sucursal, id_estado, fecha_hora, total, metodo_pago) VALUES
(4, 1, 3, '2026-11-10T08:30:00', 130, 'Efectivo'),
(5, 1, 3, '2026-11-10T09:15:00', 170, 'Tarjeta'),
(6, 1, 4, '2026-11-11T10:00:00', 70, 'Efectivo'),
(7, 1, 1, '2026-11-12T08:45:00', 80, 'Transferencia');

INSERT INTO DetallePedido (id_pedido, id_producto, nombre_producto, cantidad, precio_unitario) VALUES
(1, 3, N'Latte', 1, 65), (1, 5, N'Cheesecake', 1, 65),
(2, 2, N'Cappuccino', 2, 60), (2, 6, N'Brownie', 1, 50),
(3, 4, N'Frappé', 1, 70),
(4, 1, N'Americano', 1, 45), (4, 8, N'Galletas', 1, 35);
GO
