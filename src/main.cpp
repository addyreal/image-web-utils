#include <iostream>
#define STB_IMAGE_IMPLEMENTATION
#define STBI_NO_FAILURE_STRINGS
#define STBI_NO_STDIO
#include "../includes/stb_image.h"

int main(void)
{
	std::cout << "Hello" << std::endl;

	return 0;
}

extern "C"
{
	void image_info(uint8_t* byte_array, int bytes)
	{
		int width, height, channels;
		stbi_info_from_memory(byte_array, bytes, &width, &height, &channels);

		std::cout << "Width: " << width << std::endl;
		std::cout << "Height: " << height << std::endl;
		std::cout << "Channels: " << channels << std::endl;

		return;
	}
}