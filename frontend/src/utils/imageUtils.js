/**
 * Loads an image and returns its dimensions
 * @param {string} url - URL of the image to check
 * @returns {Promise<{width: number, height: number, success: boolean}>} Image dimensions object
 */
export const getImageDimensions = (url) => {
  return new Promise((resolve) => {
    if (!url) {
      console.warn('getImageDimensions called with empty URL');
      resolve({ width: 0, height: 0, success: false });
      return;
    }
    
    const img = new Image();
    
    img.onload = () => {
      console.log(`Image loaded successfully: ${url} (${img.naturalWidth}x${img.naturalHeight})`);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        success: true
      });
    };
    
    img.onerror = (error) => {
      console.error(`Failed to load image: ${url}`, error);
      resolve({ width: 0, height: 0, success: false });
    };
    
    // Add crossOrigin to avoid CORS issues
    img.crossOrigin = 'Anonymous'; 
    img.src = url;
    
    // Set a timeout in case image loading hangs
    setTimeout(() => {
      if (!img.complete) {
        console.warn(`Image load timeout after 5 seconds: ${url}`);
        resolve({ width: 0, height: 0, success: false });
      }
    }, 5000); // 5 second timeout
  });
};

/**
 * Checks if a URL points to a valid image
 * @param {string} url - URL to check
 * @returns {Promise<boolean>} Whether the URL points to a valid image
 */
export const isValidImageUrl = async (url) => {
  if (!url) {
    console.warn('isValidImageUrl called with empty URL');
    return false;
  }
  
  try {
    console.log(`Checking if URL is valid: ${url}`);
    const dimensions = await getImageDimensions(url);
    return dimensions.success && dimensions.width > 0 && dimensions.height > 0;
  } catch (error) {
    console.error('Error checking image URL:', error);
    return false;
  }
};

/**
 * Extracts filename from a path
 * @param {string} path - Path to extract filename from
 * @returns {string} Filename
 */
export const extractFilename = (path) => {
  if (!path) return '';
  const parts = path.split('/');
  return parts[parts.length - 1];
};

/**
 * Determines if a URL points to an image based on extension
 * @param {string} url - URL to check
 * @returns {boolean} Whether the URL likely points to an image
 */
export const hasImageExtension = (url) => {
  if (!url) return false;
  const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
  const lowerUrl = url.toLowerCase();
  return extensions.some(ext => lowerUrl.endsWith(ext));
};

/**
 * Checks if a string is a valid URL path
 * @param {string} str - String to check
 * @returns {boolean} Whether the string is a valid URL path
 */
export const isValidPath = (str) => {
  if (!str) return false;
  return str.startsWith('/') || 
         str.startsWith('./') || 
         str.startsWith('../') || 
         str.startsWith('http://') || 
         str.startsWith('https://');
};

/**
 * Normalizes an image path to ensure it's in a consistent format
 * @param {string} path - Path to normalize
 * @returns {string} Normalized path
 */
export const normalizeImagePath = (path) => {
  if (!path) return '';
  
  // Remove any query parameters
  const queryIndex = path.indexOf('?');
  if (queryIndex !== -1) {
    path = path.substring(0, queryIndex);
  }
  
  // Ensure path starts with a slash if it's a relative path
  if (!path.startsWith('/') && 
      !path.startsWith('./') && 
      !path.startsWith('../') && 
      !path.startsWith('http://') && 
      !path.startsWith('https://')) {
    path = '/' + path;
  }
  
  // Ensure uploads/images path exists for relative paths
  if (path.startsWith('/') && !path.includes('/uploads/')) {
    path = path.replace(/^\/+/, '/uploads/images/');
  }
  
  return path;
};

/**
 * Safely constructs an image URL from various possible sources
 * @param {Object} image - Image object
 * @returns {string} Best possible URL for the image
 */
export const constructImageUrl = (image) => {
  if (!image) return '';
  
  // Priority order: path, url, filename, name
  if (image.path && isValidPath(image.path)) {
    return normalizeImagePath(image.path);
  }
  
  if (image.url && !image.url.includes('/project/') && !image.url.includes('/annotate')) {
    return image.url;
  }
  
  if (image.filename) {
    return `/uploads/images/${image.filename}`;
  }
  
  if (image.name) {
    return `/uploads/images/${image.name}`;
  }
  
  return '';
};
