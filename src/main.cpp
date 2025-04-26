#include <iostream>
#define STB_IMAGE_IMPLEMENTATION
#define STBI_NO_FAILURE_STRINGS
#define STBI_NO_STDIO
#include "../includes/stb_image.h"

enum imgformat
{
	png = 0, jpeg = 1, webp = 2, heic = 3
};

void freeInput(uint8_t* ptr, imgformat format)
{
	switch(format)
	{
		case png:
		case jpeg:
			stbi_image_free(ptr);
			break;
		case webp:
		case heic:
		default:
			break;
	}
}

int main(void)
{
	std::cout << "Hello" << std::endl;

	return 0;
}

extern "C"
{
	bool Decode(uint8_t* bytes, int size, imgformat format, uint8_t** decoded_pixel_ptr, int* decoded_width_ptr, int* decoded_height_ptr, int* decoded_channels_ptr)
	{
		uint8_t* pixels = nullptr;
		int width, height, channels;

		// Validate
		if(size == 0)
		{
			std::cout << "Input size is zero bytes" << std::endl;
			return false;
		}
		else if(format != png && format != jpeg)
		{
			std::cout << "Input format not supported" << std::endl;
			return false;
		}

		// Decode
		switch(format)
		{
			case png:
			case jpeg:
				pixels = stbi_load_from_memory(bytes, size, &width, &height, &channels, 0);
				break;
			case webp:
			case heic:
			default:
				break;
		}

		// Assert
		if(pixels == nullptr)
		{
			std::cout << "Input failed to decode" << std::endl;
			return false;
		}
		else if(channels != 3 && channels != 4)
		{
			std::cout << "Input channels not supported" << std::endl;
			freeInput(pixels, format);
			return false;
		}

		// Write
		*decoded_pixel_ptr = pixels;
		*decoded_width_ptr = width;
		*decoded_height_ptr = height;
		*decoded_channels_ptr = channels;

		// Log
		std::cout << "Width: " << width << std::endl;
		std::cout << "Height: " << height << std::endl;
		std::cout << "Channels: " << channels << std::endl;

		freeInput(pixels, format);
		return true;
	}
}