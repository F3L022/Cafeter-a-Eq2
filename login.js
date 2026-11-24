// Inicio de sesión contra el backend (POST /api/auth/login)

function validarLogin(formId, rolEsperado) {
    $('#' + formId).on('submit', function(e) {
        e.preventDefault();

        var correoInput = $(this).find('input[type="email"], input[name="correo"]').val().trim();
        var passInput = $(this).find('input[type="password"]').val().trim();
        var mensajeError = $(this).find('.error-msg');
        var $boton = $(this).find('button[type="submit"]');

        if (mensajeError.length === 0) {
            $(this).prepend('<div class="error-msg" style="color:red; font-size:0.85rem; margin-bottom:10px; display:none;"></div>');
            mensajeError = $(this).find('.error-msg');
        }
        mensajeError.hide();
        $boton.prop('disabled', true);

        api('POST', '/api/auth/login', { correo: correoInput, contrasena: passInput, rol: rolEsperado || null })
            .then(function (resp) {
                iniciarSesionLocal(resp.usuario, resp.token);
                if (resp.aviso) alert(resp.aviso);
                window.location.href = resp.redirect;
            })
            .catch(function (err) {
                mensajeError.text(err.message).show();
                $boton.prop('disabled', false);
            });
    });
}
