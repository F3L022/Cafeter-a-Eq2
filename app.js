// JavaScript general para interacción y manejo de sesiones en Café Central

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

// Guardar datos de sesión simulados en localStorage
function iniciarSesionLocal(correo, rol, nombre) {
    var usuario = {
        correo: correo,
        rol: rol,
        nombre: nombre,
        fecha: new Date().toISOString()
    };
    localStorage.setItem('cafe_central_user', JSON.stringify(usuario));
}

function cerrarSesionLocal() {
    localStorage.removeItem('cafe_central_user');
    window.location.href = 'index.html';
}

function obtenerUsuarioActual() {
    var data = localStorage.getItem('cafe_central_user');
    return data ? JSON.parse(data) : null;
}

function actualizarEstadoSesion() {
    var usuario = obtenerUsuarioActual();
    if (usuario && $('#userInfoDisplay').length > 0) {
        $('#userInfoDisplay').text('Hola, ' + usuario.nombre + ' (' + usuario.rol + ')');
    }
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
                 ['16_pedidos_local.html', 'Pedidos'], ['20_carrito.html', 'Carritos de Clientes'], ['19_historial_compras.html', 'Historial de Compras'],
                 ['17_configuracion_local.html', 'Mi Información']];
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
    if (usuario) { html += '<li><a href="#" onclick="cerrarSesionLocal(); return false;">Cerrar Sesión (' + usuario.nombre + ')</a></li>'; }
    html += '</ul>';

    var $nav = $('#mobileNav');
    if ($nav.length === 0) {
        $nav = $('<nav class="mobile-nav" id="mobileNav"></nav>');
        $('.app-header').first().after($nav);
    }
    $nav.html(html);

    if (usuario && usuario.rol === 'Comprador') {
        try {
            var c = JSON.parse(localStorage.getItem('cafe_central_carrito_' + usuario.correo.toLowerCase())) || [];
            var n = 0; for (var j = 0; j < c.length; j++) { n += c[j].cantidad; }
            $('.nav-carrito-n').text(n);
        } catch (e) { }
    }
}
