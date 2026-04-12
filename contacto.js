// Inicializar EmailJS (Reemplaza 'TU_PUBLIC_KEY' con la llave pública de tu cuenta en EmailJS)
emailjs.init({
    publicKey: "VGZoWseJ-akDTQwq6",
});

document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contactForm');

    if (contactForm) {
        contactForm.addEventListener('submit', function (event) {
            // Evitar que la página se recargue
            event.preventDefault();

            // Obtener el botón para darle feedback visual al usuario (cargando...)
            const submitBtn = document.getElementById('btn-submit');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = 'Enviando...';
            submitBtn.style.opacity = '0.7';
            submitBtn.disabled = true;

            // Recopilar los datos del formulario.
            // Estos nombres (from_name, email_id, etc) deben coincidir EXACTAMENTE
            // con las variables ({{...}}) que pongas en tu plantilla de correo en EmailJS.
            const templateParams = {
                name: document.getElementById('contact-name').value,
                email: document.getElementById('contact-email').value,
                user_type: document.getElementById('contact-type').value, 
                title: document.getElementById('contact-subject').value,
                message: document.getElementById('contact-message').value
            };

            // Enviar el correo usando tu ID de servicio y tu ID de plantilla guardados en EmailJS
            emailjs.send('service_fngp26n', 'template_j2vpch6', templateParams)
                .then(
                    function (response) {
                        // Éxito: Dar retroalimentación en el propio botón en lugar de un alert molesto
                        submitBtn.innerHTML = '¡Mensaje Enviado ✓!';
                        submitBtn.style.background = 'var(--green-600)';
                        submitBtn.style.color = 'white';
                        
                        contactForm.reset();
                        
                        // Restaurar el botón a la normalidad después de 4 segundos
                        setTimeout(() => {
                            submitBtn.innerHTML = originalText;
                            submitBtn.style.background = '';
                            submitBtn.style.opacity = '1';
                            submitBtn.disabled = false;
                        }, 4000);
                    },
                    function (error) {
                        // Error
                        console.error('FAILED...', error);
                        submitBtn.innerHTML = '❌ Error al enviar';
                        submitBtn.style.background = 'var(--red-600)';
                        
                        setTimeout(() => {
                            submitBtn.innerHTML = originalText;
                            submitBtn.style.background = '';
                            submitBtn.style.opacity = '1';
                            submitBtn.disabled = false;
                        }, 4000);
                    }
                );
        });
    }
});
