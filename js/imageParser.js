// 图像解析模块 - 支持 JPG、PNG、RAW 格式（专业级）
const ImageParser = (() => {
  const RAW_EXTENSIONS = [
    '.cr2', '.cr3', '.nef', '.nrw', '.arw', '.srf', '.sr2', 
    '.dng', '.raw', '.rw2', '.orf', '.pef', '.ptx', 
    '.raf', '.kdc', '.dcr', '.mrw', '.x3f', '.mef', '.iiq', '.3fr', '.fff'
  ];
  
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
    SOFTWARE: 305,
    JPEG_INTERCHANGE_FORMAT: 513,
    JPEG_INTERCHANGE_FORMAT_LENGTH: 514,
    Y_CB_CR_COEFFICIENTS: 529,
    REFERENCE_BLACK_WHITE: 532,
    EXIF_IFD: 34665,
    GPS_IFD: 34853,
    INTEROP_IFD: 40965,
    DNG_VERSION: 50706,
    PREVIEW_IMAGE_START: 50781,
    PREVIEW_IMAGE_LENGTH: 50782,
    PREVIEW_COLOR_SPACE: 50783
  };

  const COMPRESSION_TYPES = {
    UNCOMPRESSED: 1,
    CCITT_1D: 2,
    CCITT_GROUP_3: 3,
    CCITT_GROUP_4: 4,
    LZW: 5,
    JPEG_OLD: 6,
    JPEG: 7,
    DEFLATE: 8,
    PACKBITS: 32773,
    PACKED_RAW: 32771,
    SRF: 32770
  };

  function isRawFile(filename) {
    const ext = '.' + filename.split('.').pop().toLowerCase();
    return RAW_EXTENSIONS.includes(ext);
  }

  function parseFile(file) {
    return new Promise((resolve, reject) => {
      const fileName = file.name.toLowerCase();
      
      if (isRawFile(fileName)) {
        parseRawFile(file).then(resolve).catch((err) => {
          console.warn('RAW解析失败，尝试标准方式:', err);
          return parseStandardImage(file).then(resolve).catch(reject);
        });
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
    return new Promise(async (resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const buffer = e.target.result;
        
        try {
          const result = await decodeRawPreview(buffer, file.name);
          
          if (result && result.imageData) {
            const canvas = document.createElement('canvas');
            canvas.width = result.width;
            canvas.height = result.height;
            const ctx = canvas.getContext('2d');
            ctx.putImageData(result.imageData, 0, 0);
            
            resolve({
              name: file.name,
              width: result.width,
              height: result.height,
              imageData: result.imageData,
              canvas: canvas,
              type: 'raw',
              fileSize: file.size,
              rawInfo: result.info
            });
          } else {
            reject(new Error('无法从RAW文件提取图像: ' + file.name));
          }
        } catch (err) {
          reject(new Error('RAW文件解析失败: ' + err.message));
        }
      };
      
      reader.onerror = () => reject(new Error('文件读取失败: ' + file.name));
      reader.readAsArrayBuffer(file);
    });
  }

  async function decodeRawPreview(buffer, filename) {
    const ext = '.' + filename.split('.').pop().toLowerCase();
    
    const dataView = new DataView(buffer);
    
    let result = null;
    let info = { format: ext };
    
    if (ext === '.dng') {
      result = await decodeDNG(dataView, buffer);
      info.source = 'dng';
    }
    
    if (!result) {
      result = await decodeTiffBasedRaw(dataView, buffer);
      info.source = 'tiff-jpeg';
    }
    
    if (!result) {
      result = await findJpegInBuffer(buffer);
      info.source = 'embedded-jpeg';
    }
    
    if (result && result.imageData) {
      info.width = result.width;
      info.height = result.height;
      return {
        imageData: result.imageData,
        width: result.width,
        height: result.height,
        info
      };
    }
    
    return null;
  }

  async function decodeDNG(dataView, buffer) {
    const byteOrder = dataView.getUint16(0, false);
    const isLittleEndian = byteOrder === 0x4949;
    
    if (byteOrder !== 0x4D4D && byteOrder !== 0x4949) {
      return null;
    }
    
    const magic = dataView.getUint16(2, isLittleEndian);
    if (magic !== 42) return null;
    
    const ifds = parseAllIFDs(dataView, buffer, isLittleEndian);
    
    for (const ifd of ifds) {
      if (ifd.entries[TIFF_TAGS.PREVIEW_IMAGE_START] && 
          ifd.entries[TIFF_TAGS.PREVIEW_IMAGE_LENGTH]) {
        const previewOffset = ifd.entries[TIFF_TAGS.PREVIEW_IMAGE_START].value;
        const previewLength = ifd.entries[TIFF_TAGS.PREVIEW_IMAGE_LENGTH].value;
        
        if (previewOffset + previewLength <= buffer.byteLength) {
          const jpegData = new Uint8Array(buffer, previewOffset, previewLength);
          if (jpegData[0] === 0xFF && jpegData[1] === 0xD8) {
            return await decodeJpegToImageData(jpegData);
          }
        }
      }
    }
    
    for (const ifd of ifds) {
      const compression = ifd.entries[TIFF_TAGS.COMPRESSION];
      const jpegOffset = ifd.entries[TIFF_TAGS.JPEG_INTERCHANGE_FORMAT];
      const jpegLength = ifd.entries[TIFF_TAGS.JPEG_INTERCHANGE_FORMAT_LENGTH];
      const width = ifd.entries[TIFF_TAGS.IMAGE_WIDTH];
      const height = ifd.entries[TIFF_TAGS.IMAGE_LENGTH];
      
      if (compression && (compression.value === COMPRESSION_TYPES.JPEG || 
                          compression.value === COMPRESSION_TYPES.JPEG_OLD) &&
          jpegOffset && jpegLength && width && height) {
        const offset = jpegOffset.value;
        const length = jpegLength.value;
        
        if (offset + length <= buffer.byteLength && width.value > 500 && height.value > 500) {
          const jpegData = new Uint8Array(buffer, offset, length);
          if (jpegData[0] === 0xFF && jpegData[1] === 0xD8) {
            return await decodeJpegToImageData(jpegData);
          }
        }
      }
    }
    
    return null;
  }

  async function decodeTiffBasedRaw(dataView, buffer) {
    const byteOrder = dataView.getUint16(0, false);
    const isLittleEndian = byteOrder === 0x4949;
    
    if (byteOrder !== 0x4D4D && byteOrder !== 0x4949) {
      return null;
    }
    
    const magic = dataView.getUint16(2, isLittleEndian);
    
    const isOrf = magic === 0x4F52;
    if (magic !== 42 && !isOrf) return null;
    
    const ifds = parseAllIFDs(dataView, buffer, isLittleEndian);
    
    let bestResult = null;
    let bestSize = 0;
    
    for (const ifd of ifds) {
      const compression = ifd.entries[TIFF_TAGS.COMPRESSION];
      const width = ifd.entries[TIFF_TAGS.IMAGE_WIDTH];
      const height = ifd.entries[TIFF_TAGS.IMAGE_LENGTH];
      const jpegOffset = ifd.entries[TIFF_TAGS.JPEG_INTERCHANGE_FORMAT];
      const jpegLength = ifd.entries[TIFF_TAGS.JPEG_INTERCHANGE_FORMAT_LENGTH];
      const stripOffsets = ifd.entries[TIFF_TAGS.STRIP_OFFSETS];
      const stripByteCounts = ifd.entries[TIFF_TAGS.STRIP_BYTE_COUNTS];
      const samplesPerPixel = ifd.entries[TIFF_TAGS.SAMPLES_PER_PIXEL];
      
      if (width && height) {
        const imgSize = width.value * height.value;
        
        if (compression && (compression.value === COMPRESSION_TYPES.JPEG || 
                            compression.value === COMPRESSION_TYPES.JPEG_OLD)) {
          if (jpegOffset && jpegLength && imgSize > bestSize) {
            const offset = Array.isArray(jpegOffset.value) ? 
              jpegOffset.value[0] : jpegOffset.value;
            const length = Array.isArray(jpegLength.value) ? 
              jpegLength.value.reduce((a, b) => a + b, 0) : jpegLength.value;
            
            if (offset + length <= buffer.byteLength && length > 10000) {
              const jpegData = new Uint8Array(buffer, offset, length);
              if (jpegData[0] === 0xFF && jpegData[1] === 0xD8) {
                const result = await decodeJpegToImageData(jpegData);
                if (result && result.width > 500) {
                  bestResult = result;
                  bestSize = imgSize;
                }
              }
            }
          }
        }
        
        if (!bestResult || imgSize > bestSize * 0.5) {
          if (stripOffsets && stripByteCounts && samplesPerPixel && samplesPerPixel.value === 3) {
            const offsets = Array.isArray(stripOffsets.value) ? stripOffsets.value : [stripOffsets.value];
            const counts = Array.isArray(stripByteCounts.value) ? stripByteCounts.value : [stripByteCounts.value];
            
            let totalBytes = 0;
            for (const c of counts) totalBytes += c;
            
            if (totalBytes === width.value * height.value * 3) {
              const result = decodeUncompressedRgb(dataView, buffer, offsets, counts, width.value, height.value, isLittleEndian);
              if (result && imgSize > bestSize) {
                bestResult = result;
                bestSize = imgSize;
              }
            }
          }
        }
      }
    }
    
    return bestResult;
  }

  function parseAllIFDs(dataView, buffer, isLittleEndian) {
    const ifds = [];
    let nextIfdOffset = dataView.getUint32(4, isLittleEndian);
    let iterations = 0;
    
    while (nextIfdOffset !== 0 && iterations < 20) {
      iterations++;
      
      if (nextIfdOffset >= buffer.byteLength - 2) break;
      
      const ifd = parseIFD(dataView, nextIfdOffset, isLittleEndian, buffer);
      ifds.push(ifd);
      
      const numEntries = dataView.getUint16(nextIfdOffset, isLittleEndian);
      const nextOffsetPos = nextIfdOffset + 2 + numEntries * 12;
      
      if (nextOffsetPos + 4 <= buffer.byteLength) {
        nextIfdOffset = dataView.getUint32(nextOffsetPos, isLittleEndian);
      } else {
        break;
      }
    }
    
    return ifds;
  }

  function parseIFD(dataView, offset, isLittleEndian, buffer) {
    const entries = {};
    const numEntries = dataView.getUint16(offset, isLittleEndian);
    
    for (let i = 0; i < numEntries; i++) {
      const entryOffset = offset + 2 + i * 12;
      if (entryOffset >= buffer.byteLength - 12) break;
      
      const tag = dataView.getUint16(entryOffset, isLittleEndian);
      const type = dataView.getUint16(entryOffset + 2, isLittleEndian);
      const count = dataView.getUint32(entryOffset + 4, isLittleEndian);
      
      let value;
      let valueOffset = entryOffset + 8;
      
      const typeSizes = {
        1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8
      };
      const valueSize = (typeSizes[type] || 4) * count;
      
      if (valueSize <= 4) {
        value = readTiffValue(dataView, entryOffset + 8, type, count, isLittleEndian, buffer);
      } else {
        const dataOffset = dataView.getUint32(entryOffset + 8, isLittleEndian);
        value = readTiffValue(dataView, dataOffset, type, count, isLittleEndian, buffer);
      }
      
      entries[tag] = { tag, type, count, value };
    }
    
    return { offset, entries };
  }

  function readTiffValue(dataView, offset, type, count, isLittleEndian, buffer) {
    if (offset >= buffer.byteLength) return null;
    
    switch (type) {
      case 1:
      case 6:
      case 7:
        if (count === 1) {
          return dataView.getUint8(offset);
        }
        const bytes = new Uint8Array(buffer, offset, Math.min(count, buffer.byteLength - offset));
        return count === 1 ? bytes[0] : Array.from(bytes);
      
      case 2:
        let str = '';
        for (let i = 0; i < count && offset + i < buffer.byteLength; i++) {
          const char = dataView.getUint8(offset + i);
          if (char === 0) break;
          str += String.fromCharCode(char);
        }
        return str;
      
      case 3:
        if (count === 1) {
          return dataView.getUint16(offset, isLittleEndian);
        }
        const shorts = [];
        for (let i = 0; i < count; i++) {
          if (offset + i * 2 + 2 > buffer.byteLength) break;
          shorts.push(dataView.getUint16(offset + i * 2, isLittleEndian));
        }
        return shorts;
      
      case 4:
      case 9:
        if (count === 1) {
          return dataView.getUint32(offset, isLittleEndian);
        }
        const longs = [];
        for (let i = 0; i < count; i++) {
          if (offset + i * 4 + 4 > buffer.byteLength) break;
          longs.push(dataView.getUint32(offset + i * 4, isLittleEndian));
        }
        return longs;
      
      case 5:
      case 10:
        if (count === 1) {
          const numerator = dataView.getUint32(offset, isLittleEndian);
          const denominator = dataView.getUint32(offset + 4, isLittleEndian);
          return denominator !== 0 ? numerator / denominator : 0;
        }
        const rationals = [];
        for (let i = 0; i < count; i++) {
          if (offset + i * 8 + 8 > buffer.byteLength) break;
          const num = dataView.getUint32(offset + i * 8, isLittleEndian);
          const den = dataView.getUint32(offset + i * 8 + 4, isLittleEndian);
          rationals.push(den !== 0 ? num / den : 0);
        }
        return rationals;
      
      default:
        return dataView.getUint32(offset, isLittleEndian);
    }
  }

  function decodeJpegToImageData(jpegData) {
    return new Promise((resolve) => {
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
        resolve({
          imageData: ctx.getImageData(0, 0, img.width, img.height),
          width: img.width,
          height: img.height
        });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      
      img.src = url;
    });
  }

  function decodeUncompressedRgb(dataView, buffer, stripOffsets, stripByteCounts, width, height, isLittleEndian) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    let pixelIndex = 0;
    let stripIndex = 0;
    
    for (let s = 0; s < stripOffsets.length && pixelIndex < data.length; s++) {
      const offset = stripOffsets[s];
      const count = stripByteCounts[s];
      
      const stripData = new Uint8Array(buffer, offset, count);
      
      for (let i = 0; i < count && pixelIndex < data.length; i += 3) {
        data[pixelIndex] = stripData[i];
        data[pixelIndex + 1] = stripData[i + 1];
        data[pixelIndex + 2] = stripData[i + 2];
        data[pixelIndex + 3] = 255;
        pixelIndex += 4;
      }
    }
    
    return { imageData, width, height };
  }

  async function findJpegInBuffer(buffer) {
    const data = new Uint8Array(buffer);
    let bestResult = null;
    let bestSize = 0;
    
    const searchEnd = Math.min(data.length, 100 * 1024 * 1024);
    
    for (let i = 0; i < searchEnd - 100; i++) {
      if (data[i] === 0xFF && data[i + 1] === 0xD8 && data[i + 2] === 0xFF) {
        let jpegEnd = -1;
        
        const searchLimit = Math.min(i + 50 * 1024 * 1024, data.length - 1);
        for (let j = i + 2; j < searchLimit; j++) {
          if (data[j] === 0xFF && data[j + 1] === 0xD9) {
            jpegEnd = j + 2;
            break;
          }
        }
        
        if (jpegEnd > 0) {
          const size = jpegEnd - i;
          if (size > bestSize && size > 50000) {
            const jpegData = new Uint8Array(buffer, i, size);
            const result = await decodeJpegToImageData(jpegData);
            if (result && result.width > 500) {
              bestResult = result;
              bestSize = size;
              i = jpegEnd;
            }
          }
        }
      }
    }
    
    return bestResult;
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
