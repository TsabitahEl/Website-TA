from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from PIL import Image, ImageDraw, ImageFont
from ultralytics import YOLO
import firebase_admin
from firebase_admin import credentials, db

# Initialize Firebase Admin
cred = credentials.Certificate("path/to/serviceAccountKey.json")
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://mlff-2-default-rtdb.firebaseio.com'
})

# Get database reference
ref = db.reference('/')

app = Flask(__name__)
CORS(app)

# Muat model YOLOv5 menggunakan Ultralytics YOLO
try:
    # Use Ultralytics YOLO directly instead of torch.hub
    model = YOLO('mlffv11-train-mlff-fix/content/runs/detect/train/weights/best.pt')
    print("Model YOLOv5 berhasil dimuat.")
    
    # Tambahkan debugging informasi model
    print("/n--- Model Debugging Info ---")
    print(f"Model type: {type(model)}")
    print("Model attributes:")
    for attr in dir(model):
        if not attr.startswith('__'):
            print(f"- {attr}")
    
    # Contoh cara memeriksa metode spesifik
    print("/nTesting model inference to see available methods:")
    test_image = Image.new('RGB', (640, 480), color='red')
    results = model(test_image)
    print(f"Inference results type: {type(results)}")
    print(f"Number of results: {len(results)}")
    if results:
        print("First result attributes:")
        first_result = results[0]
        print(f"Result type: {type(first_result)}")
        print("Result attributes:")
        for attr in dir(first_result):
            if not attr.startswith('__'):
                print(f"- {attr}")
except Exception as e:
    print(f"Error loading YOLO model: {e}")
    model = None

# Menentukan golongan kendaraan
vehicle_classes = {
    0: 'G1',  # Golongan 1
    1: 'G2',  # Golongan 2
    2: 'G3',  # Golongan 3
    3: 'G4',  # Golongan 4
    4: 'G5',  # Golongan 5
}

def get_color_for_vehicle(class_id):
    """Mengambil warna untuk setiap golongan kendaraan"""
    colors = {
        0: '#FF7E5F',  # Golongan 1
        1: '#FFD700',  # Golongan 2
        2: '#ADFF2F',  # Golongan 3
        3: '#00CED1',  # Golongan 4
        4: '#FF69B4',  # Golongan 5
    }
    return colors.get(class_id, '#FFFFFF')  # Default warna putih

@app.route('/')
def home():
    """Halaman utama"""
    return render_template('index.html')

@app.route('/about')
def about():
    """Halaman about"""
    return render_template('about.html')

@app.route('/application', methods=['GET', 'POST'])
def application():
    """Halaman untuk upload gambar dan prediksi kendaraan"""
    if request.method == 'POST':
        # Ambil file dari form-data
        file = request.files.get('image')
        if not file or file.filename == '':
            return jsonify({'error': 'No image uploaded'}), 400

        if not file.filename.lower().endswith(('jpg', 'jpeg', 'png')):
            return jsonify({'error': 'Unsupported file type. Only JPG, JPEG, or PNG are allowed'}), 400

        try:
            # Baca gambar menggunakan PIL
            image = Image.open(file.stream)

            # Deteksi objek menggunakan YOLOv5
            results = model(image)
            
            # Process results
            boxes = []
            
            # Ultralytics YOLO returns a list of Results objects
            if results:
                # Access the first (and likely only) result
                result = results[0]
                
                # Get boxes, confidences, and class IDs
                for box in result.boxes:
                    # Extract bounding box coordinates
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    
                    # Get confidence and class
                    conf = float(box.conf)
                    class_id = int(box.cls)
                    
                    # Only process vehicle classes
                    if class_id in vehicle_classes:
                        label = vehicle_classes[class_id]
                        
                        # Draw bounding box
                        draw = ImageDraw.Draw(image)
                        try:
                            font = ImageFont.truetype("arial.ttf", 20)
                        except IOError:
                            font = ImageFont.load_default()
                        draw.rectangle([x1, y1, x2, y2], outline=get_color_for_vehicle(class_id), width=3)
                        draw.text((x1, y1), label, fill=get_color_for_vehicle(class_id), font=font)

            # Mengubah gambar ke format base64
            buffered = io.BytesIO()
            image.save(buffered, format="JPEG")
            img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
            print("Gambar berhasil dikonversi ke base64.")

            # Kirim hasil gambar ke halaman service.html
            vehicles = []
            if results:
                result = results[0]
                boxes = result.boxes.xyxy.cpu().numpy()
                confs = result.boxes.conf.cpu().numpy()
                class_ids = result.boxes.cls.cpu().numpy()
                for box, conf, class_id in zip(boxes, confs, class_ids):
                    x1, y1, x2, y2 = box
                    class_id = int(class_id)
                    if class_id in vehicle_classes:
                        label = vehicle_classes[class_id]
                    else:
                        label = "Unknown"  # Default label for undefined class IDs
                    vehicles.append({
                        'x1': int(x1),
                        'y1': int(y1),
                        'x2': int(x2),
                        'y2': int(y2),
                        'label': label,
                        'color': get_color_for_vehicle(class_id)
                    })
            return jsonify({
                'vehicles': vehicles, 
                'image': f"data:image/jpeg;base64,{img_str}",
                'total_detected': len(vehicles)
            })

        except Exception as e:
            print(f"Error selama pemrosesan gambar: {e}")
            return jsonify({'error': f'Error processing image: {str(e)}'}), 500

    # Untuk metode GET, hanya tampilkan halaman kosong
    return render_template('app.html')

