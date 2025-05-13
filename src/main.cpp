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
    buffer->data = (uint8_t*)realloc(buffer->data, buffer->size + size);
    memcpy(buffer->data + buffer->size, data, size);
    buffer->size += size;
}

uint8_t* write_jpeg_to_memory(uint8_t* pixels, int w, int h, int channels, int quality, int* out_size) {
    JPEG_buffer buffer = { nullptr, 0 };
    stbi_write_jpg_to_func(jpeg_write_callback, &buffer, w, h, channels, pixels, quality);
    *out_size = buffer.size;
    return buffer.data;
}

extern "C"
{
	// Frees Decode's malloc
	void freeDecodeMalloc(uint8_t* ptr, imgformat format)
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
				delete[] ptr;
				break;
			default:
				break;
		}
	}
}

int main(void)
{
	std::cout << "Waiting for an image" << std::endl;

	return 0;
}

extern "C"
{
	// writes into decoded_pixels_ptr, decoded_width_ptr, decoded_height_ptr, decoded_channels_ptr
	// allocates "pixels", writes it into decoded_pixels_ptr
	bool Decode(uint8_t* bytes, int size, imgformat format, uint8_t** decoded_pixels_ptr, int* decoded_width_ptr, int* decoded_height_ptr, int* decoded_channels_ptr)
	{
		// Initialize
		uint8_t* pixels = nullptr;
		int width, height, channels;

		// Log
		if(format == heic)
		{
			std::cout << "Received HEIC, program might randomly abort" << std::endl;
		}

		// Validate
		if(bytes == nullptr)
		{
			return false;
		}
		if(decoded_pixels_ptr == nullptr || decoded_width_ptr == nullptr || decoded_height_ptr == nullptr || decoded_channels_ptr == nullptr)
		{
			return false;
		}
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
				switch(channels)
				{
					case 3:
						pixels = WebPDecodeRGB(bytes, size, &width, &height);
						break;
					case 4:
						pixels = WebPDecodeRGBA(bytes, size, &width, &height);
						break;
					default:
						std::cout << "Input channels not supported" << std::endl;
						return false;
						break;
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
			freeDecodeMalloc(pixels, format);
			return false;
		}

		// Write result
		*decoded_pixels_ptr = pixels;
		*decoded_width_ptr = width;
		*decoded_height_ptr = height;
		*decoded_channels_ptr = channels;

		// Log
		std::cout << "Format:   " << ftos(format) << std::endl;
		std::cout << "Width:    " << width << std::endl;
		std::cout << "Height:   " << height << std::endl;
		std::cout << "Channels: " << channels << std::endl;
		std::cout << "Size:     " << size << std::endl;

		return true;
	}
}

extern "C"
{
	// Frees Encode's malloc
	void freeEncodeMalloc(uint8_t* ptr, imgformat format)
	{
		switch(format)
		{
			case png:
				free(ptr);
				break;
			case jpeg:
				free(ptr);
				break;
			case webp:
				WebPFree(ptr);
				break;
			case heic:
				break;
			default:
				break;
		}
	}
}

uint8_t* crop(const uint8_t* i_pixels, int i_width, int i_height, int i_channels, int x, int y, int w, int h)
{
	uint8_t* t_pixels = new uint8_t[w * h * i_channels];

	for(int row = 0; row < h; row++)
	{
		const uint8_t* i_row = i_pixels + ((y + row) * i_width + x) * i_channels;
		uint8_t* t_row = t_pixels + (row * w) * i_channels;

		std::memcpy(t_row, i_row, w * i_channels);
	}

	return t_pixels;
}

