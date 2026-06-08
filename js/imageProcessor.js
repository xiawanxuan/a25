// 图像处理模块 - 亮度、对比度、饱和度、前景背景分离
const ImageProcessor = (() => {
  function adjustBrightness(imageData, brightness) {
    const data = imageData.data;
    const value = brightness * 2.55;
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = clamp(data[i] + value);
      data[i + 1] = clamp(data[i + 1] + value);
      data[i + 2] = clamp(data[i + 2] + value);
    }
    
    return imageData;
  }

  function adjustContrast(imageData, contrast) {
    const data = imageData.data;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = clamp(factor * (data[i] - 128) + 128);
      data[i + 1] = clamp(factor * (data[i + 1] - 128) + 128);
      data[i + 2] = clamp(factor * (data[i + 2] - 128) + 128);
    }
    
    return imageData;
  }

  function adjustSaturation(imageData, saturation) {
    const data = imageData.data;
    const sat = saturation / 100;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
      
      data[i] = clamp(gray + sat * (r - gray));
      data[i + 1] = clamp(gray + sat * (g - gray));
      data[i + 2] = clamp(gray + sat * (b - gray));
    }
    
    return imageData;
  }

  function adjustAll(imageData, options = {}) {
    const { brightness = 0, contrast = 0, saturation = 0 } = options;
    
    const data = imageData.data;
    const brightnessVal = brightness * 2.55;
    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const sat = saturation / 100;
    
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      
      r = clamp(r + brightnessVal);
      g = clamp(g + brightnessVal);
      b = clamp(b + brightnessVal);
      
      r = clamp(contrastFactor * (r - 128) + 128);
      g = clamp(contrastFactor * (g - 128) + 128);
      b = clamp(contrastFactor * (b - 128) + 128);
      
      const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
      r = clamp(gray + sat * (r - gray));
      g = clamp(gray + sat * (g - gray));
      b = clamp(gray + sat * (b - gray));
      
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
    
    return imageData;
  }

  function separateStarsAndBackground(imageData, threshold = 30) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    const starCanvas = document.createElement('canvas');
    starCanvas.width = width;
    starCanvas.height = height;
    const starCtx = starCanvas.getContext('2d');
    const starImageData = starCtx.createImageData(width, height);
    const starData = starImageData.data;
    
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = width;
    bgCanvas.height = height;
    const bgCtx = bgCanvas.getContext('2d');
    const bgImageData = bgCtx.createImageData(width, height);
    const bgData = bgImageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      const brightness = (r + g + b) / 3;
      
      if (brightness > threshold) {
        starData[i] = r;
        starData[i + 1] = g;
        starData[i + 2] = b;
        starData[i + 3] = a;
        
        bgData[i] = Math.floor(r * 0.3);
        bgData[i + 1] = Math.floor(g * 0.3);
        bgData[i + 2] = Math.floor(b * 0.3);
        bgData[i + 3] = a;
      } else {
        starData[i] = 0;
        starData[i + 1] = 0;
        starData[i + 2] = 0;
        starData[i + 3] = 0;
        
        bgData[i] = r;
        bgData[i + 1] = g;
        bgData[i + 2] = b;
        bgData[i + 3] = a;
      }
    }
    
    starCtx.putImageData(starImageData, 0, 0);
    bgCtx.putImageData(bgImageData, 0, 0);
    
    return {
      stars: {
        imageData: starImageData,
        canvas: starCanvas
      },
      background: {
        imageData: bgImageData,
        canvas: bgCanvas
      }
    };
  }

  function blendStarBackground(starData, bgData, starIntensity = 1, bgIntensity = 1) {
    const width = starData.width;
    const height = starData.height;
    
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = width;
    resultCanvas.height = height;
    const ctx = resultCanvas.getContext('2d');
    const resultImageData = ctx.createImageData(width, height);
    const result = resultImageData.data;
    
    const starPixels = starData.data;
    const bgPixels = bgData.data;
    
    for (let i = 0; i < result.length; i += 4) {
      const starR = starPixels[i] * starIntensity;
      const starG = starPixels[i + 1] * starIntensity;
      const starB = starPixels[i + 2] * starIntensity;
      const starA = starPixels[i + 3] / 255;
      
      const bgR = bgPixels[i] * bgIntensity;
      const bgG = bgPixels[i + 1] * bgIntensity;
      const bgB = bgPixels[i + 2] * bgIntensity;
      
      result[i] = clamp(starR * starA + bgR * (1 - starA));
      result[i + 1] = clamp(starG * starA + bgG * (1 - starA));
      result[i + 2] = clamp(starB * starA + bgB * (1 - starA));
      result[i + 3] = 255;
    }
    
    ctx.putImageData(resultImageData, 0, 0);
    
    return {
      imageData: resultImageData,
      canvas: resultCanvas
    };
  }

  function cloneImageData(imageData) {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    
    const newImageData = ctx.createImageData(imageData.width, imageData.height);
    newImageData.data.set(imageData.data);
    
    return newImageData;
  }

  function clamp(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
  }

  function invertColors(imageData) {
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
    
    return imageData;
  }

  function grayscale(imageData) {
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
    
    return imageData;
  }

  function autoLevels(imageData) {
    const data = imageData.data;
    
    let minR = 255, minG = 255, minB = 255;
    let maxR = 0, maxG = 0, maxB = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < minR) minR = data[i];
      if (data[i + 1] < minG) minG = data[i + 1];
      if (data[i + 2] < minB) minB = data[i + 2];
      if (data[i] > maxR) maxR = data[i];
      if (data[i + 1] > maxG) maxG = data[i + 1];
      if (data[i + 2] > maxB) maxB = data[i + 2];
    }
    
    const rangeR = maxR - minR || 1;
    const rangeG = maxG - minG || 1;
    const rangeB = maxB - minB || 1;
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.round((data[i] - minR) / rangeR * 255);
      data[i + 1] = Math.round((data[i + 1] - minG) / rangeG * 255);
      data[i + 2] = Math.round((data[i + 2] - minB) / rangeB * 255);
    }
    
    return imageData;
  }

  function gaussianBlur(imageData, radius = 2) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const result = ctx.createImageData(width, height);
    const resultData = result.data;
    
    const kernelSize = radius * 2 + 1;
    const kernel = [];
    const sigma = radius / 2;
    let kernelSum = 0;
    
    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        const value = Math.exp(-(x * x + y * y) / (2 * sigma * sigma)) / (2 * Math.PI * sigma * sigma);
        kernel.push(value);
        kernelSum += value;
      }
    }
    
    for (let i = 0; i < kernel.length; i++) {
      kernel[i] /= kernelSum;
    }
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        let r = 0, g = 0, b = 0, a = 0;
        
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const px = Math.min(Math.max(x + kx, 0), width - 1);
            const py = Math.min(Math.max(y + ky, 0), height - 1);
            const pidx = (py * width + px) * 4;
            const kval = kernel[(ky + radius) * kernelSize + (kx + radius)];
            
            r += data[pidx] * kval;
            g += data[pidx + 1] * kval;
            b += data[pidx + 2] * kval;
            a += data[pidx + 3] * kval;
          }
        }
        
        resultData[idx] = r;
        resultData[idx + 1] = g;
        resultData[idx + 2] = b;
        resultData[idx + 3] = a;
      }
    }
    
    ctx.putImageData(result, 0, 0);
    
    return {
      imageData: result,
      canvas: canvas
    };
  }

  function exportCanvas(canvas, format = 'png', quality = 0.95) {
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    return canvas.toDataURL(mimeType, quality);
  }

  function downloadImage(dataUrl, filename = 'star-trail-result.png') {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function blendWithBackground(foregroundData, backgroundData, options = {}) {
    const {
      mode = 'lighten',
      opacity = 1,
      foregroundOpacity = 1
    } = options;

    const width = foregroundData.width;
    const height = foregroundData.height;
    
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = width;
    resultCanvas.height = height;
    const ctx = resultCanvas.getContext('2d');
    const resultImageData = ctx.createImageData(width, height);
    const result = resultImageData.data;
    
    const fgPixels = foregroundData.data;
    const bgPixels = backgroundData.data;
    
    for (let i = 0; i < result.length; i += 4) {
      const fgR = fgPixels[i] / 255;
      const fgG = fgPixels[i + 1] / 255;
      const fgB = fgPixels[i + 2] / 255;
      const fgA = (fgPixels[i + 3] / 255) * foregroundOpacity;
      
      const bgR = bgPixels[i] / 255;
      const bgG = bgPixels[i + 1] / 255;
      const bgB = bgPixels[i + 2] / 255;
      const bgA = (bgPixels[i + 3] / 255) * opacity;
      
      let r, g, b, a;
      
      switch (mode) {
        case 'screen':
          r = 1 - (1 - fgR) * (1 - bgR);
          g = 1 - (1 - fgG) * (1 - bgG);
          b = 1 - (1 - fgB) * (1 - bgB);
          break;
          
        case 'multiply':
          r = fgR * bgR;
          g = fgG * bgG;
          b = fgB * bgB;
          break;
          
        case 'overlay':
          r = bgR < 0.5 ? 2 * fgR * bgR : 1 - 2 * (1 - fgR) * (1 - bgR);
          g = bgG < 0.5 ? 2 * fgG * bgG : 1 - 2 * (1 - fgG) * (1 - bgG);
          b = bgB < 0.5 ? 2 * fgB * bgB : 1 - 2 * (1 - fgB) * (1 - bgB);
          break;
          
        case 'normal':
          r = fgR * fgA + bgR * (1 - fgA);
          g = fgG * fgA + bgG * (1 - fgA);
          b = fgB * fgA + bgB * (1 - fgA);
          break;
          
        case 'lighten':
        default:
          r = Math.max(fgR, bgR);
          g = Math.max(fgG, bgG);
          b = Math.max(fgB, bgB);
          break;
      }
      
      a = Math.max(fgA, bgA);
      
      result[i] = clamp(r * 255);
      result[i + 1] = clamp(g * 255);
      result[i + 2] = clamp(b * 255);
      result[i + 3] = clamp(a * 255);
    }
    
    ctx.putImageData(resultImageData, 0, 0);
    
    return {
      imageData: resultImageData,
      canvas: resultCanvas,
      width,
      height
    };
  }

  function resizeImageData(imageData, targetWidth, targetHeight) {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = imageData.width;
    srcCanvas.height = imageData.height;
    srcCanvas.getContext('2d').putImageData(imageData, 0, 0);
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(srcCanvas, 0, 0, targetWidth, targetHeight);
    
    return {
      imageData: ctx.getImageData(0, 0, targetWidth, targetHeight),
      canvas: canvas,
      width: targetWidth,
      height: targetHeight
    };
  }

  function fitBackgroundToForeground(bgImageData, fgImageData) {
    const fgRatio = fgImageData.width / fgImageData.height;
    const bgRatio = bgImageData.width / bgImageData.height;
    
    let targetWidth, targetHeight;
    
    if (bgRatio > fgRatio) {
      targetHeight = fgImageData.height;
      targetWidth = Math.round(targetHeight * bgRatio);
    } else {
      targetWidth = fgImageData.width;
      targetHeight = Math.round(targetWidth / bgRatio);
    }
    
    const resized = resizeImageData(bgImageData, targetWidth, targetHeight);
    
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = fgImageData.width;
    resultCanvas.height = fgImageData.height;
    const ctx = resultCanvas.getContext('2d');
    
    const offsetX = Math.round((fgImageData.width - targetWidth) / 2);
    const offsetY = Math.round((fgImageData.height - targetHeight) / 2);
    
    ctx.drawImage(resized.canvas, offsetX, offsetY);
    
    return {
      imageData: ctx.getImageData(0, 0, fgImageData.width, fgImageData.height),
      canvas: resultCanvas,
      width: fgImageData.width,
      height: fgImageData.height,
      offsetX,
      offsetY
    };
  }

  const EXPORT_PRESETS = [
    { name: '原图尺寸', width: 0, height: 0, suffix: '' },
    { name: '4K (3840×2160)', width: 3840, height: 2160, suffix: '-4k' },
    { name: '2K (2560×1440)', width: 2560, height: 1440, suffix: '-2k' },
    { name: '全高清 (1920×1080)', width: 1920, height: 1080, suffix: '-fhd' },
    { name: '高清 (1280×720)', width: 1280, height: 720, suffix: '-hd' },
    { name: '社交媒体 (1080×1080)', width: 1080, height: 1080, suffix: '-social' },
    { name: '4K竖版 (2160×3840)', width: 2160, height: 3840, suffix: '-4k-portrait' },
    { name: '自定义尺寸', width: -1, height: -1, suffix: '-custom' }
  ];

  function batchExport(canvas, options = {}) {
    const {
      presets = ['original', '4k', 'fhd'],
      format = 'png',
      quality = 0.95,
      filenamePrefix = 'star-trail',
      onProgress = null
    } = options;

    const originalWidth = canvas.width;
    const originalHeight = canvas.height;
    const originalRatio = originalWidth / originalHeight;
    
    const results = [];
    const allPresets = getExportPresetList();
    
    const selectedPresets = allPresets.filter(p => presets.includes(p.key) || presets.includes(p.name));
    
    for (let i = 0; i < selectedPresets.length; i++) {
      const preset = selectedPresets[i];
      
      if (onProgress) {
        onProgress(i, selectedPresets.length, preset.name);
      }
      
      let targetWidth, targetHeight;
      
      if (preset.width === 0 && preset.height === 0) {
        targetWidth = originalWidth;
        targetHeight = originalHeight;
      } else {
        const presetRatio = preset.width / preset.height;
        
        if (originalRatio > presetRatio) {
          targetWidth = preset.width;
          targetHeight = Math.round(preset.width / originalRatio);
        } else {
          targetHeight = preset.height;
          targetWidth = Math.round(preset.height * originalRatio);
        }
      }
      
      const resizedCanvas = document.createElement('canvas');
      resizedCanvas.width = targetWidth;
      resizedCanvas.height = targetHeight;
      const ctx = resizedCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
      
      const dataUrl = exportCanvas(resizedCanvas, format, quality);
      const ext = format === 'jpeg' ? 'jpg' : 'png';
      const filename = `${filenamePrefix}${preset.suffix}.${ext}`;
      
      results.push({
        name: preset.name,
        width: targetWidth,
        height: targetHeight,
        dataUrl,
        filename,
        size: Math.round(dataUrl.length * 0.75)
      });
    }
    
    return results;
  }

  function downloadBatchExport(results) {
    results.forEach((result, index) => {
      setTimeout(() => {
        downloadImage(result.dataUrl, result.filename);
      }, index * 500);
    });
  }

  function getExportPresetList() {
    return [
      { key: 'original', name: '原图尺寸', width: 0, height: 0, suffix: '' },
      { key: '4k', name: '4K (3840×2160)', width: 3840, height: 2160, suffix: '-4k' },
      { key: '2k', name: '2K (2560×1440)', width: 2560, height: 1440, suffix: '-2k' },
      { key: 'fhd', name: '全高清 (1920×1080)', width: 1920, height: 1080, suffix: '-fhd' },
      { key: 'hd', name: '高清 (1280×720)', width: 1280, height: 720, suffix: '-hd' },
      { key: 'social', name: '社交媒体 (1080×1080)', width: 1080, height: 1080, suffix: '-social' },
      { key: '4k-portrait', name: '4K竖版 (2160×3840)', width: 2160, height: 3840, suffix: '-4k-portrait' }
    ];
  }

  function adjustBackground(imageData, options = {}) {
    const {
      brightness = 0,
      contrast = 0,
      saturation = 0,
      maskThreshold = null
    } = options;

    const result = cloneImageData(imageData);
    const data = result.data;
    
    const brightnessVal = brightness * 2.55;
    const contrastFactor = contrast !== 0 ? 
      (259 * (contrast + 255)) / (255 * (259 - contrast)) : 1;
    const sat = saturation / 100;
    
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      
      const pixelBrightness = (r + g + b) / 3;
      
      if (maskThreshold !== null && pixelBrightness > maskThreshold) {
        continue;
      }
      
      if (brightnessVal !== 0) {
        r += brightnessVal;
        g += brightnessVal;
        b += brightnessVal;
      }
      
      if (contrastFactor !== 1) {
        r = contrastFactor * (r - 128) + 128;
        g = contrastFactor * (g - 128) + 128;
        b = contrastFactor * (b - 128) + 128;
      }
      
      if (sat !== 0) {
        const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
        r = gray + sat * (r - gray);
        g = gray + sat * (g - gray);
        b = gray + sat * (b - gray);
      }
      
      data[i] = clamp(r);
      data[i + 1] = clamp(g);
      data[i + 2] = clamp(b);
    }
    
    return result;
  }

  return {
    adjustBrightness,
    adjustContrast,
    adjustSaturation,
    adjustAll,
    separateStarsAndBackground,
    blendStarBackground,
    cloneImageData,
    invertColors,
    grayscale,
    autoLevels,
    gaussianBlur,
    exportCanvas,
    downloadImage,
    blendWithBackground,
    resizeImageData,
    fitBackgroundToForeground,
    batchExport,
    downloadBatchExport,
    getExportPresetList,
    adjustBackground
  };
})();

export default ImageProcessor;
