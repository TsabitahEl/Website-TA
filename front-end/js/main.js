(function ($) {
    "use strict";

    // Spinner
    var spinner = function () {
        setTimeout(function () {
            if ($('#spinner').length > 0) {
                $('#spinner').removeClass('show');
            }
        }, 1);
    };
    spinner();
    
    
    // Initiate the wowjs
    new WOW().init();


    // Sticky Navbar
    $(window).scroll(function () {
        if ($(this).scrollTop() > 300) {
            $('.sticky-top').addClass('shadow-sm').css('top', '0px');
        } else {
            $('.sticky-top').removeClass('shadow-sm').css('top', '-100px');
        }
    });
    
    
    // Back to top button
    $(window).scroll(function () {
        if ($(this).scrollTop() > 300) {
            $('.back-to-top').fadeIn('slow');
        } else {
            $('.back-to-top').fadeOut('slow');
        }
    });
    $('.back-to-top').click(function () {
        $('html, body').animate({scrollTop: 0}, 1500, 'easeInOutExpo');
        return false;
    });


    // Facts counter
    $('[data-toggle="counter-up"]').counterUp({
        delay: 10,
        time: 2000
    });


    // Date and time picker
    $('.date').datetimepicker({
        format: 'L'
    });
    $('.time').datetimepicker({
        format: 'LT'
    });


    // Header carousel
    $(".header-carousel").owlCarousel({
        autoplay: false,
        animateOut: 'fadeOutLeft',
        items: 1,
        dots: true,
        loop: true,
        nav : true,
        navText : [
            '<i class="bi bi-chevron-left"></i>',
            '<i class="bi bi-chevron-right"></i>'
        ]
    });


    // Testimonials carousel
    $(".testimonial-carousel").owlCarousel({
        autoplay: false,
        smartSpeed: 1000,
        center: true,
        dots: false,
        loop: true,
        nav : true,
        navText : [
            '<i class="bi bi-arrow-left"></i>',
            '<i class="bi bi-arrow-right"></i>'
        ],
        responsive: {
            0:{
                items:1
            },
            768:{
                items:2
            }
        }
    });

    
})(jQuery);


document.addEventListener("DOMContentLoaded", function () {
    const startCameraButton = document.getElementById("startCamera");
    const closeCameraButton = document.getElementById("closeCamera");
    const captureImageButton = document.getElementById("captureImage");
    const cameraContainer = document.getElementById("camera-container");
    const cameraStream = document.getElementById("camera-stream");

    // Only initialize camera functionality if elements exist
    if (startCameraButton && closeCameraButton && captureImageButton && cameraContainer && cameraStream) {
        let stream;

        // Function to open camera
        startCameraButton.addEventListener("click", async function () {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
                cameraStream.srcObject = stream;

                // Show video and capture button
                cameraContainer.style.display = "block";
                captureImageButton.style.display = "block";

                // Toggle buttons
                startCameraButton.style.display = "none";
                closeCameraButton.style.display = "inline-block";
            } catch (err) {
                console.error("Error accessing camera:", err);
                alert("Could not access camera. Please make sure camera permissions are granted.");
            }
        });

        // Function to close camera
        closeCameraButton.addEventListener("click", function () {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            cameraStream.srcObject = null;
            cameraContainer.style.display = "none";
            captureImageButton.style.display = "none";
            startCameraButton.style.display = "inline-block";
            closeCameraButton.style.display = "none";
        });

        // Function to capture image
        captureImageButton.addEventListener("click", function () {
            const canvas = document.createElement("canvas");
            canvas.width = cameraStream.videoWidth;
            canvas.height = cameraStream.videoHeight;
            canvas.getContext("2d").drawImage(cameraStream, 0, 0);

            // Convert to base64
            const imageData = canvas.toDataURL("image/jpeg");
            
            // Set the captured image
            document.getElementById("vehicle_image").files = dataURLtoFile(imageData, "captured_image.jpg");
            document.getElementById("uploaded-image").src = imageData;
            
            // Close camera after capture
            closeCameraButton.click();
        });
    }


    // Camera handling for detection
    let stream = null;
    let isStreaming = false;

    function initializeCamera() {
        const startCameraBtn = document.getElementById('startCamera');
        const stopCameraBtn = document.getElementById('stopCamera');
        const webcamElement = document.getElementById('webcam');
        const canvasElement = document.getElementById('canvas');

        if (!startCameraBtn || !stopCameraBtn || !webcamElement || !canvasElement) {
            return; // Elements not found, probably not on detection page
        }

        // Start Camera
        startCameraBtn.addEventListener('click', async function() {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        width: 1280,
                        height: 720,
                        facingMode: 'environment' 
                    } 
                });
                webcamElement.srcObject = stream;
                webcamElement.style.display = 'block';
                startCameraBtn.style.display = 'none';
                stopCameraBtn.style.display = 'inline-block';
                isStreaming = true;
                
                detectFromCamera();
            } catch (err) {
                console.error('Error accessing camera:', err);
                alert('Could not access camera. Please make sure you have granted camera permissions.');
            }
        });

        // Stop Camera
        stopCameraBtn.addEventListener('click', function() {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                webcamElement.style.display = 'none';
                stopCameraBtn.style.display = 'none';
                startCameraBtn.style.display = 'inline-block';
                isStreaming = false;
            }
        });

        // Detection loop for camera feed
        async function detectFromCamera() {
            if (!isStreaming) return;

            const context = canvasElement.getContext('2d');
            canvasElement.width = webcamElement.videoWidth;
            canvasElement.height = webcamElement.videoHeight;
            
            context.drawImage(webcamElement, 0, 0);
            const imageData = canvasElement.toDataURL('image/jpeg');

            try {
                const response = await fetch('/predict', {
                    method: 'POST',
                    body: JSON.stringify({ image: imageData }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                if (typeof updateCounters === 'function') {
                    updateCounters(data);
                }
                
                requestAnimationFrame(detectFromCamera);
            } catch (error) {
                console.error('Detection error:', error);
                setTimeout(detectFromCamera, 1000);
            }
        }
    }

    initializeCamera();
});
