// Pedidos y carrito: ahora se guardan en SQL Server a través del backend.
//   GET   /api/pedidos               → pedidos que le tocan al usuario (según su rol)
//   GET   /api/pedidos/:id           → un pedido con sus productos
//   POST  /api/pedidos               → confirma el carrito y crea el pedido
//   PATCH /api/pedidos/:id/estado    → cambia el estado (dueño / admin)
//   /api/carrito ...                 → carrito del comprador
// Requiere js/app.js (api, obtenerUsuarioActual) y js/productos.js (leerProductos).

// Mismos estados que la tabla EstadoPedido de la base de datos
var ESTADOS_PEDIDO = ['Pendiente', 'En preparación', 'Entregado', 'Cancelado'];

/* ---------- Pedidos ---------- */

function leerPedidos() {
    return api('GET', '/api/pedidos');
}

// Para el historial: el backend ya filtra por rol (el comprador solo recibe los suyos)
function pedidosParaUsuario() {
    return leerPedidos();
}

function buscarPedido(id) {
    return api('GET', '/api/pedidos/' + encodeURIComponent(id));
}

function cambiarEstadoPedido(id, estado) {
    return api('PATCH', '/api/pedidos/' + id + '/estado', { estado: estado });
}

// Convierte el carrito del usuario en pedido
function crearPedido(extra) {
    extra = extra || {};
    return api('POST', '/api/pedidos', { notas: extra.notas || '', pago: extra.pago || 'Efectivo' });
}

/* ---------- Utilidades de formato ---------- */

function totalItems(items) {
    var t = 0;
    for (var i = 0; i < items.length; i++) { t += Number(items[i].precio) * items[i].cantidad; }
    return t;
}

function formatoDinero(n) {
    return '$' + Number(n).toFixed(2);
}

function formatoFecha(iso) {
    // SQL Server guarda la hora local sin zona; el servidor la manda como "...Z".
    // Se quita la Z para mostrarla tal como está guardada.
    var d = new Date(String(iso).replace(/Z$/, ''));
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
    return '<span class="badge ' + claseEstado(estado) + '">' + esc(estado) + '</span>';
}

/* ---------- Carrito del comprador ---------- */

function leerCarrito() {
    return api('GET', '/api/carrito');
}

function agregarAlCarrito(idProducto, nombre) {
    return api('POST', '/api/carrito/items', { id_producto: idProducto, nombre: nombre, cantidad: 1 });
}

function cambiarCantidadCarrito(idProducto, cantidad) {
    return api('PUT', '/api/carrito/items/' + idProducto, { cantidad: cantidad });
}

function vaciarCarrito() {
    return api('DELETE', '/api/carrito');
}

// Todos los carritos que los compradores tienen abiertos (para el dueño / admin)
function leerTodosLosCarritos() {
    return api('GET', '/api/carrito/todos');
}

function contarCarrito(items) {
    var n = 0;
    for (var i = 0; i < items.length; i++) { n += items[i].cantidad; }
    return n;
}

// Barra del carrito al final de las páginas de productos (Cafés, Postres, Bebidas)
function dibujarCarrito(items) {
    var usuario = obtenerUsuarioActual();
    var $caja = $('#carritoCompra');
    if (!usuario || usuario.rol !== 'Comprador') { $caja.remove(); return; }

    if ($caja.length === 0) {
        $caja = $('<div id="carritoCompra" class="cart-box"></div>');
        $('.app-content .mt-4').last().before($caja);
    }
    var pintar = function (items) {
        var html = '<div class="cart-total" style="margin-bottom:10px;"><span><i class="fa-solid fa-cart-shopping"></i> MI CARRITO: ' +
            contarCarrito(items) + ' producto(s)</span><span>' + formatoDinero(totalItems(items)) + '</span></div>' +
            '<a href="20_carrito.html" class="btn-green btn-block"><i class="fa-solid fa-cart-shopping"></i> VER CARRITO Y PAGAR</a>';
        $caja.html(html);
        $('.nav-carrito-n').text(contarCarrito(items));
    };
    if (items) { pintar(items); } else { leerCarrito().then(pintar).catch(function () { }); }
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
        var $card = $(this).closest('.product-card');
        var $btn = $(this);
        $btn.prop('disabled', true);
        agregarAlCarrito($card.attr('data-id'), $card.find('h4').text().trim())
            .then(function (items) {
                dibujarCarrito(items);
                var textoOriginal = $btn.data('texto') || $btn.text();
                $btn.data('texto', textoOriginal).text('✓ AGREGADO');
                setTimeout(function () { $btn.text(textoOriginal).prop('disabled', false); }, 900);
            })
            .catch(function (err) {
                $btn.prop('disabled', false);
                if (err.status === 401) { alert('Tu sesión expiró.'); window.location.href = '09_login_comprador.html'; return; }
                mostrarError(err);
            });
    });
    dibujarCarrito();
}
