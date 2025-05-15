//TODO: check bounds for int, etc. before passing into wasm
const main = document.getElementById('main');
const _input = document.getElementById('input_label');
const preview_container = document.getElementById('preview_container');
const preview_canvas = document.getElementById('preview_canvas');
const config_container = document.getElementById('config_container');
const config_popup = document.getElementById('config_popup');
const _c_preview_reset = document.getElementById('_c_preview_reset');
const _c_preview_crop = document.getElementById('_c_preview_crop');
const _c_preview_rotate = document.getElementById('_c_preview_rotate');
const _c_preview_view = document.getElementById('_c_preview_view');
const _c_preview_hide = document.getElementById('_c_preview_hide');
const _c_config_view = document.getElementById('_c_config_view');
const _c_config_hide = document.getElementById('_c_config_hide');
const config_format = document.getElementById('config_format');
const config_quality = document.getElementById('config_quality');
const config_quality_visual = document.getElementById('config_quality_visual');
const config_width = document.getElementById('config_width');
const config_width_auto = document.getElementById('config_width_auto');
const config_height = document.getElementById('config_height');
const config_height_auto = document.getElementById('config_height_auto');
const action_button = document.getElementById('action_button');
const bottom_info = document.getElementById('bottom_info');

// --------------------------- WASM SAFETY ---------------------

// Int
function safeInt(i)
{
	const INT_MIN = -2147483648;
	const INT_MAX = 2147483647;
	return (i >= INT_MIN && i <= INT_MAX) ? i : 0;
}

// -------------------------------------------------------------

// --------------------------- GLOBALS -------------------------

// Structs
var filename = "";
var input_format = null;
var isCropping = false;
var rotate = 0;
var conversionConfig =
{
	format: null,
	quality: null,
	width: null,
	height: null,
}
var decodedImage = 
{
	pixels: null,
	width: null,
	height: null,
	ratio: null,
	channels: null,
}
var previewWindow =
{
	scale: 1,
	lastTouchesDist: 0,
	lastX: 0,
	lastY: 0,
	offsetX: 0,
	offsetY: 0,
	isDragging: false,
	isTouchZooming: false,
};
var cropRect =
{
	x: 0,
	y: 0,
	w: 0,
	h: 0,
	lastX: 0,
	lastY: 0,
	offsetX: 0,
	offsetY: 0,
	vertex: 0,
	dragging: false,
};

// Resets
function resetConfig()
{
	config_format.value = formatEnumToString(input_format);
	config_quality.value = input_format == 0 ? 100 : 90;
	config_quality_visual.textContent = config_quality.value;
	config_width.value = decodedImage.width;
	config_height.value = decodedImage.height;
}
function resetPreviewWindow()
{
	previewWindow =
	{
		scale: 1,
		lastTouchesDist: 0,
		lastX: 0,
		lastY: 0,
		offsetX: 0,
		offsetY: 0,
		isDragging: false,
		isTouchZooming: false,
	};
}
function resetCurrentCrop(width, height)
{
	cropRect =
	{
		x: 0,
		y: 0,
		w: width - 1,
		h: height - 1,
		lastX: 0,
		lastY: 0,
		offsetX: 0,
		offsetY: 0,
		vertex: 0,
		dragging: false,
	};
}

// Utils
function applyConfig()
{
	conversionConfig.format = formatStringToEnum(config_format.value);
	conversionConfig.quality = parseInt(config_quality.value, 10);
	conversionConfig.width = parseInt(config_width.value, 10);
	conversionConfig.height = parseInt(config_height.value, 10);
}

// -------------------------------------------------------------

// --------------------------- CANVAS --------------------------

// Main canvas
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = false;

// Virtual canvas
const vCanvas = document.createElement('canvas');
const vContext = vCanvas.getContext('2d');
vContext.imageSmoothingEnabled = false;

// Constants
const CONST_CROPTHICKNESS = 1;
const CONST_CROPSQUAREAREA = 16;
const CONST_ZOOMFACTOR = 1.1;
const CONST_MOBILEZOOMFACTOR = 1.05;

