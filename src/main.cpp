#include <iostream>
#include <cstring>
#define STB_IMAGE_IMPLEMENTATION
#define STB_IMAGE_RESIZE_IMPLEMENTATION
#define STB_IMAGE_WRITE_IMPLEMENTATION
#define STBI_NO_FAILURE_STRINGS
#define STBI_ONLY_JPEG
#define STBI_ONLY_PNG
#define STBI_NO_STDIO
#define STBI_WRITE_NO_STDIO
#include "../includes/stb_image.h"
#include "../includes/stb_image_resize2.h"
#include "../includes/stb_image_write.h"
#include "../includes/webp_types.h"
#include "../includes/webp_decode.h"
#include "../includes/webp_encode.h"
#include "../includes/heif.h"

enum imgformat
{
	png = 0, jpeg = 1, webp = 2, heic = 3
};

const char* ftos(imgformat f)
{
	switch(f)
	{
		case png:
			return "PNG";
			break;
		case jpeg:
			return "JPEG";
			break;
		case webp:
			return "WebP";
			break;
		case heic:
			return "HEIC";
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

uint8_t* heic_load_from_memory(uint8_t* bytes, int size, int* width_ptr, int* height_ptr, int* channels_ptr)
{
	heif_context* context = heif_context_alloc();
	heif_error err = heif_context_read_from_memory(context, bytes, size, nullptr);
	if(err.code != heif_error_Ok)
	{
		std::cout << "HEIC: Failed to read HEIC from memory" << std::endl;
		heif_context_free(context);
		return nullptr;
	}

	heif_image_handle* handle = nullptr;
	err = heif_context_get_primary_image_handle(context, &handle);
	if(err.code != heif_error_Ok)
	{
		std::cout << "HEIC: Failed to get image handle" << std::endl;
		heif_image_handle_release(handle);
		heif_context_free(context);
		return nullptr;
	}

	heif_image* img = nullptr;
	switch(heif_image_handle_has_alpha_channel(handle))
	{
		case true:
			err = heif_decode_image(handle, &img, heif_colorspace_RGB, heif_chroma_interleaved_RGBA, nullptr);
			break;
		case false:
			err = heif_decode_image(handle, &img, heif_colorspace_RGB, heif_chroma_interleaved_RGB, nullptr);
			break;
	}
	if(err.code != heif_error_Ok)
	{
		std::cout << "HEIC: Failed to decode image" << std::endl;
		heif_image_release(img);
		heif_image_handle_release(handle);
		heif_context_free(context);
		return nullptr;
	}

	int width, height, channels;
	enum heif_colorspace cs = heif_image_get_colorspace(img);
	switch(cs)
	{
		case heif_colorspace_RGB:
			width = heif_image_get_width(img, heif_channel_interleaved);
			height = heif_image_get_height(img, heif_channel_interleaved);
			break;
		case heif_colorspace_YCbCr:
			std::cout << "HEIC: libheif forced YCbCr colorspace, aborting" << std::endl;
			heif_image_release(img);
			heif_image_handle_release(handle);
			heif_context_free(context);
			return nullptr;
			break;
		default:
			std::cout << "HEIC: libheif forced an awkward colorspace, aborting" << std::endl;
			heif_image_release(img);
			heif_image_handle_release(handle);
			heif_context_free(context);
			return nullptr;
			break;
	}
	
	channels = heif_image_handle_has_alpha_channel(handle) ? 4 : 3;
	*width_ptr = width;
	*height_ptr = height;
	*channels_ptr = channels;

	int stride;
	const uint8_t* rgba = heif_image_get_plane_readonly(img, heif_channel_interleaved, &stride);

	uint8_t* out_rgba = new uint8_t[width * height * channels];
	for(int y = 0; y < height; ++y)
	{
		std::memcpy(
			out_rgba + y * width * channels,
			rgba + y * stride,
			width * channels
		);
	}

	heif_image_release(img);
	heif_image_handle_release(handle);
	heif_context_free(context);

	return out_rgba;
}

struct JPEG_buffer {
    uint8_t* data;
    size_t size;
};

void jpeg_write_callback(void* context, void* data, int size)
{
    JPEG_buffer* buffer = (JPEG_buffer*)context;
    buffer->data = (unsigned char*)realloc(buffer->data, buffer->size + size);
    memcpy(buffer->data + buffer->size, data, size);
    buffer->size += size;
}

uint8_t* write_jpeg_to_memory(unsigned char* pixels, int w, int h, int channels, int quality, int* out_size) {
    JPEG_buffer buffer = { NULL, 0 };
    stbi_write_jpg_to_func(jpeg_write_callback, &buffer, w, h, channels, pixels, quality);
    *out_size = buffer.size;
    return buffer.data; // free when done
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
			delete ptr;
			break;
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

		if(format == heic)
		{
			std::cout << "Received HEIC, HEIC (support) sucks, program may randomly abort" << std::endl;
		}

		// Validate
		if(size == 0)
		{
			std::cout << "Input size is zero bytes" << std::endl;
			return false;
		}
		else if(format != png && format != jpeg && format != webp && format != heic)
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
				pixels = heic_load_from_memory(bytes, size, &width, &height, &channels);
				break;
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
		std::cout << "Format:   " << ftos(format) << std::endl;
		std::cout << "Width:    " << width << std::endl;
		std::cout << "Height:   " << height << std::endl;
		std::cout << "Channels: " << channels << std::endl;
		std::cout << "Size:     " << size << std::endl;

		freeInput(pixels, format);
		return true;
	}
}

extern "C"
{
	bool Encode(uint8_t* pixels, uint8_t** blob_ptr, int* blob_size, int i_width, int i_height, int i_channels, imgformat t_format, int t_quality, int t_width, int t_height)
	{
		unsigned char* resized_pixels = (unsigned char*)malloc(t_width * t_height * i_channels);
		if(stbir_resize_uint8_srgb((unsigned char*)pixels, i_width, i_height, 0, resized_pixels, t_width, t_height, 0, (stbir_pixel_layout)i_channels) == 0)
		{
			std::cout << "Image failed to resize" << std::endl;
			free(resized_pixels);
			return false;
		}
		
		switch(t_format)
		{
			case png:
				*blob_ptr =  stbi_write_png_to_mem(resized_pixels, t_width * i_channels, t_width, t_height, i_channels, blob_size);
				break;
			case jpeg:
				*blob_ptr =  write_jpeg_to_memory(resized_pixels, t_width, t_height, i_channels, t_quality, blob_size);
				break;
			case webp:
				switch(i_channels)
				{
					case 3:
						*blob_size =  WebPEncodeRGB(resized_pixels, t_width, t_height, t_width * i_channels, t_quality, blob_ptr);
						break;
					case 4:
						*blob_size =  WebPEncodeRGBA(resized_pixels, t_width, t_height, t_width * i_channels, t_quality, blob_ptr);
						break;
					default:
						free(resized_pixels);
						return true;
						break;
				}
			case heic:
				free(resized_pixels);
				return true;
				break;
			default:
				free(resized_pixels);
				return true;
				break;
		}

		//free(*blob_ptr)
		//WebPFree(*blob_ptr);
		free(resized_pixels);
		return true;
	}
}