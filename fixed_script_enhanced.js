let currentTool = 'pen';
let currentColor = '#000000';
let drawing = false;
let smartFillMode = false;
const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d');
const svgObject = document.getElementById('svgImage');
let canvasHistory = [];

function resizeCanvas() {
  canvas.width = svgObject.clientWidth;
  canvas.height = svgObject.clientHeight;
}

window.addEventListener('resize', resizeCanvas);
svgObject.addEventListener('load', () => {
  resizeCanvas();
  saveState(); // save initial state
});

function saveState() {
  if (canvasHistory.length > 20) {
    canvasHistory.shift(); // Keep only last 20 states
  }
  canvasHistory.push(canvas.toDataURL());
}

function undo() {
  if (canvasHistory.length > 1) {
    canvasHistory.pop();
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = canvasHistory[canvasHistory.length - 1];
  }
}

function saveImage() {
  try {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    // White background
    tempCtx.fillStyle = '#ffffff';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Try to get SVG content
    const svgDoc = svgObject.contentDocument;
    if (svgDoc) {
      const svg = svgDoc.documentElement;
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        // Draw SVG first
        tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
        // Draw canvas content on top
        tempCtx.drawImage(canvas, 0, 0);
        
        // Create download link
        const link = document.createElement('a');
        link.href = tempCanvas.toDataURL('image/png');
        link.download = 'puffin_coloring.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } else {
      // Fallback: just save the canvas drawing
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = 'puffin_drawing.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (error) {
    console.error('Save failed:', error);
    // Final fallback
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'puffin_drawing.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

function setTool(tool) {
  currentTool = tool;
  smartFillMode = (tool === 'smartfill');
  
  // Update button states
  document.querySelectorAll('.tool-button').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const activeBtn = document.querySelector(`[data-tool="${tool}"]`);
  activeBtn.classList.add('active');
  
  // Visual feedback for smart fill mode
  if (smartFillMode) {
    activeBtn.style.backgroundColor = '#ffeb3b';
    canvas.style.cursor = 'crosshair';
  } else {
    activeBtn.style.backgroundColor = '';
    canvas.style.cursor = 'default';
  }
}

function setColor(color) {
  currentColor = color;
}

// Canvas drawing events
canvas.addEventListener('mousedown', e => {
  if (smartFillMode) return;
  drawing = true;
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
});

canvas.addEventListener('mousemove', e => {
  if (drawing && !smartFillMode) {
    ctx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : currentColor;
    ctx.lineWidth = currentTool === 'brush' ? 12 : currentTool === 'eraser' ? 20 : 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
  }
});

canvas.addEventListener('mouseup', e => {
  if (!smartFillMode && drawing) {
    drawing = false;
    ctx.closePath();
    saveState();
  }
});

// FIXED SMART FILL FUNCTIONALITY
document.addEventListener('click', e => {
  if (!smartFillMode) return;
  
  try {
    // Get the element that was clicked
    const clickedElement = document.elementFromPoint(e.clientX, e.clientY);
    
    // Check if it's an SVG element or find the closest SVG element
    let svgElement = null;
    
    if (clickedElement && clickedElement.tagName) {
      // If clicked directly on an SVG element
      if (['path', 'circle', 'ellipse', 'rect', 'polygon', 'g'].includes(clickedElement.tagName.toLowerCase())) {
        svgElement = clickedElement;
      } else {
        // Try to find SVG element within the clicked area
        svgElement = clickedElement.closest('path, circle, ellipse, rect, polygon, g');
      }
    }
    
    // Alternative method: try to access SVG through the object
    if (!svgElement && svgObject.contentDocument) {
      const svgDoc = svgObject.contentDocument;
      const rect = svgObject.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Get all fillable elements
      const elements = svgDoc.querySelectorAll('[id], path, circle, ellipse, rect, polygon');
      
      // Simple hit detection - check if click is within element bounds
      for (let el of elements) {
        try {
          const bbox = el.getBBox();
          const relativeX = (x / rect.width) * svgDoc.documentElement.viewBox.baseVal.width;
          const relativeY = (y / rect.height) * svgDoc.documentElement.viewBox.baseVal.height;
          
          if (relativeX >= bbox.x && relativeX <= bbox.x + bbox.width &&
              relativeY >= bbox.y && relativeY <= bbox.y + bbox.height) {
            svgElement = el;
            break;
          }
        } catch (err) {
          // Skip elements that can't be measured
          continue;
        }
      }
    }
    
    // Apply fill if we found an element
    if (svgElement) {
      svgElement.setAttribute('fill', currentColor);
      saveState();
      console.log('Filled element:', svgElement.tagName, svgElement.id || 'no-id');
    } else {
      console.log('No fillable element found at click position');
    }
    
  } catch (error) {
    console.error('Smart fill error:', error);
  }
});

// Tool button events
document.querySelectorAll('.tool-button').forEach(button => {
  button.addEventListener('click', () => {
    const tool = button.dataset.tool;
    if (tool === 'undo') {
      undo();
    } else if (tool === 'save') {
      saveImage();
    } else {
      setTool(tool);
    }
  });
});

// Color swatch events
document.querySelectorAll('.color-swatch').forEach(swatch => {
  swatch.addEventListener('click', () => {
    setColor(swatch.dataset.color);
  });
});

// Touch support for mobile devices
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  canvas.dispatchEvent(mouseEvent);
});

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  canvas.dispatchEvent(mouseEvent);
});

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  const mouseEvent = new MouseEvent('mouseup', {});
  canvas.dispatchEvent(mouseEvent);
});

// Initialize when page loads
window.addEventListener('load', () => {
  resizeCanvas();
  saveState();
});