// Draw, vCanvas into canvas
function draw()
{
	// Apply pan and zoom
	context.setTransform(1, 0, 0, 1, 0, 0);
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.imageSmoothingEnabled = false;
	context.setTransform(previewWindow.scale, 0, 0, previewWindow.scale, previewWindow.offsetX, previewWindow.offsetY);

	// Apply rotation
	if(rotate != 0 && isCropping == false)
	{
		context.translate(vCanvas.width / 2, vCanvas.height / 2);
		context.rotate(rotate * Math.PI / 2);
		context.translate(-1 * vCanvas.width / 2, -1 * vCanvas.height / 2);
	}

	// Draw image
	context.drawImage(vCanvas, 0, 0);

	// Draw cropbox
	const cropX = Math.round(cropRect.x);
	const cropY = Math.round(cropRect.y);
	const cropW = Math.round(cropRect.w);
	const cropH = Math.round(cropRect.h);
	if(isCropping == true)
	{
		context.fillStyle = 'red';
		context.fillRect(cropX + 1 - CONST_CROPSQUAREAREA, cropY + 1 - CONST_CROPSQUAREAREA, CONST_CROPSQUAREAREA, CONST_CROPSQUAREAREA);
		context.fillRect(cropX + 1 - CONST_CROPSQUAREAREA, cropY + cropH, CONST_CROPSQUAREAREA, CONST_CROPSQUAREAREA);
		context.fillRect(cropX + cropW, cropY + 1 - CONST_CROPSQUAREAREA, CONST_CROPSQUAREAREA, CONST_CROPSQUAREAREA);
		context.fillRect(cropX + cropW, cropY + cropH, CONST_CROPSQUAREAREA, CONST_CROPSQUAREAREA);
	}
	context.save();
	context.fillStyle = 'rgba(0, 0, 0, 0.25)';
	context.fillRect(cropX, cropY, cropW, cropH);
	context.restore();
	context.strokeStyle = 'rgba(255, 0, 0 , 0.6)';
	context.lineWidth = CONST_CROPTHICKNESS;
	context.strokeRect(cropX + CONST_CROPTHICKNESS/2, cropY + CONST_CROPTHICKNESS/2, cropW, cropH);
}

// Click
function press(x, y)
{
	const rect = canvas.getBoundingClientRect();
	previewWindow.isDragging = true;
	previewWindow.isTouchZooming = false;
	previewWindow.lastX = x - rect.left;
	previewWindow.lastY = y - rect.top;
}

// Move
function move(x, y)
{
	if(!previewWindow.isDragging || previewWindow.isTouchZooming) return;
	const rect = canvas.getBoundingClientRect();

	const dx = x - rect.left - previewWindow.lastX;
	const dy = y - rect.top - previewWindow.lastY;

	previewWindow.offsetX += dx;
	previewWindow.offsetY += dy;

	previewWindow.lastX = x - rect.left;
	previewWindow.lastY = y - rect.top;

	draw();
}

// Zoom
function zoom(e)
{
	const rect = canvas.getBoundingClientRect();

	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;
	const scaleFactor = e.deltaY <= 0 ? CONST_ZOOMFACTOR : 1 / CONST_ZOOMFACTOR;

	const worldX = (mouseX - previewWindow.offsetX) / previewWindow.scale;
	const worldY = (mouseY - previewWindow.offsetY) / previewWindow.scale;

	previewWindow.scale *= scaleFactor;

	previewWindow.offsetX = mouseX - worldX * previewWindow.scale;
	previewWindow.offsetY = mouseY - worldY * previewWindow.scale;

	draw();
}

// End
function end()
{
	previewWindow.isDragging = false;
	cropRect.dragging = false;
	canvas.classList.remove('grabbing');
}

