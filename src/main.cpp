#include <iostream>
#define STB_IMAGE_IMPLEMENTATION
#define STBI_NO_FAILURE_STRINGS
#define STBI_NO_STDIO
#include "../includes/stb_image.h"

enum imgformat
{
	png = 0, jpeg = 1, webp = 2, heic = 3
};

int main(void)
{
	std::cout << "Hello" << std::endl;

	return 0;
}

extern "C"
{
	void Decode(uint8_t* bytes, int size, imgformat format, uint8_t** decoded_pixel_ptr, int* decoded_width_ptr, int* decoded_height_ptr, int* decoded_channels_ptr)
	{
		int width, height, channels;
		stbi_info_from_memory(bytes, size, &width, &height, &channels);

		*decoded_pixel_ptr = 0;
		*decoded_width_ptr = width;
		*decoded_height_ptr = height;
		*decoded_channels_ptr = channels;

		std::cout << "Width: " << width << std::endl;
		std::cout << "Height: " << height << std::endl;
		std::cout << "Channels: " << channels << std::endl;

		return;
	}
}