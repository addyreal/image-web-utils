const main = document.getElementById('main');
const preview_container = document.getElementById('preview_container');
const _c_image_view = document.getElementById('_c_image_view');
const _c_image_hide = document.getElementById('_c_image_hide');
const config_popup = document.getElementById('config_popup');
const _c_config_view = document.getElementById('_c_config_view');
const _c_config_hide = document.getElementById('_c_config_hide');
const _c_convert_encode = document.getElementById('_c_convert_encode');
const config_container = document.getElementById('config_container');
const canvas_container = document.getElementById('canvas_container');
const config_format = document.getElementById('config_format');
const config_quality = document.getElementById('config_quality');
const config_quality_visual = document.getElementById('config_quality_visual');
const config_width = document.getElementById('config_width');
const config_height = document.getElementById('config_height');

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
	// heic
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

function formatEnumToString(int)
{
	if(int == 0)
	{
		return "png";
	}
	else if(int == 1)
	{
		return "jpeg";
	}
	else if(int == 2)
	{
		return "webp";
	}
	else if(int == 3)
	{
		return "heic";
	}
}

function formatStringToEnum(string)
{
	if(string == "png")
	{
		return 0;
	}
	else if(string == "jpeg")
	{
		return 1;
	}
	else if(string == "webp")
	{
		return 2;
	}
	else if(string == "heic")
	{
		return 3;
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

var TEMPSHITFIX = 
{
	pixels: 0,
	width: 0,
	height: 0,
	channels: 0,
}

function applyConfig()
{
	conversionConfig.format = formatStringToEnum(config_format.value);
	conversionConfig.quality = parseInt(config_quality.value, 10);
	conversionConfig.width = parseInt(config_width.value, 10);
	conversionConfig.height = parseInt(config_height.value, 10);
	// delete blob or something
}

document.getElementById('input_label').addEventListener('change', function(e)
{
	const file = e.target.files[0];
	if (!file) return;

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
			outputElement.value += "Decode successfully failed";
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

		// Initialize config
		config_format.value = formatEnumToString(input_format);
		config_quality.value = input_format == 0 ? 100 : 90;
		config_quality_visual.textContent = config_quality.value;
		config_width.value = input_width;
		config_height.value = input_height;
		conversionConfig.format = input_format;
		conversionConfig.quality = input_format == 0 ? 100 : 90;
		conversionConfig.width = input_width;
		conversionConfig.height = input_height;

		// initialize shit fix
		TEMPSHITFIX.pixels = input_pixels;
		TEMPSHITFIX.width = input_width;
		TEMPSHITFIX.height = input_height;
		TEMPSHITFIX.channels = input_channels;

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
	preview_container.classList.toggle('hidden');
	main.classList.toggle('blurred');
});

_c_image_hide.addEventListener('click', function()
{
	preview_container.classList.toggle('hidden');
	main.classList.toggle('blurred');
});

_c_config_view.addEventListener('click', function()
{
	config_popup.classList.toggle('hidden');
	main.classList.toggle('blurred');
});

_c_config_hide.addEventListener('click', function()
{
	config_popup.classList.toggle('hidden');
	main.classList.toggle('blurred');
	applyConfig();
});

config_quality.addEventListener("input", ()=>{config_quality_visual.textContent = config_quality.value;});



function ConvertCall(config, shit)
{
	if(shit.channels == 0) return;

	const output_bytes_ptr = Module._malloc(4);
	const output_size_ptr = Module._malloc(4);

	encodeOK = Module._Encode(shit.pixels, output_bytes_ptr, output_size_ptr, shit.width, shit.height, shit.channels, config.format, config.quality, config.width, config.height)

	if(encodeOK == false)
	{
		outputElement.value += "Encode successfully failed";

		Module._free(output_bytes_ptr);
		Module._free(output_size_ptr);

		return;
	}

	output_bytes = Module.getValue(output_bytes_ptr, '*');
	output_size = Module.getValue(output_size_ptr, 'i32');

	if(output_size != 0 && output_size != NaN)
	{
		const resultArray = new Uint8Array(Module.HEAPU8.buffer, output_bytes, output_size);

		// Prepare download
		//const download_div = document.getElementById('output_image');
		//download_div.innerHTML = '';

		// Make blob
		const blob = new Blob([resultArray], { type: "image/" + config.format});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
			a.href = url;
			a.download = 'converted_image.' + config.format;
			a.click();
			//a.textContent = 'Download result';
			//download_div.appendChild(a);
	}

	switch(config.format)
	{
		case 0:
			Module._free(output_bytes);
			break;
		case 1:
			Module.free(output_bytes);
			break;
		case 2:
			Module.WebPFree(output_bytes);
			break;
		case 3:
			break;
	}

	Module._free(output_bytes_ptr);
	Module._free(output_size_ptr);
}



_c_convert_encode.addEventListener('click', function()
{
	ConvertCall(conversionConfig, TEMPSHITFIX);
});