// Mobile
function getTouchesDist(touch1, touch2)
{
	const dx = touch1.clientX - touch2.clientX;
	const dy = touch1.clientY - touch2.clientY;
	return Math.hypot(dx, dy);
}
function getTouchesX(touch1, touch2)
{
	return (touch1.clientX + touch2.clientX)/2
}
function getTouchesY(touch1, touch2)
{
	return (touch1.clientY + touch2.clientY)/2
}
function mobileStartZoom(touch1, touch2)
{
	cropRect.dragging = false;
	previewWindow.isDragging = false;
	previewWindow.isTouchZooming = true;
	previewWindow.lastTouchesDist = getTouchesDist(touch1, touch2);
}
function mobileZoom(touch1, touch2)
{
	const rect = canvas.getBoundingClientRect();

	const touchX = getTouchesX(touch1, touch2) - rect.left;
	const touchY = getTouchesY(touch1, touch2) - rect.top;
	const scaleFactor = getTouchesDist(touch1, touch2) - previewWindow.lastTouchesDist <= 0 ? 1 / CONST_MOBILEZOOMFACTOR : CONST_MOBILEZOOMFACTOR;

	const worldX = (touchX - previewWindow.offsetX) / previewWindow.scale;
	const worldY = (touchY - previewWindow.offsetY) / previewWindow.scale;

	previewWindow.scale *= scaleFactor;

	previewWindow.offsetX = touchX - worldX * previewWindow.scale;
	previewWindow.offsetY = touchY - worldY * previewWindow.scale;

	previewWindow.lastTouchesDist = getTouchesDist(touch1, touch2);

	draw();
}
function mobileEnd()
{
	previewWindow.isDragging = false;
	previewWindow.isTouchZooming = false;
}

// -------------------------------------------------------------

// --------------------------- UTILS ---------------------------

// --------------------------- PIXELS --------------------------

// fills in Alpha values into RGB
function clampedArrayRGBtoRGBA(rgb, w, h)
{
	var rgba = new Uint8ClampedArray(w * h * 4);
	for(let l = 0, X = 0; l < rgb.length; l += 3, X += 4)
	{
		rgba[X] = rgb[l];
		rgba[X + 1] = rgb[l + 1];
		rgba[X + 2] = rgb[l + 2];
		rgba[X + 3] = 255;
	}
	return rgba;
}

// returns RGBA (uint8 clamped array)
function clampedArrayRGBA(pix, w, h, c)
{
	if(c == 3)
	{
		return clampedArrayRGBtoRGBA(pix, w, h);
	}
	else if(c == 4)
	{
		return new Uint8ClampedArray(pix);
	}
}
// --------------------------- BYTES ---------------------------

// returns format enum based on magic bytes
function bytesToImageFormat(bytes)
{
	// png (.,p,n,g)
	if(bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47)
	{
        return 0;
    }
	// jpeg (.,.)
	else if(bytes[0] === 0xFF && bytes[1] === 0xD8)
	{
        return 1;
    }
	// webp (r,i,f,f w,e,b,p)
	else if(bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)
	{
        return 2;
    }
	// heic (guessing game)
	else if((bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70 &&
		bytes[8] === 0x68 && bytes[9] === 0x65 && bytes[10] === 0x69 && bytes[11] === 0x63) || (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70 &&
		bytes[20] === 0x68 && bytes[21] === 0x65 && bytes[22] === 0x69 && bytes[23] === 0x63))
	{
		return 3;
	}
	// unsupported
	else
	{
		return -1;
	}
}

// returns string format from enum
function formatEnumToString(int)
{
	if(int == 0) return "png";
	else if(int == 1) return "jpeg";
	else if(int == 2) return "webp";
	else if(int == 3) return "heic";
}

// returns enum from string format
function formatStringToEnum(string)
{
	if(string == "png") return 0;
	else if(string == "jpeg") return 1;
	else if(string == "webp") return 2;
	else if(string == "heic") return 3;
}
// -------------------------------------------------------------

// --------------------- EVENT LISTENERS -----------------------

// --------------------- CANVAS LISTENERS ----------------------

// --------------------- PC IMPLEMENTATION ---------------------

