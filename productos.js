// Productos del menú: ahora se leen del backend (GET /api/productos)

var _productosCache = null;

// Regresa una promesa con la lista de productos activos
function leerProductos() {
    if (!_productosCache) {
        _productosCache = api('GET', '/api/productos').catch(function (err) {
            _productosCache = null;
            throw err;
        });
    }
    return _productosCache;
}

function buscarProductoPorNombre(lista, nombre) {
    nombre = String(nombre).trim().toLowerCase();
    for (var i = 0; i < lista.length; i++) {
        if (lista[i].nombre.toLowerCase() === nombre) return lista[i];
    }
    return null;
}

// Pone en cada tarjeta del menú el precio de la BD; si el producto se eliminó, oculta la tarjeta
function actualizarPrecios() {
    return leerProductos().then(function (lista) {
        $('.product-card').each(function () {
            var encontrado = buscarProductoPorNombre(lista, $(this).find('h4').text());
            if (encontrado) {
                $(this).attr('data-id', encontrado.id);
                $(this).find('.price').text('$' + Number(encontrado.precio));
                if (encontrado.existencia === 0) {
                    $(this).find('.btn-ordenar').prop('disabled', true).text('AGOTADO').css('opacity', 0.5);
                }
            } else if ($(this).find('.btn-ordenar, .btn-comprar').length) {
                $(this).hide();
            }
        });
    }).catch(function (err) {
        console.warn('No se pudieron cargar los precios:', err.message);
    });
}
