const MAX_OPACITY = 0.4;
const imageCanvas = document.getElementById('imageCanvas');
const maskCanvas = document.getElementById('maskCanvas');
const overlayCanvas = document.getElementById('overlayCanvas');
const ctx = imageCanvas.getContext('2d');
const maskCtx = maskCanvas.getContext('2d');
const overlayCtx = overlayCanvas.getContext('2d');
let BRUSH_SIZE = 10;
let MIN_BRUSH = 2;
let MAX_BRUSH = 30;

let currentImageUrl = '';
let currentMaskUrl = '';
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let tool = 'brush';
let singleChannelMask;

window.addEventListener('resize', adjustCanvasSize);

function adjustCanvasSize() {
    const container = document.querySelector('.canvas-container');
    const canvases = [imageCanvas, maskCanvas, overlayCanvas];
    
    canvases.forEach(canvas => {
        const scaleX = container.clientWidth / canvas.width;
        const scaleY = container.clientHeight / canvas.height;
        const scale = Math.min(scaleX, scaleY);
        
        canvas.style.width = `${canvas.width * scale}px`;
        canvas.style.height = `${canvas.height * scale}px`;
    });
}



function loadImagePair(img) {
    const imageUrl = `/image/images/${img}`;
    const maskUrl = `/image/masks/${img}`;
    currentImageUrl = imageUrl;
    currentMaskUrl = maskUrl;

    const image = new Image();
    image.onload = function() {
        // Set the actual canvas size to the image dimensions
        imageCanvas.width = maskCanvas.width = overlayCanvas.width = image.width;
        imageCanvas.height = maskCanvas.height = overlayCanvas.height = image.height;

        ctx.drawImage(image, 0, 0, image.width, image.height);
        loadMask(maskUrl);

        // Adjust canvas size after loading
        adjustCanvasSize();
    };
    image.src = imageUrl;
}

function loadMask(maskUrl) {
    const maskImg = new Image();
    maskImg.onload = function() {
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        maskCtx.drawImage(maskImg, 0, 0, maskCanvas.width, maskCanvas.height);
        singleChannelMask = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        applyMaskToOverlay();
    };
    maskImg.src = `${maskUrl}?t=${new Date().getTime()}`;
}

function applyMaskToOverlay() {
    const overlayImageData = overlayCtx.createImageData(overlayCanvas.width, overlayCanvas.height);
    
    for (let i = 0; i < singleChannelMask.data.length; i += 4) {
        const gray = singleChannelMask.data[i];
        overlayImageData.data[i] = 0; // Red
        overlayImageData.data[i + 1] = 255; // Green
        overlayImageData.data[i + 2] = 0; // Blue
        overlayImageData.data[i + 3] = Math.round(gray * MAX_OPACITY); // Alpha
    }

    overlayCtx.putImageData(overlayImageData, 0, 0);
}

function drawLine(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;

    while (true) {
        drawPoint(x0, y0);

        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
    }
}

function drawPoint(x, y) {
    for (let dx = -BRUSH_SIZE; dx <= BRUSH_SIZE; dx++) {
        for (let dy = -BRUSH_SIZE; dy <= BRUSH_SIZE; dy++) {
            if (dx*dx + dy*dy <= BRUSH_SIZE*BRUSH_SIZE) {
                const cx = x + dx;
                const cy = y + dy;
                if (cx >= 0 && cx < maskCanvas.width && cy >= 0 && cy < maskCanvas.height) {
                    const i = (cy * maskCanvas.width + cx) * 4;
                    const value = tool === 'brush' ? 255 : 0;
                    singleChannelMask.data[i] = value;
                    singleChannelMask.data[i+1] = value;
                    singleChannelMask.data[i+2] = value;
                    singleChannelMask.data[i+3] = 255;
                }
            }
        }
    }
}

function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX, clientY;

    if (evt.touches && evt.touches[0]) {
        // Touch event
        clientX = evt.touches[0].clientX;
        clientY = evt.touches[0].clientY;
    } else {
        // Mouse event
        clientX = evt.clientX;
        clientY = evt.clientY;
    }

    // return {
    //     x: Math.floor((evt.clientX - rect.left) * scaleX),
    //     y: Math.floor((evt.clientY - rect.top) * scaleY)
    // };
    return {
        x: Math.floor((clientX - rect.left) * scaleX),
        y: Math.floor((clientY - rect.top) * scaleY)
    };
}

function startDrawing(e) {
    e.preventDefault();
    isDrawing = true;
    const pos = getMousePos(overlayCanvas, e);
    lastX = pos.x;
    lastY = pos.y;
    draw(e);
}