canvas.addEventListener('wheel', (e)=>
{
	e.preventDefault();
	zoom(e);
});
canvas.addEventListener('mousedown', (e)=>
{
	canvas.classList.add('grabbing');
	const rect = canvas.getBoundingClientRect();
	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;

	// Vertex grabbing
	const cropX = cropRect.x * previewWindow.scale + previewWindow.offsetX;
	const cropY = cropRect.y * previewWindow.scale + previewWindow.offsetY;
	const cropW = cropRect.w * previewWindow.scale;
	const cropH = cropRect.h * previewWindow.scale;
	if(isCropping == true &&
		mouseX >= cropX - previewWindow.scale - 10 &&
		mouseX <= cropX + previewWindow.scale + 10 &&
		mouseY >= cropY - previewWindow.scale - 10 &&
		mouseY <= cropY + previewWindow.scale + 10)
	{
		cropRect.lastX = (mouseX - previewWindow.offsetX) / previewWindow.scale;
		cropRect.lastY = (mouseY - previewWindow.offsetY) / previewWindow.scale;
		cropRect.offsetX = 0;
		cropRect.offsetY = 0;
		cropRect.vertex = 0;
		cropRect.dragging = true;
	}
	else if(isCropping == true &&
		mouseX >= cropX + cropW - previewWindow.scale - 10 &&
		mouseX <= cropX + cropW + previewWindow.scale + 10 &&
		mouseY >= cropY - previewWindow.scale - 10 &&
		mouseY <= cropY + previewWindow.scale + 10)
	{
		cropRect.lastX = (mouseX - previewWindow.offsetX) / previewWindow.scale;
		cropRect.lastY = (mouseY - previewWindow.offsetY) / previewWindow.scale;
		cropRect.offsetX = 0;
		cropRect.offsetY = 0;
		cropRect.vertex = 1;
		cropRect.dragging = true;
	}
	else if(isCropping == true &&
		mouseX >= cropX - previewWindow.scale - 10 &&
		mouseX <= cropX + previewWindow.scale + 10 &&
		mouseY >= cropY + cropH - previewWindow.scale - 10 &&
		mouseY <= cropY + cropH + previewWindow.scale + 10)
	{
		cropRect.lastX = (mouseX - previewWindow.offsetX) / previewWindow.scale;
		cropRect.lastY = (mouseY - previewWindow.offsetY) / previewWindow.scale;
		cropRect.offsetX = 0;
		cropRect.offsetY = 0;
		cropRect.vertex = 2;
		cropRect.dragging = true;
	}
	else if(isCropping == true &&
		mouseX >= cropX + cropW - previewWindow.scale - 10 &&
		mouseX <= cropX + cropW + previewWindow.scale + 10 &&
		mouseY >= cropY + cropH - previewWindow.scale - 10 &&
		mouseY <= cropY + cropH + previewWindow.scale + 10)
	{
		cropRect.lastX = (mouseX - previewWindow.offsetX) / previewWindow.scale;
		cropRect.lastY = (mouseY - previewWindow.offsetY) / previewWindow.scale;
		cropRect.offsetX = 0;
		cropRect.offsetY = 0;
		cropRect.vertex = 3;
		cropRect.dragging = true;
	}
	// Other grabbing (panning)
	else
	{
		press(e.clientX, e.clientY);
	}
});
canvas.addEventListener('mousemove', (e)=>
{
	e.preventDefault();
	const rect = canvas.getBoundingClientRect();
	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;

	// Vertex grabbing
	if(cropRect.dragging == true)
	{
		const newX = (mouseX - cropRect.offsetX - previewWindow.offsetX) / previewWindow.scale;
		const newY = (mouseY - cropRect.offsetY - previewWindow.offsetY) / previewWindow.scale;
		let dx = newX - cropRect.lastX;
		let dy = newY - cropRect.lastY;

		switch(cropRect.vertex)
		{
			case 0:
				cropRect.x += dx;
				cropRect.y += dy;
				cropRect.w -= dx;
				cropRect.h -= dy;
				break;
			case 1:
				cropRect.y += dy;
				cropRect.w += dx;
				cropRect.h -= dy;
				break;
			case 2:
				cropRect.x += dx;
				cropRect.w -= dx;
				cropRect.h += dy;
				break;
			case 3:
				cropRect.w += dx;
				cropRect.h += dy;
				break;
		}

		cropRect.lastX = newX;
		cropRect.lastY = newY;

		draw();
	}
	// Maybe other grabbing (panning)
	else
	{
		move(e.clientX, e.clientY);
	}
});
canvas.addEventListener('mouseup', ()=>
{
	end();
});
canvas.addEventListener('mouseleave', ()=>
{
	end();
});

