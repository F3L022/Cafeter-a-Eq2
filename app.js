// JavaScript general para interacción y manejo de sesiones en Café Central
// Ahora los datos vienen del backend (Node.js + SQL Server) a través de /api

$(function() {

    // Menú desplegable según el rol (se arma en todas las páginas)
    construirMenuNavegacion();

    // Toggle del menú desplegable móvil
    $('#navToggle').on('click', function() {
        $('#mobileNav').toggleClass('active');
    });

    // Cargar información de usuario logueado en la interfaz si existe
    actualizarEstadoSesion();
});

/* ---------- Llamadas al backend ---------- */

// api('GET', '/api/productos')  →  Promise con la respuesta JSON
// Si el servidor responde con error, la promesa se rechaza con un Error cuyo mensaje es el del servidor.
function api(metodo, url, datos) {
    var opciones = { method: metodo, headers: {} };
    var token = obtenerToken();
    if (token) opciones.headers['Authorization'] = 'Bearer ' + token;
    if (datos !== undefined) {
        opciones.headers['Content-Type'] = 'application/json';
        opciones.body = JSON.stringify(datos);
    }
    return fetch(url, opciones).then(function (resp) {
        return resp.json().catch(function () { return {}; }).then(function (json) {
            if (resp.status === 401 && token) {
                // Token vencido: se cierra la sesión local
                localStorage.removeItem('cafe_central_user');
            }
            if (!resp.ok) {
                var err = new Error(json.error || ('Error ' + resp.status));
                err.status = resp.status;
                throw err;
            }
            return json;
        });
    }, function () {
        throw new Error('No se pudo conectar con el servidor. ¿Está corriendo "npm start"?');
    });
}

// Muestra el error de una llamada a la API
function mostrarError(err) {
    alert(err && err.message ? err.message : 'Ocurrió un error.');
}

// Escapa texto antes de meterlo en HTML (evita que un nombre con <script> rompa la página)
function esc(texto) {
    return String(texto === null || texto === undefined ? '' : texto)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------- Sesión ---------- */

// Guarda la sesión que regresa el backend al iniciar sesión
function iniciarSesionLocal(usuario, token) {
    var datos = {
        id: usuario.id,
        correo: usuario.correo,
        rol: usuario.rol,
        nombre: usuario.nombre,
        token: token,
        fecha: new Date().toISOString()
    };
    localStorage.setItem('cafe_central_user', JSON.stringify(datos));
}

function cerrarSesionLocal() {
    localStorage.removeItem('cafe_central_user');
    window.location.href = 'index.html';
}

function obtenerUsuarioActual() {
    var data = localStorage.getItem('cafe_central_user');
    if (!data) return null;
    try {
        var u = JSON.parse(data);
        return u && u.token ? u : null; // sesiones viejas (sin token) ya no sirven
    } catch (e) { return null; }
}

function obtenerToken() {
    var u = obtenerUsuarioActual();
    return u ? u.token : null;
}

function actualizarEstadoSesion() {
    var usuario = obtenerUsuarioActual();
    if (usuario && $('#userInfoDisplay').length > 0) {
        $('#userInfoDisplay').text('Hola, ' + usuario.nombre + ' (' + usuario.rol + ')');
    }
}

// Actualiza el contador del carrito en el menú (solo comprador)
function actualizarContadorCarrito() {
    var usuario = obtenerUsuarioActual();
    if (!usuario || usuario.rol !== 'Comprador') return;
    api('GET', '/api/carrito').then(function (items) {
        var n = 0;
        for (var j = 0; j < items.length; j++) { n += items[j].cantidad; }
        $('.nav-carrito-n').text(n);
    }).catch(function () { });
}

// Arma el menú de la hamburguesa con los enlaces que le tocan a cada rol
function construirMenuNavegacion() {
    if ($('#navToggle').length === 0) return;
    var usuario = obtenerUsuarioActual();
    var links;
    if (usuario && usuario.rol === 'Comprador') {
        links = [['02_menu_principal.html', 'Menú Principal'], ['03_lista_cafes.html', 'Cafés'], ['04_lista_postres.html', 'Postres'],
                 ['05_lista_bebidas.html', 'Bebidas'], ['20_carrito.html', 'Mi Carrito (<span class="nav-carrito-n">0</span>)'],
                 ['19_historial_compras.html', 'Mis Pedidos / Historial'], ['07_contactanos.html', 'Contacto']];
    } else if (usuario && usuario.rol === 'Dueño de Local') {
        links = [['13_panel_dueno.html', 'Panel de Mi Local'], ['14_admin_productos.html', 'Productos'], ['15_listado_inventario.html', 'Inventario'],
                 ['18_categorias_productos.html', 'Categorías'], ['16_pedidos_local.html', 'Pedidos'], ['20_carrito.html', 'Carritos de Clientes'],
                 ['19_historial_compras.html', 'Historial de Compras'], ['17_configuracion_local.html', 'Mi Información']];
    } else if (usuario && usuario.rol === 'Administrador') {
        links = [['11_gestion_usuarios.html', 'Gestión de Usuarios'], ['16_pedidos_local.html', 'Pedidos'],
                 ['20_carrito.html', 'Carritos de Clientes'], ['19_historial_compras.html', 'Historial de Compras']];
    } else {
        links = [['02_menu_principal.html', 'Menú Principal'], ['03_lista_cafes.html', 'Cafés'], ['04_lista_postres.html', 'Postres'],
                 ['05_lista_bebidas.html', 'Bebidas'], ['06_sobre_nosotros.html', 'Sobre Nosotros'], ['07_contactanos.html', 'Contacto'],
                 ['index.html', 'Iniciar Sesión']];
    }
    var html = '<ul>';
    for (var i = 0; i < links.length; i++) { html += '<li><a href="' + links[i][0] + '">' + links[i][1] + '</a></li>'; }
    if (usuario) { html += '<li><a href="#" onclick="cerrarSesionLocal(); return false;">Cerrar Sesión (' + esc(usuario.nombre) + ')</a></li>'; }
    html += '</ul>';

    var $nav = $('#mobileNav');
    if ($nav.length === 0) {
        $nav = $('<nav class="mobile-nav" id="mobileNav"></nav>');
        $('.app-header').first().after($nav);
    }
    $nav.html(html);

    actualizarContadorCarrito();
}
