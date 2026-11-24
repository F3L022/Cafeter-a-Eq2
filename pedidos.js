// Pedidos y carrito compartidos entre los 3 roles (Comprador, Dueño de Local y Administrador).
// Se guardan en localStorage para que un pedido hecho por el comprador aparezca
// en "Pedidos" del dueño y en el "Historial de pedidos" de los tres roles.
// Requiere js/app.js (obtenerUsuarioActual) y js/productos.js (leerProductos).

var LLAVE_PEDIDOS = 'cafe_central_pedidos';

// Mismos estados que la tabla EstadoPedido de la base de datos
var ESTADOS_PEDIDO = ['Pendiente', 'En preparación', 'Entregado', 'Cancelado'];

var PEDIDOS_BASE = [
    { id: 1001, correo: 'regina@correo.com', cliente: 'Regina Sandoval', fecha: '2026-11-10T08:30:00', estado: 'Entregado',
      items: [{ nombre: 'Latte', precio: 65, cantidad: 1 }, { nombre: 'Cheesecake', precio: 65, cantidad: 1 }], total: 130 },
    { id: 1002, correo: 'jesus@correo.com', cliente: 'Jesús Arce', fecha: '2026-11-10T09:15:00', estado: 'Entregado',
      items: [{ nombre: 'Cappuccino', precio: 60, cantidad: 2 }, { nombre: 'Brownie', precio: 50, cantidad: 1 }], total: 170 },
    { id: 1003, correo: 'abdiel@correo.com', cliente: 'Abdiel Gamez', fecha: '2026-11-11T10:00:00', estado: 'Cancelado',
      items: [{ nombre: 'Frappé', precio: 70, cantidad: 1 }], total: 70 },
    { id: 1004, correo: 'emmanuel@correo.com', cliente: 'Emmanuel Romero', fecha: '2026-11-12T08:45:00', estado: 'Pendiente',
      items: [{ nombre: 'Americano', precio: 45, cantidad: 1 }, { nombre: 'Galletas', precio: 35, cantidad: 1 }], total: 80 }
];

/* ---------- Pedidos ---------- */

function leerPedidos() {
    var datos = localStorage.getItem(LLAVE_PEDIDOS);
    if (datos) {
        try { return JSON.parse(datos); } catch (e) { }
    }
    guardarPedidos(PEDIDOS_BASE);
    return JSON.parse(JSON.stringify(PEDIDOS_BASE));
}

function guardarPedidos(lista) {
    localStorage.setItem(LLAVE_PEDIDOS, JSON.stringify(lista));
}

function buscarPedido(id) {
    var lista = leerPedidos();
    for (var i = 0; i < lista.length; i++) {
        if (lista[i].id == id) { return lista[i]; }
    }
    return null;
}

function cambiarEstadoPedido(id, estado) {
    var lista = leerPedidos();
    for (var i = 0; i < lista.length; i++) {
        if (lista[i].id == id) {
            lista[i].estado = estado;
            lista[i].actualizado = new Date().toISOString();
            guardarPedidos(lista);
            return lista[i];
        }
    }
    return null;
}

function crearPedido(usuario, items, extra) {
    extra = extra || {};
    var lista = leerPedidos();
    var siguienteId = 1001;
    for (var i = 0; i < lista.length; i++) {
        if (lista[i].id >= siguienteId) { siguienteId = lista[i].id + 1; }
    }
    var pedido = {
        id: siguienteId,
        correo: usuario.correo,
        cliente: usuario.nombre,
        fecha: new Date().toISOString(),
        estado: 'Pendiente',
        items: items,
        total: totalItems(items),
        notas: extra.notas || '',
        pago: extra.pago || 'Efectivo'
    };
    lista.push(pedido);
    guardarPedidos(lista);
    return pedido;
}

// Pedidos que le tocan a cada rol: el comprador solo ve los suyos
function pedidosParaUsuario(usuario) {
    var lista = leerPedidos();
    if (usuario && usuario.rol === 'Comprador') {
        return lista.filter(function (p) { return p.correo.toLowerCase() === usuario.correo.toLowerCase(); });
    }
    return lista;
}

/* ---------- Utilidades de formato ---------- */

function totalItems(items) {
    var t = 0;
    for (var i = 0; i < items.length; i++) { t += items[i].precio * items[i].cantidad; }
    return t;
}

function formatoDinero(n) {
    return '$' + Number(n).toFixed(2);
}

function formatoFecha(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return iso; }
    function dos(n) { return (n < 10 ? '0' : '') + n; }
    return dos(d.getDate()) + '/' + dos(d.getMonth() + 1) + '/' + d.getFullYear() + ' - ' + dos(d.getHours()) + ':' + dos(d.getMinutes());
}

function claseEstado(estado) {
    switch (estado) {
        case 'Pendiente': return 'badge-pendiente';
        case 'En preparación': return 'badge-preparacion';
        case 'Entregado': return 'badge-entregado';
        case 'Cancelado': return 'badge-agotado';
    }
    return 'badge-pendiente';
}