extern "C"
{
	// writes into blob_ptr, blob_size
	// allocates resized_pixels, gets copied
	bool Encode(uint8_t* pixels, uint8_t** blob_ptr, int* blob_size, int* width_ptr, int* height_ptr, int i_width, int i_height, int i_channels, imgformat t_format, int t_quality, int t_width, int t_height, int t_rotation, int crop_x, int crop_y, int crop_w, int crop_h)
	{
		// Validate
		if(pixels == nullptr)
		{
			return false;
		}
		if(blob_ptr == nullptr || blob_size == nullptr)
		{
			return false;
		}
		if(t_format != png && t_format != jpeg && t_format != webp && t_format != heic)
		{
			return false;
		}
		if(t_quality <= 0 || t_quality > 100)
		{
			return false;
		}
		if(t_width > i_width || t_width <= 0 || t_height > i_height || t_height <= 0)
		{
			return false;
		}

		// Resize
		uint8_t* resized_pixels = (uint8_t*)malloc(t_width * t_height * i_channels);
		if(stbir_resize_uint8_srgb(pixels, i_width, i_height, 0, resized_pixels, t_width, t_height, 0, (stbir_pixel_layout)i_channels) == 0)
		{
			std::cout << "Image failed to resize" << std::endl;
			free(resized_pixels);
			return false;
		}
		std::cout << "Done: Resized image..." << std::endl;

		// Width, height
		int width = t_width;
		int height = t_height;

		// Crop validation
		bool should_crop = false;
		int t_crop_x = crop_x;
		int t_crop_y = crop_y;
		int t_crop_w = crop_w;
		int t_crop_h = crop_h;
		if(crop_x < 0)
		{
			t_crop_x = 0;
		}
		if(crop_y < 0)
		{
			t_crop_y = 0;
		}
		if(t_crop_x + crop_w > i_width)
		{
			t_crop_w = i_width - t_crop_x;
		}
		if(t_crop_y + crop_h > i_height)
		{
			t_crop_h = i_height - t_crop_y;
		}
		if(t_crop_w != i_width && t_crop_h != i_height)
		{
			should_crop = true;
		}

		// Crop
		uint8_t* cropped_pixels = resized_pixels;
		if(should_crop == true)
		{
			const float scaleX = (float)t_width / i_width;
			const float scaleY = (float)t_height / i_height;
			t_crop_x = (int)(scaleX * t_crop_x);
			t_crop_y = (int)(scaleY * t_crop_y);
			t_crop_w = (int)(scaleX * t_crop_w);
			t_crop_h = (int)(scaleY * t_crop_h);
			if(t_crop_w == 0 || t_crop_h == 0)
			{
				std::cout << "Error: Crop after resize corresponds to zero pixels." << std::endl;
				free(resized_pixels);
				return false;
			}
			cropped_pixels = crop(resized_pixels, width, height, i_channels, t_crop_x, t_crop_y, t_crop_w, t_crop_h);
			std::cout << "Done: Cropped image..." << std::endl;
			width = t_crop_w;
			height = t_crop_h;
		}

		// Write actual new dimensions
		*width_ptr = width;
		*height_ptr = height;

		// Delete croppedpixels
		// Free resizedpixels

		// Rotate
		if(t_rotation != 0)
		{
			std::cout << "cba rotating" << std::endl;
		}
		
		// Write blob
		switch(t_format)
		{
			case png:
				if(t_quality != 100)
				{
					std::cout << "PNG conversion is lossless, config quality ignored" << std::endl;
				}
				*blob_ptr =  stbi_write_png_to_mem(cropped_pixels, width * i_channels, width, height, i_channels, blob_size);
				break;
			case jpeg:
				if(i_channels == 4)
				{
					std::cout << "JPEG doesn't support transparency, alpha channel ignored" << std::endl;
				}
				*blob_ptr =  write_jpeg_to_memory(cropped_pixels, width, height, i_channels, t_quality, blob_size);
				break;
			case webp:
				switch(i_channels)
				{
					case 3:
						*blob_size =  WebPEncodeRGB(cropped_pixels, width, height, width * i_channels, t_quality, blob_ptr);
						break;
					case 4:
						*blob_size =  WebPEncodeRGBA(cropped_pixels, width, height, width * i_channels, t_quality, blob_ptr);
						break;
				}
				break;
			case heic:
				std::cout << "Encoding to heic not supported" << std::endl;
				if(should_crop) delete cropped_pixels;
				free(resized_pixels);
				return false;
				break;
		}

		// Done
		std::cout << "Info: Prompting download..." << std::endl;

		// Free resize and return
		if(should_crop) delete cropped_pixels;
		free(resized_pixels);
		return true;
	}
}