// -------------------------------------------------------------

// --------------------- MOBILE IMPLEMENTATION -----------------

canvas.addEventListener('touchstart', function(e)
{
	e.preventDefault();
	if(e.touches.length == 1)
	{
		const rect = canvas.getBoundingClientRect();
		const touchX = e.touches[0].clientX - rect.left;
		const touchY = e.touches[0].clientY - rect.top;

		// Vertex grabbing
		const cropX = cropRect.x * previewWindow.scale + previewWindow.offsetX;
		const cropY = cropRect.y * previewWindow.scale + previewWindow.offsetY;
		const cropW = cropRect.w * previewWindow.scale;
		const cropH = cropRect.h * previewWindow.scale;
		if(isCropping == true &&
			touchX >= cropX - previewWindow.scale - 20 &&
			touchX <= cropX + previewWindow.scale + 20 &&
			touchY >= cropY - previewWindow.scale - 20 &&
			touchY <= cropY + previewWindow.scale + 20)
		{
			cropRect.lastX = (touchX - previewWindow.offsetX) / previewWindow.scale;
			cropRect.lastY = (touchY - previewWindow.offsetY) / previewWindow.scale;
			cropRect.offsetX = 0;
			cropRect.offsetY = 0;
			cropRect.vertex = 0;
			cropRect.dragging = true;
		}
		else if(isCropping == true &&
			touchX >= cropX + cropW - previewWindow.scale - 20 &&
			touchX <= cropX + cropW + previewWindow.scale + 20 &&
			touchY >= cropY - previewWindow.scale - 20 &&
			touchY <= cropY + previewWindow.scale + 20)
		{
			cropRect.lastX = (touchX - previewWindow.offsetX) / previewWindow.scale;
			cropRect.lastY = (touchY - previewWindow.offsetY) / previewWindow.scale;
			cropRect.offsetX = 0;
			cropRect.offsetY = 0;
			cropRect.vertex = 1;
			cropRect.dragging = true;
		}
		else if(isCropping == true &&
			touchX >= cropX - previewWindow.scale - 20 &&
			touchX <= cropX + previewWindow.scale + 20 &&
			touchY >= cropY + cropH - previewWindow.scale - 20 &&
			touchY <= cropY + cropH + previewWindow.scale + 20)
		{
			cropRect.lastX = (touchX - previewWindow.offsetX) / previewWindow.scale;
			cropRect.lastY = (touchY - previewWindow.offsetY) / previewWindow.scale;
			cropRect.offsetX = 0;
			cropRect.offsetY = 0;
			cropRect.vertex = 2;
			cropRect.dragging = true;
		}
		else if(isCropping == true &&
			touchX >= cropX + cropW - previewWindow.scale - 20 &&
			touchX <= cropX + cropW + previewWindow.scale + 20 &&
			touchY >= cropY + cropH - previewWindow.scale - 20 &&
			touchY <= cropY + cropH + previewWindow.scale + 20)
		{
			cropRect.lastX = (touchX - previewWindow.offsetX) / previewWindow.scale;
			cropRect.lastY = (touchY - previewWindow.offsetY) / previewWindow.scale;
			cropRect.offsetX = 0;
			cropRect.offsetY = 0;
			cropRect.vertex = 3;
			cropRect.dragging = true;
		}
		// Other grabbing (panning)
		else
		{
			press(e.touches[0].clientX, e.touches[0].clientY);
		}
	}
	else if(e.touches.length == 2)
	{
		mobileStartZoom(e.touches[0], e.touches[1]);
	}
}, {passive: false});
canvas.addEventListener('touchmove', function(e)
{
	e.preventDefault();
	if(e.touches.length == 1)
	{
		// Vertex grabbing
		if(cropRect.dragging == true)
		{
			const rect = canvas.getBoundingClientRect();
			const touchX = e.touches[0].clientX - rect.left;
			const touchY = e.touches[0].clientY - rect.top;
			const newX = (touchX - cropRect.offsetX - previewWindow.offsetX) / previewWindow.scale;
			const newY = (touchY - cropRect.offsetY - previewWindow.offsetY) / previewWindow.scale;
			let dx = newX - cropRect.lastX;
			let dy = newY - cropRect.lastY;
	
			switch(cropRect.vertex)
			{
				case 0:
					cropRect.x += dx;
					cropRect.y += dy;
					cropRect.w -= dx;
					cropRect.h -= dy;
					break;
				case 1:
					cropRect.y += dy;
					cropRect.w += dx;
					cropRect.h -= dy;
					break;
				case 2:
					cropRect.x += dx;
					cropRect.w -= dx;
					cropRect.h += dy;
					break;
				case 3:
					cropRect.w += dx;
					cropRect.h += dy;
					break;
			}
	
			cropRect.lastX = newX;
			cropRect.lastY = newY;
	
			draw();
		}
		// Maybe other grabbing (panning)
		else
		{
			move(e.touches[0].clientX, e.touches[0].clientY);
		}
	}
	else if(e.touches.length == 2)
	{
		mobileZoom(e.touches[0], e.touches[1]);
	}
}, {passive: false});
canvas.addEventListener('touchend', ()=>
{
	mobileEnd();
}, {passive: false});
canvas.addEventListener('touchcancel', ()=>
{
	mobileEnd();
}, {passive: false});

