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
    downloadImage
  };
})();

export default ImageProcessor;
