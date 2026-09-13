import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config();

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'your_cloud_name',
    api_key: process.env.CLOUDINARY_API_KEY || 'your_api_key',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'your_api_secret'
});

class CloudinaryService {
    /**
     * Upload image from URL to Cloudinary
     * @param {string} imageUrl - URL of the image to upload
     * @param {string} folder - Cloudinary folder (default: 'inspoai/history')
     * @returns {Promise<string>} - Cloudinary URL
     */
    static async uploadFromUrl(imageUrl, folder = 'inspoai/history') {
        try {
            const result = await cloudinary.uploader.upload(imageUrl, {
                folder: folder,
                resource_type: 'image',
                transformation: [
                    { width: 800, height: 600, crop: 'limit' }, // Limit size
                    { quality: 'auto:good' }, // Auto quality
                    { fetch_format: 'auto' } // Auto format (WebP if supported)
                ]
            });

            return result.secure_url;
        } catch (error) {
            console.error('Cloudinary upload error:', error);
            // Fallback to original URL if upload fails
            return imageUrl;
        }
    }

    /**
     * Upload base64 image to Cloudinary
     * @param {string} base64Image - Base64 encoded image
     * @param {string} folder - Cloudinary folder
     * @returns {Promise<string>} - Cloudinary URL
     */
    static async uploadBase64(base64Image, folder = 'inspoai/history') {
        try {
            const result = await cloudinary.uploader.upload(base64Image, {
                folder: folder,
                resource_type: 'image',
                transformation: [
                    { width: 800, height: 600, crop: 'limit' },
                    { quality: 'auto:good' },
                    { fetch_format: 'auto' }
                ]
            });

            return result.secure_url;
        } catch (error) {
            console.error('Cloudinary base64 upload error:', error);
            throw error;
        }
    }

    /**
     * Delete image from Cloudinary
     * @param {string} publicId - Cloudinary public ID
     */
    static async deleteImage(publicId) {
        try {
            await cloudinary.uploader.destroy(publicId);
        } catch (error) {
            console.error('Cloudinary delete error:', error);
        }
    }

    /**
     * Extract public ID from Cloudinary URL
     * @param {string} url - Cloudinary URL
     * @returns {string|null} - Public ID or null
     */
    static extractPublicId(url) {
        try {
            const match = url.match(/\/v\d+\/(.+)\.\w+$/);
            return match ? match[1] : null;
        } catch (error) {
            return null;
        }
    }
}

export default CloudinaryService;
