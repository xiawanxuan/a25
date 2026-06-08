// 星轨合成模块 - 多种叠加合成算法（含自动对齐）
import ImageAligner from './imageAligner.js';

const StarStacker = (() => {
  const BLEND_MODES = {
    LIGHTEN: 'lighten',
    SCREEN: 'screen',
    MAX: 'max',
    AVERAGE: 'average'
  };

  async function stackImages(imageDataList, options = {}) {
    if (!imageDataList || imageDataList.length === 0) {
      throw new Error('没有可合成的图像');
    }

    const mode = options.mode || BLEND_MODES.LIGHTEN;
    const intensity = (options.intensity || 100) / 100;
    const enableAlign = options.align !== false;
    const referenceIndex = options.referenceIndex || 0;
    const onProgress = options.onProgress || null;
    
    const firstImg = imageDataList[0];
    const width = firstImg.width;
    const height = firstImg.height;
    
    let alignedImages = imageDataList;
    let alignResults = null;
    
    if (enableAlign && imageDataList.length > 1) {
      if (onProgress) onProgress('aligning', 0, imageDataList.length);
      
      alignResults = ImageAligner.alignImageList(imageDataList, {
        referenceIndex,
        onProgress: (current, total) => {
          if (onProgress) onProgress('aligning', current, total);
        },
        detectionOptions: {
          threshold: 15,
          minArea: 2,
          maxArea: 100,
          maxStars: 200
        }
      });
      
      alignedImages = alignResults.map(r => r.imageData);
    }
    
    if (onProgress) onProgress('stacking', 0, alignedImages.length);
    
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = width;
    resultCanvas.height = height;
    const ctx = resultCanvas.getContext('2d');
    
    const resultImageData = ctx.createImageData(width, height);
    const resultData = resultImageData.data;
    
    switch (mode) {
      case BLEND_MODES.MAX:
        stackMax(alignedImages, resultData, width, height, intensity);
        break;
      case BLEND_MODES.SCREEN:
        stackScreen(alignedImages, resultData, width, height, intensity);
        break;
      case BLEND_MODES.AVERAGE:
        stackAverage(alignedImages, resultData, width, height, intensity);
        break;
      case BLEND_MODES.LIGHTEN:
      default:
        stackLighten(alignedImages, resultData, width, height, intensity);
        break;
    }
    
    ctx.putImageData(resultImageData, 0, 0);
    
    return {
      imageData: resultImageData,
      canvas: resultCanvas,
      width: width,
      height: height,
      alignResults: alignResults,
      aligned: enableAlign && imageDataList.length > 1
    };
  }

  function stackLighten(imageDataList, resultData, width, height, intensity) {
    const pixelCount = width * height;
    const firstData = imageDataList[0].data;
    
    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      let maxR = firstData[idx];
      let maxG = firstData[idx + 1];
      let maxB = firstData[idx + 2];
      let maxA = firstData[idx + 3];
      
      for (let j = 1; j < imageDataList.length; j++) {
        const data = imageDataList[j].data;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        const brightness = (r + g + b) / 3;
        const maxBrightness = (maxR + maxG + maxB) / 3;
        
        if (brightness > maxBrightness) {
          maxR = r;
          maxG = g;
          maxB = b;
          maxA = data[idx + 3];
        }
      }
      
      if (intensity !== 1) {
        maxR = blendValue(firstData[idx], maxR, intensity);
        maxG = blendValue(firstData[idx + 1], maxG, intensity);
        maxB = blendValue(firstData[idx + 2], maxB, intensity);
      }
      
      resultData[idx] = maxR;
      resultData[idx + 1] = maxG;
      resultData[idx + 2] = maxB;
      resultData[idx + 3] = maxA;
    }
  }

  function stackMax(imageDataList, resultData, width, height, intensity) {
    const pixelCount = width * height;
    const firstData = imageDataList[0].data;
    
    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      let maxR = firstData[idx];
      let maxG = firstData[idx + 1];
      let maxB = firstData[idx + 2];
      let maxA = firstData[idx + 3];
      
      for (let j = 1; j < imageDataList.length; j++) {
        const data = imageDataList[j].data;
        if (data[idx] > maxR) maxR = data[idx];
        if (data[idx + 1] > maxG) maxG = data[idx + 1];
        if (data[idx + 2] > maxB) maxB = data[idx + 2];
        if (data[idx + 3] > maxA) maxA = data[idx + 3];
      }
      
      if (intensity !== 1) {
        maxR = blendValue(firstData[idx], maxR, intensity);
        maxG = blendValue(firstData[idx + 1], maxG, intensity);
        maxB = blendValue(firstData[idx + 2], maxB, intensity);
      }
      
      resultData[idx] = maxR;
      resultData[idx + 1] = maxG;
      resultData[idx + 2] = maxB;
      resultData[idx + 3] = maxA;
    }
  }

  function stackScreen(imageDataList, resultData, width, height, intensity) {
    const pixelCount = width * height;
    const firstData = imageDataList[0].data;
    
    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      let r = firstData[idx] / 255;
      let g = firstData[idx + 1] / 255;
      let b = firstData[idx + 2] / 255;
      
      for (let j = 1; j < imageDataList.length; j++) {
        const data = imageDataList[j].data;
        const r2 = data[idx] / 255;
        const g2 = data[idx + 1] / 255;
        const b2 = data[idx + 2] / 255;
        
        r = 1 - (1 - r) * (1 - r2);
        g = 1 - (1 - g) * (1 - g2);
        b = 1 - (1 - b) * (1 - b2);
      }
      
      r = Math.round(r * 255);
      g = Math.round(g * 255);
      b = Math.round(b * 255);
      
      if (intensity !== 1) {
        r = blendValue(firstData[idx], r, intensity);
        g = blendValue(firstData[idx + 1], g, intensity);
        b = blendValue(firstData[idx + 2], b, intensity);
      }
      
      resultData[idx] = r;
      resultData[idx + 1] = g;
      resultData[idx + 2] = b;
      resultData[idx + 3] = firstData[idx + 3];
    }
  }

  function stackAverage(imageDataList, resultData, width, height, intensity) {
    const pixelCount = width * height;
    const count = imageDataList.length;
    const firstData = imageDataList[0].data;
    
    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumA = 0;
      
      for (let j = 0; j < count; j++) {
        const data = imageDataList[j].data;
        sumR += data[idx];
        sumG += data[idx + 1];
        sumB += data[idx + 2];
        sumA += data[idx + 3];
      }
      
      let r = Math.round(sumR / count);
      let g = Math.round(sumG / count);
      let b = Math.round(sumB / count);
      let a = Math.round(sumA / count);
      
      if (intensity !== 1) {
        r = blendValue(firstData[idx], r, intensity);
        g = blendValue(firstData[idx + 1], g, intensity);
        b = blendValue(firstData[idx + 2], b, intensity);
      }
      
      resultData[idx] = r;
      resultData[idx + 1] = g;
      resultData[idx + 2] = b;
      resultData[idx + 3] = a;
    }
  }

  function blendValue(base, blended, factor) {
    return Math.round(base + (blended - base) * factor);
  }

  function createStarTrailEffect(imageDataList, options = {}) {
    const trailLength = options.trailLength || imageDataList.length;
    const fadeOut = options.fadeOut !== false;
    const images = imageDataList.slice(-trailLength);
    
    const weightedImages = images.map((img, index) => {
      const weight = fadeOut ? (index + 1) / images.length : 1;
      return { imageData: img, weight };
    });
    
    return stackWeighted(weightedImages, options);
  }

  function stackWeighted(weightedImages, options = {}) {
    if (weightedImages.length === 0) {
      throw new Error('没有可合成的图像');
    }

    const mode = options.mode || BLEND_MODES.LIGHTEN;
    const firstImg = weightedImages[0].imageData;
    const width = firstImg.width;
    const height = firstImg.height;
    
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = width;
    resultCanvas.height = height;
    const ctx = resultCanvas.getContext('2d');
    
    const resultImageData = ctx.createImageData(width, height);
    const resultData = resultImageData.data;
    const pixelCount = width * height;
    
    let totalWeight = 0;
    weightedImages.forEach(w => totalWeight += w.weight);
    
    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      
      if (mode === BLEND_MODES.AVERAGE) {
        let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
        
        weightedImages.forEach(({ imageData, weight }) => {
          const data = imageData.data;
          sumR += data[idx] * weight;
          sumG += data[idx + 1] * weight;
          sumB += data[idx + 2] * weight;
          sumA += data[idx + 3] * weight;
        });
        
        resultData[idx] = Math.round(sumR / totalWeight);
        resultData[idx + 1] = Math.round(sumG / totalWeight);
        resultData[idx + 2] = Math.round(sumB / totalWeight);
        resultData[idx + 3] = Math.round(sumA / totalWeight);
      } else {
        let maxR = -1, maxG = -1, maxB = -1, maxA = 0;
        let maxBrightness = -1;
        
        weightedImages.forEach(({ imageData, weight }) => {
          const data = imageData.data;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const brightness = (r + g + b) / 3 * weight;
          
          if (brightness > maxBrightness) {
            maxBrightness = brightness;
            maxR = r;
            maxG = g;
            maxB = b;
            maxA = data[idx + 3];
          }
        });
        
        resultData[idx] = maxR;
        resultData[idx + 1] = maxG;
        resultData[idx + 2] = maxB;
        resultData[idx + 3] = maxA;
      }
    }
    
    ctx.putImageData(resultImageData, 0, 0);
    
    return {
      imageData: resultImageData,
      canvas: resultCanvas,
      width: width,
      height: height
    };
  }

  function enhanceStarTrail(imageData, options = {}) {
    const {
      trailIntensity = 100,
      trailGlow = 0,
      trailThickness = 1,
      brightnessBoost = 0,
      contrastBoost = 0
    } = options;

    const width = imageData.width;
    const height = imageData.height;
    const pixelCount = width * height;
    
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = width;
    resultCanvas.height = height;
    const ctx = resultCanvas.getContext('2d');
    
    let resultImageData = cloneImageDataInternal(imageData);
    const resultData = resultImageData.data;
    
    const intensityFactor = trailIntensity / 100;
    
    if (trailThickness > 1 || trailGlow > 0) {
      resultImageData = applyTrailGlow(resultImageData, trailGlow, trailThickness);
    }
    
    if (brightnessBoost !== 0 || contrastBoost !== 0 || intensityFactor !== 1) {
      const data = resultImageData.data;
      
      const contrastFactor = contrastBoost !== 0 ? 
        (259 * (contrastBoost + 255)) / (255 * (259 - contrastBoost)) : 1;
      const brightnessVal = brightnessBoost * 2.55;
      
      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        
        const brightness = (r + g + b) / 3;
        if (brightness > 30) {
          r = r * intensityFactor;
          g = g * intensityFactor;
          b = b * intensityFactor;
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
        
        data[i] = clampValue(r);
        data[i + 1] = clampValue(g);
        data[i + 2] = clampValue(b);
      }
    }
    
    ctx.putImageData(resultImageData, 0, 0);
    
    return {
      imageData: resultImageData,
      canvas: resultCanvas,
      width,
      height
    };
  }

  function applyTrailGlow(imageData, glowIntensity, thickness) {
    const width = imageData.width;
    const height = imageData.height;
    
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = width;
    resultCanvas.height = height;
    const ctx = resultCanvas.getContext('2d');
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(imageData, 0, 0);
    
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(tempCanvas, 0, 0);
    
    if (glowIntensity > 0 || thickness > 1) {
      const blurRadius = Math.max(thickness - 1, glowIntensity / 10);
      
      if (blurRadius > 0) {
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = width;
        glowCanvas.height = height;
        const glowCtx = glowCanvas.getContext('2d');
        
        glowCtx.filter = `blur(${blurRadius}px)`;
        glowCtx.drawImage(tempCanvas, 0, 0);
        
        const glowOpacity = (glowIntensity / 100) * 0.7 + 0.3;
        ctx.globalAlpha = glowOpacity;
        ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(glowCanvas, 0, 0);
        
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(tempCanvas, 0, 0);
      }
    }
    
    return ctx.getImageData(0, 0, width, height);
  }

  function createMotionBlurTrail(imageData, options = {}) {
    const {
      angle = 45,
      length = 10,
      intensity = 50
    } = options;

    const width = imageData.width;
    const height = imageData.height;
    const srcData = imageData.data;
    
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = width;
    resultCanvas.height = height;
    const ctx = resultCanvas.getContext('2d');
    const resultImageData = ctx.createImageData(width, height);
    const resultData = resultImageData.data;
    
    const angleRad = angle * Math.PI / 180;
    const dx = Math.cos(angleRad);
    const dy = Math.sin(angleRad);
    const steps = Math.max(1, Math.floor(length));
    const intensityFactor = intensity / 100;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        let sumR = srcData[idx] * 0.5;
        let sumG = srcData[idx + 1] * 0.5;
        let sumB = srcData[idx + 2] * 0.5;
        let weightSum = 0.5;
        
        for (let s = 1; s <= steps; s++) {
          const offsetX = dx * s * 0.5;
          const offsetY = dy * s * 0.5;
          
          const sampleX = Math.floor(x + offsetX);
          const sampleY = Math.floor(y + offsetY);
          const sampleX2 = Math.floor(x - offsetX);
          const sampleY2 = Math.floor(y - offsetY);
          
          const weight = (1 - s / steps) * 0.25;
          
          if (sampleX >= 0 && sampleX < width && sampleY >= 0 && sampleY < height) {
            const sIdx = (sampleY * width + sampleX) * 4;
            sumR += srcData[sIdx] * weight;
            sumG += srcData[sIdx + 1] * weight;
            sumB += srcData[sIdx + 2] * weight;
            weightSum += weight;
          }
          
          if (sampleX2 >= 0 && sampleX2 < width && sampleY2 >= 0 && sampleY2 < height) {
            const sIdx2 = (sampleY2 * width + sampleX2) * 4;
            sumR += srcData[sIdx2] * weight;
            sumG += srcData[sIdx2 + 1] * weight;
            sumB += srcData[sIdx2 + 2] * weight;
            weightSum += weight;
          }
        }
        
        const finalR = srcData[idx] * (1 - intensityFactor * 0.5) + (sumR / weightSum) * intensityFactor * 0.5;
        const finalG = srcData[idx + 1] * (1 - intensityFactor * 0.5) + (sumG / weightSum) * intensityFactor * 0.5;
        const finalB = srcData[idx + 2] * (1 - intensityFactor * 0.5) + (sumB / weightSum) * intensityFactor * 0.5;
        
        resultData[idx] = clampValue(finalR);
        resultData[idx + 1] = clampValue(finalG);
        resultData[idx + 2] = clampValue(finalB);
        resultData[idx + 3] = srcData[idx + 3];
      }
    }
    
    ctx.putImageData(resultImageData, 0, 0);
    
    return {
      imageData: resultImageData,
      canvas: resultCanvas,
      width,
      height
    };
  }

  function cloneImageDataInternal(imageData) {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    const newImageData = ctx.createImageData(imageData.width, imageData.height);
    newImageData.data.set(imageData.data);
    return newImageData;
  }

  function clampValue(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
  }

  return {
    BLEND_MODES,
    stackImages,
    createStarTrailEffect,
    stackWeighted,
    enhanceStarTrail,
    createMotionBlurTrail
  };
})();

export default StarStacker;
