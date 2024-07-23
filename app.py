from flask import Flask, render_template, request, jsonify, send_from_directory
import os
from PIL import Image
import base64
import io
import numpy as np

app = Flask(__name__)

IMAGE_FOLDER = 'images'
MASK_FOLDER = 'masks'

@app.route('/')
def index():
    img = request.args.get('img', '')
    return render_template('index.html', initial_img=img)

@app.route('/get_image_pair')
def get_image_pair():
    img = request.args.get('img', '')
    direction = request.args.get('direction', '')
    image_files = sorted(os.listdir(IMAGE_FOLDER))
    
    if img and img in image_files:
        current_index = image_files.index(img)
    else:
        current_index = 0

    if direction == 'prev':
        current_index = (current_index - 1) % len(image_files)
    elif direction == 'next':
        current_index = (current_index + 1) % len(image_files)
    
    current_filename = image_files[current_index]
    mask_path = os.path.join(MASK_FOLDER, current_filename)
    if not os.path.exists(mask_path):
        image = Image.open(os.path.join(IMAGE_FOLDER, current_filename))
        mask = Image.new('L', image.size, 0)  # Create a black (fully transparent) mask
        mask.save(mask_path, 'JPEG', quality=98)
    
    return jsonify({
        'filename': current_filename,
        'total_pairs': len(image_files),
        'current_index': current_index 
    })

@app.route('/app.js')
def serve_app_js():
    # send the app.js file
    return send_from_directory('', 'app.js')

@app.route('/image/<path:filename>')
def serve_image(filename):
    directory = os.path.dirname(filename)
    file = os.path.basename(filename)
    return send_from_directory(directory, file)

@app.route('/save_mask', methods=['POST'])
def save_mask():
    data = request.json
    image_data = base64.b64decode(data['image'].split(',')[1])
    mask_filename = data['maskFilename']
    
    mask_path = os.path.join(MASK_FOLDER, mask_filename)
    
    # Open the image and convert to grayscale
    image = Image.open(io.BytesIO(image_data)).convert('L')
    
    # Save the grayscale image as JPEG with 98% quality
    image.save(mask_path, 'JPEG', quality=98)
    
    return jsonify({'message': 'Mask saved successfully'})

if __name__ == '__main__':
    app.run(debug=True)