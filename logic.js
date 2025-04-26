document.getElementById('input-label').addEventListener('change', function(e)
{
	const file = e.target.files[0];
	if (!file) return;

	const reader = new FileReader();
	reader.onload = function()
	{
		// Load bytes into ptr
		const arrayBuffer = reader.result;
		const byteArray = new Uint8Array(arrayBuffer);
		const ptr = Module._malloc(byteArray.length);
		Module.HEAPU8.set(byteArray, ptr);

		// Call WASM
		clearOutput(outputElement);
		Module._image_info(ptr, byteArray.length);
		resizeOutput(outputElement);

		Module._free(ptr);
	};

	reader.readAsArrayBuffer(file);
});