function badgeEstado(estado) {
    return '<span class="badge ' + claseEstado(estado) + '">' + estado + '</span>';
}

function textoDetallePedido(p) {
    var txt = 'Pedido #' + p.id + '\nCliente: ' + p.cliente + ' (' + p.correo + ')\nFecha: ' + formatoFecha(p.fecha) +
        '\nEstado: ' + p.estado + '\n\nArtículos:\n';
    for (var i = 0; i < p.items.length; i++) {
        var it = p.items[i];
        txt += '  ' + it.cantidad + 'x ' + it.nombre + '  ' + formatoDinero(it.precio * it.cantidad) + '\n';
    }
    txt += '\nTOTAL: ' + formatoDinero(p.total) + '\nSucursal: Café Central - Sucursal Centro';
    return txt;
}

/* ---------- Carrito del comprador ---------- */

function llaveCarrito(usuario) {
    return 'cafe_central_carrito_' + usuario.correo.toLowerCase();
}

function leerCarrito(usuario) {
    var datos = localStorage.getItem(llaveCarrito(usuario));
    if (datos) {
        try { return JSON.parse(datos); } catch (e) { }
    }
    return [];
}

function guardarCarrito(usuario, items) {
    localStorage.setItem(llaveCarrito(usuario), JSON.stringify(items));
}

function agregarAlCarrito(usuario, nombre, precio) {
    var items = leerCarrito(usuario);
    for (var i = 0; i < items.length; i++) {
        if (items[i].nombre.toLowerCase() === nombre.toLowerCase()) {
            items[i].cantidad++;
            guardarCarrito(usuario, items);
            return items;
        }
    }
    items.push({ nombre: nombre, precio: precio, cantidad: 1 });
    guardarCarrito(usuario, items);
    return items;
}

// Convierte "AMERICANO" en "Americano" usando la lista de productos, y toma su precio actual
function datosProductoDeTarjeta($card) {
    var nombreTarjeta = $card.find('h4').text().trim();
    var lista = (typeof leerProductos === 'function') ? leerProductos() : [];
    for (var i = 0; i < lista.length; i++) {
        if (lista[i].nombre.toLowerCase() === nombreTarjeta.toLowerCase()) {
            return { nombre: lista[i].nombre, precio: Number(lista[i].precio) };
        }
    }
    var precio = parseFloat($card.find('.price').text().replace('$', '')) || 0;
    return { nombre: nombreTarjeta, precio: precio };
}

function contarCarrito(items) {
    var n = 0;
    for (var i = 0; i < items.length; i++) { n += items[i].cantidad; }
    return n;
}

// Todos los carritos que los compradores tienen abiertos (para el dueño)
function leerTodosLosCarritos() {
    var res = [];
    for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k.indexOf('cafe_central_carrito_') === 0) {
            var items = [];
            try { items = JSON.parse(localStorage.getItem(k)) || []; } catch (e) { }
            if (items.length) { res.push({ correo: k.replace('cafe_central_carrito_', ''), items: items }); }
        }
    }
    return res;
}

// Barra del carrito al final de las páginas de productos (Cafés, Postres, Bebidas)
function dibujarCarrito() {
    var usuario = obtenerUsuarioActual();
    var $caja = $('#carritoCompra');
    if (!usuario || usuario.rol !== 'Comprador') { $caja.remove(); return; }

    if ($caja.length === 0) {
        $caja = $('<div id="carritoCompra" class="cart-box"></div>');
        $('.app-content .mt-4').last().before($caja);
    }
    var items = leerCarrito(usuario);
    var html = '<div class="cart-total" style="margin-bottom:10px;"><span><i class="fa-solid fa-cart-shopping"></i> MI CARRITO: ' +
        contarCarrito(items) + ' producto(s)</span><span>' + formatoDinero(totalItems(items)) + '</span></div>' +
        '<a href="20_carrito.html" class="btn-green btn-block"><i class="fa-solid fa-cart-shopping"></i> VER CARRITO Y PAGAR</a>';
    $caja.html(html);
    $('.nav-carrito-n').text(contarCarrito(items));
}

// Conecta los botones ORDENAR / COMPRAR de las páginas de productos con el carrito
function activarOrdenar() {
    $(document).on('click', '.btn-ordenar', function () {
        var usuario = obtenerUsuarioActual();
        if (!usuario || usuario.rol !== 'Comprador') {
            alert('Debes iniciar sesión como comprador para realizar un pedido.');
            window.location.href = '09_login_comprador.html';
            return;
        }
        var prod = datosProductoDeTarjeta($(this).closest('.product-card'));
        agregarAlCarrito(usuario, prod.nombre, prod.precio);
        dibujarCarrito();
        var $btn = $(this);
        var textoOriginal = $btn.data('texto') || $btn.text();
        $btn.data('texto', textoOriginal).text('✓ AGREGADO');
        setTimeout(function () { $btn.text(textoOriginal); }, 900);
    });
    dibujarCarrito();
}