// -------------------------------------------------------------

// -------------------------------------------------------------

// --------------------- OTHER LISTENERS -----------------------

// View preview
_c_preview_view.addEventListener('click', function()
{
	preview_container.classList.toggle('hidden');
	main.classList.toggle('blurred');
	bottom_info.classList.toggle('blurred');
});

// Hide preview
_c_preview_hide.addEventListener('click', function()
{
	if(isCropping == true) return;
	preview_container.classList.toggle('hidden');
	main.classList.toggle('blurred');
	bottom_info.classList.toggle('blurred');
});

// Disable other functionality while cropping (why not)
function hideWhenCropping()
{
	_c_preview_hide.classList.toggle('notallowed');
	_c_preview_rotate.classList.toggle('notallowed');
	_c_preview_reset.classList.toggle('notallowed');
}

// Reset stuff
_c_preview_reset.addEventListener('click', function()
{
	if(isCropping == true) return;
	rotate = 0;
	resetCurrentCrop(decodedImage.width, decodedImage.height);
	// Redraw
	draw();
});

// Toggle cropping
_c_preview_crop.addEventListener('click', function()
{
	// Toggle
	isCropping = isCropping == true ? false : true;
	_c_preview_crop.classList.toggle('bg-gray');
	canvas.classList.toggle('crosshair');
	hideWhenCropping()
	// Redraw
	draw();
});

// Toggle cropping
_c_preview_rotate.addEventListener('click', function()
{
	if(isCropping == true) return;
	rotate = (rotate + 1) % 4;
	// Redraw
	draw();
});

// View config
_c_config_view.addEventListener('click', function()
{
	config_popup.classList.toggle('hidden');
	main.classList.toggle('blurred');
	bottom_info.classList.toggle('blurred');
});

// Hide config
_c_config_reset.addEventListener('click', function()
{
	resetConfig();
});

// Hide config
_c_config_hide.addEventListener('click', function()
{
	config_popup.classList.toggle('hidden');
	main.classList.toggle('blurred');
	bottom_info.classList.toggle('blurred');
	applyConfig();
});

