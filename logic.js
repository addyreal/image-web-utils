const config_container = document.getElementById('config_container');
const _c_image_view = document.getElementById('_c_image_view');
const canvas_container = document.getElementById('canvas_container');

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
	// heic (scannable AND ftyp)
	else if(bytes.length >= 48 && (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70))
	{
		// major heic
		if(bytes[8] === 0x68 && bytes[9] === 0x65 && bytes[10] === 0x69 && bytes[11] === 0x63)
		{
			return 3;
		}
		// major mif1
		else if(bytes[8] === 0x6D && bytes[9] === 0x69 && bytes[10] === 0x66 && bytes[11] === 0x31)
		{
			// minor heic, checking 8 of them
			for(let i = 16; i + 3 < bytes.length && i < 48; i += 4)
			{
				if(bytes[i] == 0x68 && bytes[i+1] == 0x65 && bytes[i+2] == 0x69 && bytes[i+3] == 0x63)
				{
					return 3;
				}
			}
		}
		// unsupported
		return -1;
	}
	// unsupported
	else
	{
		return -1;
	}
}

// Defines the output
var conversionConfig =
{
	format: 0,
	quality: 90,
	width: 250,
	height: 250,
}

document.getElementById('input_label').addEventListener('change', function(e)
{
	const file = e.target.files[0];
	if(!file)
	{
		return;
	}

	const reader = new FileReader();
	reader.onload = function()
	{
		// Read
		const arrayBuffer = reader.result;
		const charArray = new Uint8Array(arrayBuffer);

		// Input
		const bytes = Module._malloc(charArray.length);
		Module.HEAPU8.set(charArray, bytes);

		// Input format
		const input_format = bytesToImageFormat(charArray);
		const input_size = charArray.length;

		// Input callback initialize
		const input_pixels_ptr = Module._malloc(4);
		const input_width_ptr = Module._malloc(4);
		const input_height_ptr = Module._malloc(4);
		const input_channels_ptr = Module._malloc(4);

		// Call
		clearOutput(outputElement);
		const decodeOK = Module._Decode(bytes, input_size, input_format, input_pixels_ptr, input_width_ptr, input_height_ptr, input_channels_ptr);
		resizeOutput(outputElement);

		// Check for success
		if(decodeOK == false)
		{
			console.log("ERROR: Decode failed");
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

		// Delete pointers
		Module._free(input_pixels_ptr);
		Module._free(input_channels_ptr);
		Module._free(input_height_ptr);
		Module._free(input_width_ptr);
		Module._free(bytes);

		/*
			Decoding successful:
				input_pixels
				input_format
				input_width
				input_height
				input_channels
			--------------------
		*/

		// Enable configging
		config_container.classList.remove('hidden');

		// Make image
		const imagePixels = new Uint8Array(Module.HEAPU8.buffer, input_pixels, input_width * input_height * input_channels);
		const rgbaPixels = clampedArrayRGBA(imagePixels, input_width, input_height, input_channels);
		const imageData = new ImageData(rgbaPixels, input_width, input_height);

		// Make main canvas
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');
		canvas.width = input_width >= 600 ? 600 : input_width;
		canvas.height = input_height >= 600 ? 600: input_height;
		context.imageSmoothingEnabled = false;
		canvas_container.innerHTML = '';
		canvas_container.appendChild(canvas);

		// Make virtual canvas
		const vCanvas = document.createElement('canvas');
		const vContext = vCanvas.getContext('2d');
		vCanvas.width = input_width;
		vCanvas.height = input_height;
		vContext.imageSmoothingEnabled = false;
		vContext.putImageData(imageData, 0, 0);

		// Pan and zoom
		let scale = 1;
		let offsetX = 0;
		let offsetY = 0;
		let lastX = 0;
		let lastY = 0;
		let isDragging = false;
		let isTouchZooming = false;
		canvas.classList.remove('grabbing');
			// Render
		function draw()
		{
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, canvas.width, canvas.height);
			context.imageSmoothingEnabled = false;
			context.setTransform(scale, 0, 0, scale, offsetX, offsetY);
			context.drawImage(vCanvas, 0, 0);
		}
			// Zoom gesture
		function zoom(e)
		{
			const rect = canvas.getBoundingClientRect();
		
			const zoomFactor = 1.1;
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;
			const scaleFactor = e.deltaY <= 0 ? zoomFactor : 1 / zoomFactor;
		
			const worldX = (mouseX - offsetX) / scale;
			const worldY = (mouseY - offsetY) / scale;
		
			scale *= scaleFactor;
		
			offsetX = mouseX - worldX * scale;
			offsetY = mouseY - worldY * scale;
		
			draw();
		}
			// Press
		function press(x, y)
		{
			const rect = canvas.getBoundingClientRect();
			isDragging = true;
			isTouchZooming = false;
			canvas.classList.add('grabbing');
			lastX = x - rect.left;
			lastY = y - rect.top;
		}
			// Move
		function move(x, y)
		{
			if(!isDragging || isTouchZooming) return;
			const rect = canvas.getBoundingClientRect();

			const dx = x - rect.left - lastX;
			const dy = y - rect.top - lastY;

			offsetX += dx;
			offsetY += dy;

			lastX = x - rect.left;
			lastY = y - rect.top;

			draw();
		}
			// End
		function end()
		{
			isDragging = false
			canvas.classList.remove('grabbing');
		}
		// PC implementation
		canvas.addEventListener('wheel', (e)=>{e.preventDefault();zoom(e)});
		canvas.addEventListener('mousedown', (e)=>{press(e.clientX, e.clientY)});
		canvas.addEventListener('mousemove', (e)=>{e.preventDefault();move(e.clientX, e.clientY)});
		canvas.addEventListener('mouseup', ()=>{end()});
		canvas.addEventListener('mouseleave', ()=>{end()});
		// Mobile implementation
		let lastTouchesDist = 0;
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
			isDragging = false;
			isTouchZooming = true;
			lastTouchesDist = getTouchesDist(touch1, touch2);
		}
		function mobileZoom(touch1, touch2)
		{
			const rect = canvas.getBoundingClientRect();
		
			const zoomFactor = 1.05;
			const touchX = getTouchesX(touch1, touch2) - rect.left;
			const touchY = getTouchesY(touch1, touch2) - rect.top;
			const scaleFactor = getTouchesDist(touch1, touch2) - lastTouchesDist <= 0 ? 1 / zoomFactor : zoomFactor;
		
			const worldX = (touchX - offsetX) / scale;
			const worldY = (touchY - offsetY) / scale;
		
			scale *= scaleFactor;
		
			offsetX = touchX - worldX * scale;
			offsetY = touchY - worldY * scale;

			lastTouchesDist = getTouchesDist(touch1, touch2);
		
			draw();
		}
		function mobileEnd()
		{
			isDragging = false;
			isTouchZooming = false;
		}
		canvas.addEventListener('touchstart', function(e)
		{
			e.preventDefault();
			if(e.touches.length == 1)
			{
				press(e.touches[0].clientX, e.touches[0].clientY);
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
				move(e.touches[0].clientX, e.touches[0].clientY);
			}
			else if(e.touches.length == 2)
			{
				mobileZoom(e.touches[0], e.touches[1]);
			}
		}, {passive: false});
		canvas.addEventListener('touchend', ()=>{mobileEnd()}, {passive: false});
		canvas.addEventListener('touchcancel', ()=>{mobileEnd()}, {passive: false});

		draw();
	};

	reader.readAsArrayBuffer(file);
});

_c_image_view.addEventListener('click', function()
{
	canvas_container.classList.toggle('hidden');
	_c_image_view.innerHTML = _c_image_view.innerHTML == "View" ? "Hide" : "View";
});