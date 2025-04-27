#include <iostream>
#define STB_IMAGE_IMPLEMENTATION
#define STBI_NO_FAILURE_STRINGS
#define STBI_NO_STDIO
#include "../includes/stb_image.h"
#include "../includes/webp_types.h"
#include "../includes/webp_decode.h"
#include "../includes/webp_encode.h"

enum imgformat
{
	png = 0, jpeg = 1, webp = 2, heic = 3
};

const char* ftos(imgformat f)
{
	switch(f)
	{
		case png:
			return "png";
			break;
		case jpeg:
			return "jpeg";
			break;
		case webp:
			return "webp";
			break;
		case heic:
			return "heic";
			break;
	}
}

int get_webp_num_channels(const uint8_t* data, int data_size)
{
	WebPBitstreamFeatures features;
	if(WebPGetFeatures(data, data_size, &features) != VP8_STATUS_OK)
	{
		return -1;
	}
	return features.has_alpha ? 4 : 3;
}

void freeInput(uint8_t* ptr, imgformat format)
{
	switch(format)
	{
		case png:
		case jpeg:
			stbi_image_free(ptr);
			break;
		case webp:
			WebPFree(ptr);
			break;
		case heic:
		default:
			break;
	}
}

int main(void)
{
	std::cout << "Waiting for an image" << std::endl;

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
		else if(format != png && format != jpeg && format != webp)
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
				channels = get_webp_num_channels(bytes, size);
				if(channels == 3)
				{
					pixels = WebPDecodeRGB(bytes, size, &width, &height);

				}
				else if(channels == 4)
				{
					pixels = WebPDecodeRGBA(bytes, size, &width, &height);
				}
				break;
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
		std::cout << "Format: " << ftos(format) << std::endl;
		std::cout << "Width: " << width << std::endl;
		std::cout << "Height: " << height << std::endl;
		std::cout << "Channels: " << channels << std::endl;
		std::cout << "Size(B): " << size << std::endl;

		freeInput(pixels, format);
		return true;
	}
}