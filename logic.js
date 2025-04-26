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
	// heic (f,t,y,p h,e,i,c)
	else if(bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70 &&
		bytes[20] === 0x68 && bytes[21] === 0x65 && bytes[22] === 0x69 && bytes[23] === 0x63)
	{
		return 3;
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

		// Input callback retrieve
		if(decodeOK == true)
		{
			const input_pixels = Module.getValue(input_pixels_ptr, '*');
			const input_width = Module.getValue(input_width_ptr, 'i32');
			const input_height = Module.getValue(input_height_ptr, 'i32');
			const input_channels = Module.getValue(input_channels_ptr, 'i32');
		}

		// Delete pointers
		Module._free(input_pixels_ptr);
		Module._free(input_channels_ptr);
		Module._free(input_height_ptr);
		Module._free(input_width_ptr);
		Module._free(bytes);

		console.log(input_width);

		// Return if decode failed
		if(decodeOK == false)
		{
			console.log("ERROR: Decode failed");
			console.log(decodeOK);
			return;
		}

		/*
			Decoding successful:
				input_pixels
				input_format
				input_width
				input_height
				input_channels
		*/

		// Make image
		const imagePixels = new Uint8Array(Module.HEAPU8.buffer, input_pixels, input_width * input_height * input_channels);
		const imageData = new ImageData(new Uint8ClampedArray(imagePixels), input_width, input_height);

		// Put image into canvas
		const canvas_container = document.getElementById("canvas_container");
		const canvas = document.createElement('canvas');
		canvas.width = input_width;
		canvas.height = input_height;
		canvas.style.border = '1px solid white';
		const context = canvas.getContext('2d');
		context.putImageData(imageData, 0, 0)
		canvas_container.innerHTML = '';
		canvas_container.appendChild(canvas);
	};

	reader.readAsArrayBuffer(file);
});