// Config quality hook
config_quality.addEventListener("input", ()=>
{
	config_quality_visual.textContent = config_quality.value;
});

// Config width auto
config_width_auto.addEventListener("click", ()=>
{
	config_width.value = Math.floor(parseFloat(config_height.value) * decodedImage.ratio);
});

// Config height auto
config_height_auto.addEventListener("click", ()=>
{
	config_height.value = Math.floor(parseFloat(config_width.value) / decodedImage.ratio);
});

// -------------------------------------------------------------

// -------------------------------------------------------------

// -------------------------- LOGIC ----------------------------

// Input
_input.addEventListener('change', function(e)
{
	// Hide
	config_container.classList.add('hidden');

	// Reset
	resetConsole();
	resetPreviewWindow();
	rotate = 0;
	canvas.classList.remove('grabbing');

	// Get file
	const file = e.target.files[0];
	if(!file)
	{
		printConsole("Error: Received 0 files.\n");
		return;
	}

	// Store filename
	filename = file.name.replace(/\.(png|jpeg|jpg|webp|heic)$/i, '');

	// Read file
	const reader = new FileReader();
	reader.onload = function()
	{
		// Get bytes
		const arrayBuffer = reader.result;
		const charArray = new Uint8Array(arrayBuffer);

		// Prepare bytes
		const bytes = Module._malloc(charArray.length);
		Module.HEAPU8.set(charArray, bytes);

		// Input format
		input_format = bytesToImageFormat(charArray);
		const input_size = charArray.length;

		// Input callback initialize
		const input_pixels_ptr = Module._malloc(4);
		const input_width_ptr = Module._malloc(4);
		const input_height_ptr = Module._malloc(4);
		const input_channels_ptr = Module._malloc(4);

		// Call
		const decodeOK = Module._Decode(bytes, safeInt(input_size), safeInt(input_format), input_pixels_ptr, input_width_ptr, input_height_ptr, input_channels_ptr);

		// Check for success
		if(decodeOK == false)
		{
			printConsole("Decode successfully failed");
			const internal_malloc = Module.getValue(input_pixels_ptr, '*');
			Module._freeDecodeMalloc(internal_malloc, input_format);
			Module._free(input_pixels_ptr);
			Module._free(input_channels_ptr);
			Module._free(input_height_ptr);
			Module._free(input_width_ptr);
			Module._free(bytes);
			return;
		}

		// Input callback retrieve
		const input_pixels = Module.getValue(input_pixels_ptr, '*');
		const input_width = Module.getValue(input_width_ptr, 'i32');
		const input_height = Module.getValue(input_height_ptr, 'i32');
		const input_channels = Module.getValue(input_channels_ptr, 'i32');

		// Delete used pointers
		Module._free(input_pixels_ptr);
		Module._free(input_channels_ptr);
		Module._free(input_height_ptr);
		Module._free(input_width_ptr);
		Module._free(bytes);

		// Reset crop
		resetCurrentCrop(input_width, input_height)

		/*
			Decoding successful:
				input_pixels
				input_format
				input_width
				input_height
				input_channels
			--------------------
		*/

		// Initialize config
		config_format.value = input_format == 3 ? formatEnumToString(0) : formatEnumToString(input_format);
		config_quality.value = input_format == 0 ? 100 : 90;
		config_quality_visual.textContent = config_quality.value;
		config_width.value = input_width;
		config_height.value = input_height;
		conversionConfig.format = input_format == 3 ? 0 : input_format;
		conversionConfig.quality = input_format == 0 ? 100 : 90;
		conversionConfig.width = input_width;
		conversionConfig.height = input_height;

		// Copy decode output
		decodedImage.pixels = new Uint8Array(input_width * input_height * input_channels);
		decodedImage.pixels.set(Module.HEAPU8.subarray(input_pixels, input_pixels + input_width * input_height * input_channels));
		decodedImage.width = input_width;
		decodedImage.height = input_height;
		decodedImage.ratio = input_width / input_height;
		decodedImage.channels = input_channels;

		// Free the pixels
		Module._freeDecodeMalloc(input_pixels, input_format);

		// Make image
		const rgbaPixels = clampedArrayRGBA(decodedImage.pixels, input_width, input_height, input_channels);
		const imageData = new ImageData(rgbaPixels, input_width, input_height);

		// Set up canvas
		canvas.width = input_width >= 800 ? 800 : input_width;
		canvas.height = input_height >= 800 ? 800: input_height;
		vCanvas.width = input_width;
		vCanvas.height = input_height;
		vContext.putImageData(imageData, 0, 0);

		// Draw
		draw();

		// Enable configging
		config_container.classList.remove('hidden');
	};

	reader.readAsArrayBuffer(file);
});

