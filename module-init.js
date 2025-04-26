// Output functions
function getLineCount(textarea)
{
    return textarea.value.split('\n').length;
}

function resizeOutput(textarea)
{
	textarea.style.height = "calc(1.2rem * " + getLineCount(textarea) + " + 60px)";
}

function clearOutput(textarea)
{
	textarea.value = "";
}

// Module init
const outputElement = document.getElementById('output');
clearOutput(outputElement)
var Module =
{
	print(...args)
	{
		if (outputElement)
		{
			var text = args.join(' ');
			outputElement.value += text + "\n";
			resizeOutput(outputElement);
		}
	},
}
