/**
 * ImageKit Service
 * Handles image uploads to ImageKit CDN
 */
const ImageKit = require("imagekit");
const config = require("../config");

// Initialize ImageKit
let imagekit = null;

const getImageKit = () => {
  if (!imagekit) {
    imagekit = new ImageKit({
      publicKey: config.imagekit.publicKey,
      privateKey: config.imagekit.privateKey,
      urlEndpoint: config.imagekit.urlEndpoint,
    });
  }
  return imagekit;
};

/**
 * Upload image to ImageKit
 * @param {Buffer|String} file - File buffer or base64 string
 * @param {String} fileName - Name for the file
 * @param {String} folder - Folder path in ImageKit
 */
const uploadImage = async (file, fileName, folder = "uploads") => {
  try {
    const ik = getImageKit();

    const response = await ik.upload({
      file,
      fileName,
      folder: `/clutchgear/${folder}`,
      useUniqueFileName: true,
    });

    return {
      success: true,
      url: response.url,
      fileId: response.fileId,
      thumbnailUrl: response.thumbnailUrl,
      name: response.name,
    };
  } catch (error) {
    console.error("ImageKit upload error:", error);
    throw new Error("Failed to upload image");
  }
};

/**
 * Upload multiple images
 */
const uploadMultipleImages = async (files, folder = "uploads") => {
  const uploadPromises = files.map((file, index) =>
    uploadImage(file.buffer, file.originalname || `image_${index}`, folder)
  );

  return await Promise.all(uploadPromises);
};

/**
 * Delete image from ImageKit
 */
const deleteImage = async (fileId) => {
  try {
    const ik = getImageKit();
    await ik.deleteFile(fileId);
    return { success: true };
  } catch (error) {
    console.error("ImageKit delete error:", error);
    throw new Error("Failed to delete image");
  }
};

/**
 * Delete multiple images
 */
const deleteMultipleImages = async (fileIds) => {
  try {
    const ik = getImageKit();
    await ik.bulkDeleteFiles(fileIds);
    return { success: true };
  } catch (error) {
    console.error("ImageKit bulk delete error:", error);
    throw new Error("Failed to delete images");
  }
};

/**
 * Upload video to ImageKit
 * @param {Buffer|String} file - File buffer or base64 string
 * @param {String} fileName - Name for the file
 * @param {String} folder - Folder path in ImageKit
 */
const uploadVideo = async (file, fileName, folder = "videos") => {
  try {
    const ik = getImageKit();

    const response = await ik.upload({
      file,
      fileName,
      folder: `/clutchgear/${folder}`,
      useUniqueFileName: true,
      // Video-specific options
      tags: ["video", "inspection"],
    });

    return {
      success: true,
      url: response.url,
      fileId: response.fileId,
      thumbnailUrl: response.thumbnailUrl,
      name: response.name,
      size: response.size,
      fileType: response.fileType,
    };
  } catch (error) {
    console.error("ImageKit video upload error:", error);
    throw new Error("Failed to upload video");
  }
};

/**
 * Upload multiple videos
 */
const uploadMultipleVideos = async (files, folder = "videos") => {
  const uploadPromises = files.map((file, index) =>
    uploadVideo(file.buffer, file.originalname || `video_${index}`, folder)
  );

  return await Promise.all(uploadPromises);
};

/**
 * Upload mixed media (images and videos)
 */
const uploadMedia = async (file, fileName, folder = "media") => {
  try {
    const ik = getImageKit();

    const response = await ik.upload({
      file,
      fileName,
      folder: `/clutchgear/${folder}`,
      useUniqueFileName: true,
    });

    return {
      success: true,
      url: response.url,
      fileId: response.fileId,
      thumbnailUrl: response.thumbnailUrl,
      name: response.name,
      size: response.size,
      fileType: response.fileType,
      isVideo: response.fileType === "non-image", // ImageKit returns 'non-image' for videos
    };
  } catch (error) {
    console.error("ImageKit media upload error:", error);
    throw new Error("Failed to upload media");
  }
};

/**
 * Upload multiple media files (images and videos)
 */
const uploadMultipleMedia = async (files, folder = "media") => {
  const uploadPromises = files.map((file, index) =>
    uploadMedia(file.buffer, file.originalname || `media_${index}`, folder)
  );

  return await Promise.all(uploadPromises);
};

/**
 * Get image URL with transformations
 */
const getImageUrl = (path, transformations = {}) => {
  const ik = getImageKit();

  const defaultTransformations = [];

  if (transformations.width) {
    defaultTransformations.push({ width: transformations.width });
  }
  if (transformations.height) {
    defaultTransformations.push({ height: transformations.height });
  }
  if (transformations.quality) {
    defaultTransformations.push({ quality: transformations.quality });
  }

  return ik.url({
    path,
    transformation: defaultTransformations,
  });
};

/**
 * Get video thumbnail URL
 */
const getVideoThumbnail = (videoUrl, options = {}) => {
  const ik = getImageKit();
  const width = options.width || 320;
  const height = options.height || 180;

  // ImageKit auto-generates thumbnails for videos
  return ik.url({
    path: videoUrl,
    transformation: [{ width, height }, { format: "jpg" }],
  });
};

/**
 * Get authentication parameters for client-side upload
 */
const getAuthParams = () => {
  const ik = getImageKit();
  return ik.getAuthenticationParameters();
};

module.exports = {
  uploadImage,
  uploadMultipleImages,
  uploadVideo,
  uploadMultipleVideos,
  uploadMedia,
  uploadMultipleMedia,
  deleteImage,
  deleteMultipleImages,
  getImageUrl,
  getVideoThumbnail,
  getAuthParams,
};
