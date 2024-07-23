# app.py
from flask import Flask, render_template, request, jsonify, send_from_directory
import os
from PIL import Image
import base64
import io
import numpy as np

app = Flask(__name__)

# Configure these paths according to your directory structure
IMAGE_FOLDER = 'images'
MASK_FOLDER = 'masks'

@app.route('/')
def index():
    img = request.args.get('img', '')
    return render_template('index.html', initial_img=img)

@app.route('/get_image_pair')
def get_image_pair():
    img = request.args.get('img', '')
    image_files = sorted(os.listdir(IMAGE_FOLDER))
    
    if img and img in image_files:
        current_index = image_files.index(img)
    else:
        current_index = int(request.args.get('index', 0))
    
    if current_index < 0 or current_index >= len(image_files):
        return jsonify({'error': 'Invalid image or index'}), 400
    
    prev_index = (current_index - 1) % len(image_files)
    next_index = (current_index + 1) % len(image_files)

    current_filename = image_files[current_index]
    mask_path = os.path.join(MASK_FOLDER, current_filename)
    if not os.path.exists(mask_path):
        image = Image.open(os.path.join(IMAGE_FOLDER, current_filename))
        mask = Image.new('L', image.size, 0)  # Create a black mask
        mask.save(mask_path)
    
    return jsonify({
        'image': f'/image/{IMAGE_FOLDER}/{current_filename}',
        'mask': f'/image/{MASK_FOLDER}/{current_filename}',
        'filename': current_filename,
        'prev_filename': image_files[prev_index],
        'next_filename': image_files[next_index],
        'total_pairs': len(image_files),
        'current_index': current_index
    })

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
    
    # Open the image and ensure it's grayscale
    image = Image.open(io.BytesIO(image_data)).convert('L')
    
    # Save the grayscale image as JPEG
    image.save(mask_path, 'JPEG', quality=95)
    
    return jsonify({'message': 'Mask saved successfully'})

if __name__ == '__main__':
    app.run(debug=True)