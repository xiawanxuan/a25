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

  return {
    BLEND_MODES,
    stackImages,
    createStarTrailEffect,
    stackWeighted
  };
})();

export default StarStacker;