@app.route('/predict', methods=['POST'])
def detect_from_image_upload():
    """Menerima gambar yang di-upload dan mengembalikan hasil deteksi dalam format JSON"""
    try:
        print("Received request to /predict")
        
        # Check if model is loaded
        if model is None:
            return jsonify({'error': 'YOLO model not initialized'}), 500

        if 'image' in request.json:  # For camera feed
            # Decode base64 image
            image_data = request.json['image'].split(',')[1]
            image = Image.open(io.BytesIO(base64.b64decode(image_data)))
        else:  # For file upload
            file = request.files.get('image')
            image = Image.open(file.stream)

        # Deteksi objek menggunakan YOLO
        results = model(image)
        
        # Process results
        vehicles = []
        
        # Ultralytics YOLO returns a list of Results objects
        if results:
            # Access the first (and likely only) result
            result = results[0]
            
            # Get boxes, confidences, and class IDs
            boxes = result.boxes
            
            for box in boxes:
                # Extract bounding box coordinates
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                
                # Get confidence and class
                conf = float(box.conf)
                cls = int(box.cls)
                
                # Only process vehicle classes
                if cls in vehicle_classes:
                    label = vehicle_classes[cls]
                    
                    vehicles.append({
                        'x1': float(x1),
                        'y1': float(y1),
                        'x2': float(x2),
                        'y2': float(y2),
                        'confidence': conf,
                        'label': label,
                        'color': get_color_for_vehicle(cls)
                    })
        
        # Draw boxes on the image
        img_with_boxes = image.copy()
        draw = ImageDraw.Draw(img_with_boxes)
        try:
            font = ImageFont.truetype("arial.ttf", 20)
        except IOError:
            font = ImageFont.load_default()

        for vehicle in vehicles:
            draw.rectangle(
                [vehicle['x1'], vehicle['y1'], vehicle['x2'], vehicle['y2']], 
                outline=vehicle['color'], 
                width=3
            )
            label = f"{vehicle['label']} {vehicle['confidence']:.2f}"
            draw.text(
                (vehicle['x1'], vehicle['y1'] - 20), 
                label, 
                fill=vehicle['color'], 
                font=font
            )

        # Convert image to base64
        try:
            buffered = io.BytesIO()
            img_with_boxes.save(buffered, format="JPEG")
            img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
            print("Successfully encoded image to base64")
        except Exception as e:
            print(f"Error encoding image: {str(e)}")
            return jsonify({'error': f'Error encoding image: {str(e)}'}), 500

        response = {
            'vehicles': vehicles, 
            'image': f"data:image/jpeg;base64,{img_str}",
            'total_detected': len(vehicles)
        }
        print(f"Detected and processed {len(vehicles)} vehicles")

        # After processing results, save to Firebase
        if results:
            detection_data = {
                'total_vehicles': len(vehicles),
                'timestamp': {'.sv': 'timestamp'},
                'vehicles': vehicles
            }
            
            # Push data to Firebase
            ref.child('detections').push(detection_data)

        return jsonify(response)

    except Exception as e:
        print(f"Unexpected error in predict endpoint: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/our_team')
def our_team():
    """Halaman testimonial"""
    return render_template('our_team.html')

def save_detection_to_firebase(vehicles_data):
    try:
        detection_ref = ref.child('detections')
        detection_ref.push({
            'timestamp': {'.sv': 'timestamp'},
            'data': vehicles_data
        })
        return True
    except Exception as e:
        print(f"Firebase error: {e}")
        return False

def get_detection_history():
    try:
        detections = ref.child('detections').order_by_child('timestamp').limit_to_last(100).get()
        return detections
    except Exception as e:
        print(f"Firebase error: {e}")
        return None

if __name__ == '__main__':
    app.run(port=5000, debug=True)
