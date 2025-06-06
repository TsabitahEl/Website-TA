document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('vehicle_image');
    const uploadedImage = document.getElementById('uploaded-image');
    const predictionResult = document.getElementById('prediction-result');
    const resultText = document.getElementById('result-text');
    const predictButton = document.getElementById('predict-button');
    const imageUpload = document.getElementById('image-upload');
    const detectBtn = document.getElementById('detect-btn');
    const previewImage = document.getElementById('preview-image');

    if (fileInput && predictButton) {
        // Handle file selection
        fileInput.addEventListener('change', function() {
            if (fileInput.files && fileInput.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    uploadedImage.src = e.target.result;
                    uploadedImage.style.display = 'block';
                };
                reader.readAsDataURL(fileInput.files[0]);
            }
        });

        // Handle predict button click
        predictButton.addEventListener('click', function() {
            if (!fileInput.files || !fileInput.files[0]) {
                alert('Please select an image first');
                return;
            }

            const formData = new FormData();
            formData.append('image', fileInput.files[0]);

            // Show loading state
            predictButton.disabled = true;
            predictButton.innerHTML = '<i class="fa fa-spinner fa-spin me-2"></i>Predicting...';

            fetch('http://localhost:5000/predict', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Full server response:', data);
                
                // Show prediction result container
                predictionResult.style.display = 'block';
                
                // Update the image with detected objects
                if (data.image) {
                    uploadedImage.src = data.image;
                    uploadedImage.style.display = 'block';
                }

                // Display vehicle information
                if (data.vehicles && data.vehicles.length > 0) {
                    let resultHtml = '<h4>Detected Vehicles:</h4>';
                    data.vehicles.forEach(vehicle => {
                        resultHtml += `<p style="color: ${vehicle.color}">
                            ${vehicle.label} (Confidence: ${(vehicle.confidence * 100).toFixed(2)}%)
                        </p>`;
                    });
                    resultText.innerHTML = resultHtml;
                } else {
                    resultText.innerHTML = '<p>No vehicles detected in this image</p>';
                }
            })
            .catch(error => {
                console.error('Error:', error);
                resultText.innerHTML = `<p style="color: red">Error: ${error.message}</p>`;
            })
            .finally(() => {
                // Reset button state
                predictButton.disabled = false;
                predictButton.innerHTML = '<i class="fa fa-magic text-black me-2"></i>Predict';
            });
        });
    }

    // Camera functionality
    const startCameraButton = document.getElementById('startCamera');
    const closeCameraButton = document.getElementById('closeCamera');
    const captureImageButton = document.getElementById('captureImage');
    const cameraContainer = document.getElementById('camera-container');
    const cameraStream = document.getElementById('camera-stream');
    const captureCanvas = document.getElementById('capture-canvas');

    let stream;

    if (startCameraButton && closeCameraButton && captureImageButton) {
        startCameraButton.addEventListener('click', async function() {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
                cameraStream.srcObject = stream;
                cameraContainer.style.display = 'block';
                captureImageButton.style.display = 'block';
                startCameraButton.style.display = 'none';
                closeCameraButton.style.display = 'inline-block';
            } catch (err) {
                console.error('Error accessing camera:', err);
                alert('Error accessing camera: ' + err.message);
            }
        });

        closeCameraButton.addEventListener('click', function() {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                cameraStream.srcObject = null;
                cameraContainer.style.display = 'none';
                startCameraButton.style.display = 'inline-block';
                closeCameraButton.style.display = 'none';
                captureImageButton.style.display = 'none';
            }
        });

        captureImageButton.addEventListener('click', function() {
            // Create a canvas element to capture the image
            const context = captureCanvas.getContext('2d');
            captureCanvas.width = cameraStream.videoWidth;
            captureCanvas.height = cameraStream.videoHeight;
            context.drawImage(cameraStream, 0, 0, captureCanvas.width, captureCanvas.height);

            // Convert canvas to blob
            captureCanvas.toBlob(function(blob) {
                const formData = new FormData();
                formData.append('image', blob, 'capture.jpg');

                fetch('http://localhost:5000/predict', {
                    method: 'POST',
                    body: formData
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Full server response:', data);  
                    if (data.error) {
                        throw new Error(data.error);
                    }
                    
                    // Always show the prediction result container
                    predictionResult.style.display = 'block';
                    
                    // Update the image if available
                    if (data.image) {
                        uploadedImage.src = data.image;
                        uploadedImage.style.display = 'block';
                    }
                    
                    // Display vehicle information
                    let resultHtml = '<h4>Detection Results:</h4>';
                    if (data.vehicles && data.vehicles.length > 0) {
                        data.vehicles.forEach(vehicle => {
                            resultHtml += `<p style="color: ${vehicle.color}">
                                ${vehicle.label} (Confidence: ${(vehicle.confidence * 100).toFixed(2)}%)
                            </p>`;
                        });
                    } else {
                        resultHtml += '<p>No vehicles were detected in this image.</p>';
                    }
                    resultText.innerHTML = resultHtml;
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Error in prediction: ' + error.message);
                });
            }, 'image/jpeg', 0.9);
        });
    }

    // Update counters
    function updateCounters(data) {
        // Update total count
        document.getElementById('total-vehicles').textContent = data.total_detected;
        
        // Update individual class counters
        const counts = {
            'G1': 0, 'G2': 0, 'G3': 0, 'G4': 0, 'G5': 0
        };
        
        // Count vehicles by class
        data.vehicles.forEach(vehicle => {
            if (counts.hasOwnProperty(vehicle.label)) {
                counts[vehicle.label]++;
            }
        });
        
        // Update counter displays
        Object.keys(counts).forEach(label => {
            const element = document.getElementById(`${label.toLowerCase()}-count`);
            if (element) {
                element.textContent = counts[label];
            }
        });

        // Update V/C ratio
        const capacity = 1000; // Assumed road capacity
        const vcRatio = data.total_detected / capacity;
        updateVCRatio(vcRatio);
    }

    // Handle detection
    detectBtn.addEventListener('click', function() {
        const file = imageUpload.files[0];
        if(!file) return;

        const formData = new FormData();
        formData.append('image', file);

        fetch('/predict', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            previewImage.src = data.image;
            previewImage.style.display = 'block';
            updateCounters(data);
            // Update V/C ratio
            window.updateVCRatio(data.total_detected);
        })
        .catch(error => console.error('Error:', error));
    });
});
