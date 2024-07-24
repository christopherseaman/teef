const MAX_OPACITY = 0.4;
const imageCanvas = document.getElementById('imageCanvas');
const maskCanvas = document.getElementById('maskCanvas');
const overlayCanvas = document.getElementById('overlayCanvas');
const ctx = imageCanvas.getContext('2d');
const maskCtx = maskCanvas.getContext('2d');
const overlayCtx = overlayCanvas.getContext('2d');
let BRUSH_SIZE = 5;
const MIN_BRUSH = 2;
const MAX_BRUSH = 25;

let currentImageUrl = '';
let currentMaskUrl = '';
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let tool = 'brush';
let singleChannelMask;

window.addEventListener('resize', () => {
    if (currentImageUrl) {
        loadImagePair(currentImageUrl.split('/').pop());
    }
});

function loadImagePair(img) {
    const imageUrl = `/image/images/${img}`;
    const maskUrl = `/image/masks/${img}`;
    currentImageUrl = imageUrl;
    currentMaskUrl = maskUrl;

    const image = new Image();
    image.onload = function() {
        const container = document.querySelector('.canvas-container');
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const imageAspectRatio = image.width / image.height;
        const containerAspectRatio = containerWidth / containerHeight;

        let canvasWidth, canvasHeight;
        if (imageAspectRatio > containerAspectRatio) {
            canvasWidth = containerWidth;
            canvasHeight = containerWidth / imageAspectRatio;
        } else {
            canvasHeight = containerHeight;
            canvasWidth = containerHeight * imageAspectRatio;
        }

        // Set the actual canvas size to the image dimensions
        imageCanvas.width = maskCanvas.width = overlayCanvas.width = image.width;
        imageCanvas.height = maskCanvas.height = overlayCanvas.height = image.height;

        // Set the display size of canvases
        const canvases = [imageCanvas, maskCanvas, overlayCanvas];
        canvases.forEach(canvas => {
            canvas.style.width = `${canvasWidth}px`;
            canvas.style.height = `${canvasHeight}px`;
        });

        singleChannelMask = null;

        ctx.drawImage(image, 0, 0, image.width, image.height);
        loadMask(maskUrl);
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

    return {
        x: Math.floor((evt.clientX - rect.left) * scaleX),
        y: Math.floor((evt.clientY - rect.top) * scaleY)
    };
}

function startDrawing(e) {
    isDrawing = true;
    const pos = getMousePos(overlayCanvas, e);
    lastX = pos.x;
    lastY = pos.y;
    draw(e);
}

function draw(e) {
    if (!isDrawing) return;
    
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

    overlayCanvas.addEventListener('mousedown', startDrawing);
    overlayCanvas.addEventListener('mousemove', draw);
    overlayCanvas.addEventListener('mouseup', stopDrawing);
    overlayCanvas.addEventListener('mouseout', stopDrawing);

    document.getElementById('clear').addEventListener('click', clearMask);
    document.getElementById('toolToggle').addEventListener('click', toggleTool);
    document.getElementById('prev').addEventListener('click', () => navigateImage('prev'));
    document.getElementById('next').addEventListener('click', () => navigateImage('next'));

    document.addEventListener('keydown', handleKeyNavigation);

    // Add event listener for showing brush outline
    overlayCanvas.addEventListener('mousemove', drawBrushOutline);
    overlayCanvas.addEventListener('mouseleave', hideBrushOutline);
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