// Convert
function ConvertCall()
{
	// Abort default input
	if(decodedImage.channels == 0) return;

	// Abort nonsense
	if(Math.round(cropRect.w) == 0 || Math.round(cropRect.h) == 0)
	{
		printConsole("Aborting cropping the entire image.\n");
		return;
	}

	// Input pixels
	const input_size = decodedImage.pixels.length;
	const input_pixels = Module._malloc(input_size);
	Module.HEAPU8.set(decodedImage.pixels, input_pixels);

	// Retrieval ptrs
	const output_bytes_ptr = Module._malloc(4);
	const output_size_ptr = Module._malloc(4);
	const output_width_ptr = Module._malloc(4);
	const output_height_ptr = Module._malloc(4);

	// Call
	const crop_x = Math.round(cropRect.x);
	const crop_y = Math.round(cropRect.y);
	const crop_w = Math.round(cropRect.w);
	const crop_h = Math.round(cropRect.h);
	encodeOK = Module._Encode(input_pixels, output_bytes_ptr, output_size_ptr, output_width_ptr, output_height_ptr, safeInt(decodedImage.width), safeInt(decodedImage.height), safeInt(decodedImage.channels), safeInt(conversionConfig.format), safeInt(conversionConfig.quality), safeInt(conversionConfig.width), safeInt(conversionConfig.height), safeInt(rotate), safeInt(crop_x), safeInt(crop_y), safeInt(crop_w), safeInt(crop_h));

	// Fail, not past encoding rn
	if(encodeOK == false)
	{
		printConsole("Encode successfully failed.\n");

		Module._free(input_pixels);
		Module._free(output_bytes_ptr);
		Module._free(output_size_ptr);
		Module._free(output_width_ptr);
		Module._free(output_height_ptr);

		return;
	}

	// Free input
	Module._free(input_pixels);

	// Retrieve blob info
	const output_bytes = Module.getValue(output_bytes_ptr, '*');
	const output_size = Module.getValue(output_size_ptr, 'i32');
	const output_width = Module.getValue(output_width_ptr, 'i32');
	const output_height = Module.getValue(output_height_ptr, 'i32');

	// Delete used pointers
	Module._free(output_bytes_ptr);
	Module._free(output_size_ptr);
	Module._free(output_width_ptr);
	Module._free(output_height_ptr);

	// Make blob downloadable
	if(output_size != 0 && output_size != NaN)
	{
		// Copy bytes
		const resultArray = new Uint8Array(Module.HEAPU8.slice(output_bytes, output_bytes + output_size));
		resultArray.set(Module.HEAPU8.subarray(output_bytes, output_bytes + output_size));

		// Make blob
		const blob = new Blob([resultArray], {type: "image/" + formatEnumToString(conversionConfig.format)});
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = filename + '-' + (output_width).toString() + 'x' + (output_height).toString() + '.' + formatEnumToString(conversionConfig.format);
		link.click();
	}

	// Free blob bytes
	Module._freeEncodeMalloc(output_bytes, conversionConfig.format);
}

// Call conversion
action_button.addEventListener('click', function()
{
	ConvertCall();
});

// -------------------------------------------------------------