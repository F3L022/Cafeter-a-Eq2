var usuariosBD = [
    { correo: "admin@cafecentral.com", pass: "Felo22", rol: "Administrador", nombre: "Felipe Tello", redirect: "11_gestion_usuarios.html" },
    { correo: "tana@cafecentral.com", pass: "Tana11", rol: "Dueño de Local", nombre: "Tana (Dueño)", redirect: "13_panel_dueno.html" },
    { correo: "bae@cafecentral.com", pass: "Bae22", rol: "Dueño de Local", nombre: "Bae (Dueño)", redirect: "13_panel_dueno.html" },
    { correo: "regina@correo.com", pass: "Regina11", rol: "Comprador", nombre: "Regina Sandoval", redirect: "02_menu_principal.html" },
    { correo: "jesus@correo.com", pass: "Jesus22", rol: "Comprador", nombre: "Jesús Arce", redirect: "02_menu_principal.html" },
    { correo: "abdiel@correo.com", pass: "Abdiel33", rol: "Comprador", nombre: "Abdiel Gamez", redirect: "02_menu_principal.html" },
    { correo: "emmanuel@correo.com", pass: "Emmanuel44", rol: "Comprador", nombre: "Emmanuel Romero", redirect: "02_menu_principal.html" }
];

function validarLogin(formId, rolEsperado) {
    $('#' + formId).on('submit', function(e) {
        e.preventDefault();
        
        var correoInput = $(this).find('input[type="email"], input[name="correo"]').val().trim();
        var passInput = $(this).find('input[type="password"]').val().trim();
        var mensajeError = $(this).find('.error-msg');
        
        if (mensajeError.length === 0) {
            $(this).prepend('<div class="error-msg" style="color:red; font-size:0.85rem; margin-bottom:10px; display:none;"></div>');
            mensajeError = $(this).find('.error-msg');
        }

        var usuarioEncontrado = null;

        for (var i = 0; i < usuariosBD.length; i++) {
            if (usuariosBD[i].correo.toLowerCase() === correoInput.toLowerCase() && usuariosBD[i].pass === passInput) {
                usuarioEncontrado = usuariosBD[i];
                break;
            }
        }

        if (usuarioEncontrado) {
            if (rolEsperado && usuarioEncontrado.rol !== rolEsperado) {
                mensajeError.text('Este usuario pertenece al rol de ' + usuarioEncontrado.rol).show();
            } else {
                iniciarSesionLocal(usuarioEncontrado.correo, usuarioEncontrado.rol, usuarioEncontrado.nombre);
                window.location.href = usuarioEncontrado.redirect;
            }
        } else {
            mensajeError.text('Correo o contraseña incorrectos').show();
        }
    });
}