function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    
    const pos = getMousePos(overlayCanvas, e);
    drawLine(lastX, lastY, pos.x, pos.y);
    lastX = pos.x;
    lastY = pos.y;
    
    maskCtx.putImageData(singleChannelMask, 0, 0);
    applyMaskToOverlay();
}

function stopDrawing() {
    isDrawing = false;
}

function clearMask() {
    maskCtx.fillStyle = 'black';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    singleChannelMask = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    applyMaskToOverlay();
}

function saveMask() {
    return new Promise((resolve, reject) => {
        maskCtx.putImageData(singleChannelMask, 0, 0);
        const maskData = maskCanvas.toDataURL('image/jpeg', 0.98);
        fetch('/save_mask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: maskData,
                maskFilename: currentMaskUrl.split('/').pop()
            }),
        })
        .then(response => response.json())
        .then(data => {
            console.log(data.message);
            resolve();
        })
        .catch((error) => {
            console.error('Error:', error);
            reject(error);
        });
    });
}


function toggleTool() {
    tool = tool === 'brush' ? 'eraser' : 'brush';
    document.getElementById('toolToggle').textContent = tool === 'brush' ? '🖌️' : '🧽';
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const img = urlParams.get('img');

    if (img) {
        loadImagePair(img);
        updateUrl(img);
    } else {
        fetch('/get_image_pair')
            .then(response => response.json())
            .then(data => {
                loadImagePair(data.filename);
                updateUrl(data.filename);
            });
    }

    const brushSizeSlider = document.getElementById('brushSizeSlider');
    const brushSizeValue = document.getElementById('brushSizeValue');
    brushSizeSlider.min = MIN_BRUSH;
    brushSizeSlider.max = MAX_BRUSH;
    brushSizeSlider.value = BRUSH_SIZE;
    brushSizeValue.textContent = BRUSH_SIZE;

    brushSizeSlider.addEventListener('input', (event) => {
        BRUSH_SIZE = event.target.value;
        brushSizeValue.textContent = BRUSH_SIZE;
    });

    // Mouse event listeners
    overlayCanvas.addEventListener('mousedown', startDrawing);
    overlayCanvas.addEventListener('mousemove', draw);
    overlayCanvas.addEventListener('mouseup', stopDrawing);
    overlayCanvas.addEventListener('mouseout', stopDrawing);

    // Touch event listeners
    overlayCanvas.addEventListener('touchstart', startDrawing);
    overlayCanvas.addEventListener('touchmove', draw);
    overlayCanvas.addEventListener('touchend', stopDrawing);
    overlayCanvas.addEventListener('touchcancel', stopDrawing);


    document.getElementById('clear').addEventListener('click', clearMask);
    document.getElementById('toolToggle').addEventListener('click', toggleTool);
    document.getElementById('prev').addEventListener('click', () => navigateImage('prev'));
    document.getElementById('next').addEventListener('click', () => navigateImage('next'));

    document.addEventListener('keydown', handleKeyNavigation);

    // Add event listener for showing brush outline
    overlayCanvas.addEventListener('mousemove', drawBrushOutline);
    overlayCanvas.addEventListener('mouseleave', hideBrushOutline);
    overlayCanvas.addEventListener('touchmove', drawBrushOutline);
    overlayCanvas.addEventListener('touchend', hideBrushOutline);
});
function handleKeyNavigation(event) {
    if (event.key === 'ArrowLeft') {
        navigateImage('prev');
    } else if (event.key === 'ArrowRight') {
        navigateImage('next');
    }
}

function navigateImage(direction) {
    saveMask(); // Save current mask before navigating
    fetch(`/get_image_pair?img=${currentImageUrl.split('/').pop()}&direction=${direction}`)
        .then(response => response.json())
        .then(data => {
            loadImagePair(data.filename);
            updateUrl(data.filename)
        });
}

function updateUrl(img) {
    history.pushState(null, '', `?img=${img}`);
    document.getElementById('title').textContent = img;
}

function hideBrushOutline() {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    applyMaskToOverlay();
}

function drawBrushOutline(event) {
    const pos = getMousePos(overlayCanvas, event);

    // Clear the previous overlay and redraw the mask
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    applyMaskToOverlay();

    // Draw brush outline
    overlayCtx.beginPath();
    overlayCtx.arc(pos.x, pos.y, BRUSH_SIZE, 0, Math.PI * 2);
    // Green outline for brush, red outline for eraser
    overlayCtx.strokeStyle = tool === 'brush' ? 'rgba(0, 255, 0, 0.6)' : 'rgba(255, 0, 0, 0.6)';
    overlayCtx.lineWidth = 2;
    overlayCtx.stroke();
}