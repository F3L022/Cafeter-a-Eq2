var LLAVE_PRODUCTOS = 'cafe_central_productos';

var PRODUCTOS_BASE = [
    { nombre: 'Americano', precio: 45, categoria: 'Cafés' },
    { nombre: 'Cappuccino', precio: 60, categoria: 'Cafés' },
    { nombre: 'Latte', precio: 65, categoria: 'Cafés' },
    { nombre: 'Frappé', precio: 70, categoria: 'Cafés' },
    { nombre: 'Cheesecake', precio: 65, categoria: 'Postres' },
    { nombre: 'Brownie', precio: 50, categoria: 'Postres' },
    { nombre: 'Pastel', precio: 60, categoria: 'Postres' },
    { nombre: 'Galletas', precio: 35, categoria: 'Postres' },
    { nombre: 'Agua natural', precio: 20, categoria: 'Bebidas' },
    { nombre: 'Agua mineral', precio: 25, categoria: 'Bebidas' },
    { nombre: 'Jugo natural', precio: 35, categoria: 'Bebidas' },
    { nombre: 'Chocolate frío', precio: 45, categoria: 'Bebidas' }
];

function leerProductos() {
    var datos = localStorage.getItem(LLAVE_PRODUCTOS);
    if (datos) {
        try { return JSON.parse(datos); } catch (e) { }
    }
    return PRODUCTOS_BASE.slice();
}

function guardarProductos(lista) {
    localStorage.setItem(LLAVE_PRODUCTOS, JSON.stringify(lista));
}

// Pone en cada tarjeta del menú el precio guardado; si el producto se eliminó, oculta la tarjeta
function actualizarPrecios() {
    var lista = leerProductos();
    $('.product-card').each(function () {
        var nombre = $(this).find('h4').text().trim().toLowerCase();
        var encontrado = null;
        for (var i = 0; i < lista.length; i++) {
            if (lista[i].nombre.toLowerCase() === nombre) { encontrado = lista[i]; break; }
        }
        if (encontrado) {
            $(this).find('.price').text('$' + encontrado.precio);
        } else if ($(this).find('.btn-ordenar, .btn-comprar').length) {
            $(this).hide();
        }
    });
}
