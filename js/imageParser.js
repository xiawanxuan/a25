// 图像解析模块 - 支持 JPG、PNG、RAW 格式
const ImageParser = (() => {
  const RAW_EXTENSIONS = ['.raw', '.cr2', '.nef', '.arw', '.dng', '.rw2', '.orf', '.pef', '.sr2'];
  
  const TIFF_TAGS = {
    IMAGE_WIDTH: 256,
    IMAGE_LENGTH: 257,
    BITS_PER_SAMPLE: 258,
    COMPRESSION: 259,
    PHOTO_INTERP: 262,
    STRIP_OFFSETS: 273,
    SAMPLES_PER_PIXEL: 277,
    ROWS_PER_STRIP: 278,
    STRIP_BYTE_COUNTS: 279,
    X_RESOLUTION: 282,
    Y_RESOLUTION: 283,
    RESOLUTION_UNIT: 296,
    THUMBNAIL_OFFSET: 513,
    THUMBNAIL_LENGTH: 514,
    JPEG_INTERCHANGE_FORMAT: 513,
    JPEG_INTERCHANGE_FORMAT_LENGTH: 514,
    EXIF_IFD: 34665,
    GPS_IFD: 34853
  };

  function isRawFile(filename) {
    const ext = '.' + filename.split('.').pop().toLowerCase();
    return RAW_EXTENSIONS.includes(ext);
  }

  function parseFile(file) {
    return new Promise((resolve, reject) => {
      const fileName = file.name.toLowerCase();
      
      if (isRawFile(fileName)) {
        parseRawFile(file).then(resolve).catch(reject);
      } else {
        parseStandardImage(file).then(resolve).catch(reject);
      }
    });
  }

  function parseStandardImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          
          resolve({
            name: file.name,
            width: img.width,
            height: img.height,
            imageData: imageData,
            canvas: canvas,
            type: 'standard',
            fileSize: file.size
          });
        };
        
        img.onerror = () => reject(new Error('图像加载失败: ' + file.name));
        img.src = e.target.result;
      };
      
      reader.onerror = () => reject(new Error('文件读取失败: ' + file.name));
      reader.readAsDataURL(file);
    });
  }

  function parseRawFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const buffer = e.target.result;
        const dataView = new DataView(buffer);
        
        try {
          const jpegData = extractJpegFromRaw(dataView, buffer);
          
          if (jpegData) {
            const blob = new Blob([jpegData], { type: 'image/jpeg' });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            
            img.onload = () => {
              URL.revokeObjectURL(url);
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              
              const imageData = ctx.getImageData(0, 0, img.width, img.height);
              
              resolve({
                name: file.name,
                width: img.width,
                height: img.height,
                imageData: imageData,
                canvas: canvas,
                type: 'raw',
                fileSize: file.size
              });
            };
            
            img.onerror = () => {
              URL.revokeObjectURL(url);
              reject(new Error('RAW预览图解析失败: ' + file.name));
            };
            
            img.src = url;
          } else {
            reject(new Error('无法从RAW文件中提取预览图: ' + file.name));
          }
        } catch (err) {
          reject(new Error('RAW文件解析失败: ' + err.message));
        }
      };
      
      reader.onerror = () => reject(new Error('文件读取失败: ' + file.name));
      reader.readAsArrayBuffer(file);
    });
  }

  function extractJpegFromRaw(dataView, buffer) {
    const byteOrder = dataView.getUint16(0, false);
    const isLittleEndian = byteOrder === 0x4949;
    
    if (byteOrder !== 0x4D4D && byteOrder !== 0x4949) {
      return searchForJpeg(buffer);
    }
    
    const magic = dataView.getUint16(2, isLittleEndian);
    if (magic !== 42 && magic !== 0x4F52) {
      return searchForJpeg(buffer);
    }
    
    const firstIfdOffset = dataView.getUint32(4, isLittleEndian);
    
    let jpegOffset = null;
    let jpegLength = null;
    let nextIfdOffset = firstIfdOffset;
    
    let iterations = 0;
    while (nextIfdOffset !== 0 && iterations < 10) {
      iterations++;
      const ifdOffset = nextIfdOffset;
      
      if (ifdOffset >= buffer.byteLength - 2) break;
      
      const numEntries = dataView.getUint16(ifdOffset, isLittleEndian);
      
      for (let i = 0; i < numEntries; i++) {
        const entryOffset = ifdOffset + 2 + i * 12;
        if (entryOffset >= buffer.byteLength - 12) break;
        
        const tag = dataView.getUint16(entryOffset, isLittleEndian);
        
        if (tag === TIFF_TAGS.JPEG_INTERCHANGE_FORMAT || tag === TIFF_TAGS.STRIP_OFFSETS) {
          const type = dataView.getUint16(entryOffset + 2, isLittleEndian);
          const count = dataView.getUint32(entryOffset + 4, isLittleEndian);
          
          if (type === 4 && count === 1) {
            jpegOffset = dataView.getUint32(entryOffset + 8, isLittleEndian);
          } else if (count === 1) {
            jpegOffset = dataView.getUint32(entryOffset + 8, isLittleEndian);
          }
        }
        
        if (tag === TIFF_TAGS.JPEG_INTERCHANGE_FORMAT_LENGTH || tag === TIFF_TAGS.STRIP_BYTE_COUNTS) {
          const type = dataView.getUint16(entryOffset + 2, isLittleEndian);
          const count = dataView.getUint32(entryOffset + 4, isLittleEndian);
          
          if (type === 4 && count === 1) {
            jpegLength = dataView.getUint32(entryOffset + 8, isLittleEndian);
          } else if (count === 1) {
            jpegLength = dataView.getUint32(entryOffset + 8, isLittleEndian);
          }
        }
        
        if (tag === TIFF_TAGS.EXIF_IFD || tag === TIFF_TAGS.GPS_IFD) {
          // 跳过子IFD的偏移值，不在这里处理
        }
      }
      
      if (jpegOffset && jpegLength) {
        break;
      }
      
      nextIfdOffset = dataView.getUint32(ifdOffset + 2 + numEntries * 12, isLittleEndian);
    }
    
    if (jpegOffset && jpegLength && jpegOffset + jpegLength <= buffer.byteLength) {
      const jpegData = new Uint8Array(buffer, jpegOffset, jpegLength);
      
      if (jpegData[0] === 0xFF && jpegData[1] === 0xD8) {
        return jpegData;
      }
    }
    
    return searchForJpeg(buffer);
  }

  function searchForJpeg(buffer) {
    const data = new Uint8Array(buffer);
    const searchLength = Math.min(data.length, 5 * 1024 * 1024);
    
    for (let i = 0; i < searchLength - 100; i++) {
      if (data[i] === 0xFF && data[i + 1] === 0xD8 && data[i + 2] === 0xFF) {
        let jpegEnd = -1;
        
        for (let j = i + 2; j < Math.min(i + 20 * 1024 * 1024, data.length - 1); j++) {
          if (data[j] === 0xFF && data[j + 1] === 0xD9) {
            jpegEnd = j + 2;
            break;
          }
        }
        
        if (jpegEnd > 0 && jpegEnd - i > 10000) {
          return new Uint8Array(buffer, i, jpegEnd - i);
        }
      }
    }
    
    return null;
  }

  function createThumbnail(imageData, maxSize = 100) {
    const canvas = document.createElement('canvas');
    const scale = Math.min(maxSize / imageData.width, maxSize / imageData.height, 1);
    canvas.width = Math.round(imageData.width * scale);
    canvas.height = Math.round(imageData.height * scale);
    const ctx = canvas.getContext('2d');
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
    
    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
    
    return canvas;
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  return {
    parseFile,
    isRawFile,
    createThumbnail,
    formatFileSize
  };
})();

export default ImageParser;
