// Console
const _console = document.getElementById('console');

// Methods
function printConsole(text)
{
	_console.value += text;
	_console.scrollTop = _console.scrollHeight;
}
function resetConsole()
{
	_console.value = "";
}

// Module init
resetConsole();
var Module =
{
	print(...args)
	{
		if (_console)
		{
			var text = args.join(' ');
			_console.value += text + "\n";
		}
	},
}