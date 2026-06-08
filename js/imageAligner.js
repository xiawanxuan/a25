// 图像对齐模块 - 基于恒星特征点检测的自动对齐
const ImageAligner = (() => {
  function detectStars(imageData, options = {}) {
    const {
      threshold = 20,
      minArea = 2,
      maxArea = 200,
      maxStars = 300
    } = options;

    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const pixelCount = width * height;

    const brightness = new Float32Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      brightness[i] = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
    }

    const visited = new Uint8Array(pixelCount);
    const stars = [];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        if (visited[idx] || brightness[idx] < threshold) continue;

        const star = floodFillStar(x, y, brightness, visited, width, height, threshold);
        
        if (star && star.area >= minArea && star.area <= maxArea) {
          stars.push(star);
        }
      }
    }

    stars.sort((a, b) => b.totalBrightness - a.totalBrightness);
    
    return stars.slice(0, maxStars);
  }

  function floodFillStar(startX, startY, brightness, visited, width, height, threshold) {
    const stack = [[startX, startY]];
    let sumX = 0;
    let sumY = 0;
    let totalBrightness = 0;
    let area = 0;
    let maxBrightness = 0;
    let minX = width, maxX = 0, minY = height, maxY = 0;

    while (stack.length > 0) {
      const [x, y] = stack.pop();
      const idx = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited[idx]) continue;
      if (brightness[idx] < threshold) continue;

      visited[idx] = 1;
      
      const b = brightness[idx];
      sumX += x * b;
      sumY += y * b;
      totalBrightness += b;
      area++;
      if (b > maxBrightness) maxBrightness = b;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
    }

    if (area === 0 || totalBrightness === 0) return null;

    return {
      x: sumX / totalBrightness,
      y: sumY / totalBrightness,
      area,
      totalBrightness,
      maxBrightness,
      bbox: { minX, maxX, minY, maxY }
    };
  }

  function findStarCorrespondences(stars1, stars2, options = {}) {
    const {
      maxStars = 100,
      searchRadius = 50,
      minMatches = 10
    } = options;

    const s1 = stars1.slice(0, maxStars);
    const s2 = stars2.slice(0, maxStars);

    const matches = [];

    for (let i = 0; i < s1.length; i++) {
      const star1 = s1[i];
      let bestMatch = null;
      let bestScore = Infinity;

      for (let j = 0; j < s2.length; j++) {
        const star2 = s2[j];
        
        const dx = star2.x - star1.x;
        const dy = star2.y - star1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > searchRadius * 2) continue;

        const brightnessDiff = Math.abs(star1.totalBrightness - star2.totalBrightness) / 
                              Math.max(star1.totalBrightness, star2.totalBrightness);
        const areaDiff = Math.abs(star1.area - star2.area) / 
                        Math.max(star1.area, star2.area);
        
        const score = dist + brightnessDiff * 20 + areaDiff * 15;

        if (score < bestScore) {
          bestScore = score;
          bestMatch = { star1, star2, index1: i, index2: j, score };
        }
      }

      if (bestMatch) {
        matches.push(bestMatch);
      }
    }

    const uniqueMatches = [];
    const usedStars2 = new Set();
    
    matches.sort((a, b) => a.score - b.score);
    
    for (const match of matches) {
      if (!usedStars2.has(match.index2)) {
        usedStars2.add(match.index2);
        uniqueMatches.push(match);
      }
    }

    return uniqueMatches;
  }

  function computeTransform(matches) {
    if (matches.length < 3) {
      return { offsetX: 0, offsetY: 0, rotation: 0, scale: 1, error: Infinity };
    }

    return ransacTransform(matches, 100, 2.0);
  }

  function ransacTransform(matches, iterations = 200, threshold = 2.0) {
    let bestTransform = null;
    let bestInliers = [];
    let bestError = Infinity;

    const n = matches.length;
    if (n < 3) {
      return computeLeastSquaresTransform(matches);
    }

    for (let iter = 0; iter < iterations; iter++) {
      const indices = getRandomIndices(n, 3);
      const sample = indices.map(i => matches[i]);

      const transform = computeLeastSquaresTransform(sample);
      
      const inliers = [];
      let totalError = 0;

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const p1 = { x: match.star1.x, y: match.star1.y };
        const p2 = { x: match.star2.x, y: match.star2.y };
        
        const transformed = applyTransform(p1, transform);
        const error = Math.sqrt(
          Math.pow(transformed.x - p2.x, 2) + 
          Math.pow(transformed.y - p2.y, 2)
        );

        if (error < threshold) {
          inliers.push(match);
          totalError += error;
        }
      }

      if (inliers.length > bestInliers.length) {
        const refinedTransform = computeLeastSquaresTransform(inliers);
        
        let refinedError = 0;
        for (const match of inliers) {
          const p1 = { x: match.star1.x, y: match.star1.y };
          const p2 = { x: match.star2.x, y: match.star2.y };
          const transformed = applyTransform(p1, refinedTransform);
          refinedError += Math.sqrt(
            Math.pow(transformed.x - p2.x, 2) + 
            Math.pow(transformed.y - p2.y, 2)
          );
        }
        refinedError /= inliers.length;

        if (refinedError < bestError) {
          bestError = refinedError;
          bestTransform = refinedTransform;
          bestInliers = inliers;
        }
      }
    }

    if (!bestTransform) {
      return computeLeastSquaresTransform(matches);
    }

    return {
      ...bestTransform,
      inlierCount: bestInliers.length,
      totalMatches: matches.length,
      error: bestError
    };
  }

  function getRandomIndices(n, count) {
    const indices = [];
    const available = [];
    for (let i = 0; i < n; i++) available.push(i);
    
    for (let i = 0; i < count && available.length > 0; i++) {
      const idx = Math.floor(Math.random() * available.length);
      indices.push(available.splice(idx, 1)[0]);
    }
    
    return indices;
  }

  function computeLeastSquaresTransform(matches) {
    if (matches.length < 2) {
      return { offsetX: 0, offsetY: 0, rotation: 0, scale: 1 };
    }

    let meanX1 = 0, meanY1 = 0;
    let meanX2 = 0, meanY2 = 0;

    for (const match of matches) {
      meanX1 += match.star1.x;
      meanY1 += match.star1.y;
      meanX2 += match.star2.x;
      meanY2 += match.star2.y;
    }

    meanX1 /= matches.length;
    meanY1 /= matches.length;
    meanX2 /= matches.length;
    meanY2 /= matches.length;

    let num = 0;
    let den = 0;
    let varX = 0;
    let varY = 0;

    for (const match of matches) {
      const x1 = match.star1.x - meanX1;
      const y1 = match.star1.y - meanY1;
      const x2 = match.star2.x - meanX2;
      const y2 = match.star2.y - meanY2;

      num += x1 * y2 - y1 * x2;
      den += x1 * x2 + y1 * y2;
      varX += x1 * x1 + y1 * y1;
      varY += x2 * x2 + y2 * y2;
    }

    const rotation = Math.atan2(num, den);
    const scale = Math.sqrt(varY / varX) || 1;

    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    
    const offsetX = meanX2 - scale * (cos * meanX1 - sin * meanY1);
    const offsetY = meanY2 - scale * (sin * meanX1 + cos * meanY1);

    return {
      offsetX,
      offsetY,
      rotation,
      scale
    };
  }

  function applyTransform(point, transform) {
    const { offsetX, offsetY, rotation, scale } = transform;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    return {
      x: scale * (cos * point.x - sin * point.y) + offsetX,
      y: scale * (sin * point.x + cos * point.y) + offsetY
    };
  }

  function alignImage(imageData, transform) {
    const width = imageData.width;
    const height = imageData.height;
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    const resultImageData = ctx.createImageData(width, height);
    const resultData = resultImageData.data;
    const srcData = imageData.data;

    const { offsetX, offsetY, rotation, scale } = transform;
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    const invScale = 1 / scale;

    const centerX = width / 2;
    const centerY = height / 2;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dstIdx = (y * width + x) * 4;

        const dx = x - centerX;
        const dy = y - centerY;
        
        const rotatedX = cos * dx - sin * dy;
        const rotatedY = sin * dx + cos * dy;
        
        const srcX = (rotatedX * invScale) + centerX - offsetX;
        const srcY = (rotatedY * invScale) + centerY - offsetY;

        if (srcX < 0 || srcX >= width - 1 || srcY < 0 || srcY >= height - 1) {
          resultData[dstIdx] = 0;
          resultData[dstIdx + 1] = 0;
          resultData[dstIdx + 2] = 0;
          resultData[dstIdx + 3] = 0;
        } else {
          const pixel = bilinearInterpolate(srcData, srcX, srcY, width, height);
          resultData[dstIdx] = pixel.r;
          resultData[dstIdx + 1] = pixel.g;
          resultData[dstIdx + 2] = pixel.b;
          resultData[dstIdx + 3] = pixel.a;
        }
      }
    }

    ctx.putImageData(resultImageData, 0, 0);

    return {
      imageData: resultImageData,
      canvas,
      transform
    };
  }

  function bilinearInterpolate(data, x, y, width, height) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, width - 1);
    const y1 = Math.min(y0 + 1, height - 1);

    const fx = x - x0;
    const fy = y - y0;

    const idx00 = (y0 * width + x0) * 4;
    const idx10 = (y0 * width + x1) * 4;
    const idx01 = (y1 * width + x0) * 4;
    const idx11 = (y1 * width + x1) * 4;

    const r = (1 - fx) * (1 - fy) * data[idx00] + 
              fx * (1 - fy) * data[idx10] + 
              (1 - fx) * fy * data[idx01] + 
              fx * fy * data[idx11];
    
    const g = (1 - fx) * (1 - fy) * data[idx00 + 1] + 
              fx * (1 - fy) * data[idx10 + 1] + 
              (1 - fx) * fy * data[idx01 + 1] + 
              fx * fy * data[idx11 + 1];
    
    const b = (1 - fx) * (1 - fy) * data[idx00 + 2] + 
              fx * (1 - fy) * data[idx10 + 2] + 
              (1 - fx) * fy * data[idx01 + 2] + 
              fx * fy * data[idx11 + 2];
    
    const a = (1 - fx) * (1 - fy) * data[idx00 + 3] + 
              fx * (1 - fy) * data[idx10 + 3] + 
              (1 - fx) * fy * data[idx01 + 3] + 
              fx * fy * data[idx11 + 3];

    return { r, g, b, a };
  }

  function alignImageList(imageDataList, options = {}) {
    const {
      referenceIndex = 0,
      onProgress = null,
      detectionOptions = {}
    } = options;

    if (imageDataList.length < 2) {
      return imageDataList.map(img => ({
        imageData: img,
        transform: { offsetX: 0, offsetY: 0, rotation: 0, scale: 1 }
      }));
    }

    const results = [];
    const reference = imageDataList[referenceIndex];
    
    const refStars = detectStars(reference, detectionOptions);
    
    for (let i = 0; i < imageDataList.length; i++) {
      if (onProgress) {
        onProgress(i, imageDataList.length);
      }

      if (i === referenceIndex) {
        results.push({
          imageData: imageDataList[i],
          transform: { offsetX: 0, offsetY: 0, rotation: 0, scale: 1 },
          stars: refStars,
          matches: [],
          alignError: 0
        });
        continue;
      }

      const img = imageDataList[i];
      const stars = detectStars(img, detectionOptions);
      
      const matches = findStarCorrespondences(refStars, stars, {
        maxStars: 150,
        searchRadius: Math.max(img.width, img.height) * 0.15
      });

      const transform = computeTransform(matches);
      
      const aligned = alignImage(img, transform);

      results.push({
        ...aligned,
        stars,
        matches,
        alignError: transform.error || 0,
        inlierCount: transform.inlierCount || matches.length
      });
    }

    return results;
  }

  function estimateAlignmentQuality(matches, transform) {
    if (matches.length < 3) return { quality: 0, error: Infinity };

    let totalError = 0;
    let inliers = 0;

    for (const match of matches) {
      const p1 = { x: match.star1.x, y: match.star1.y };
      const p2 = { x: match.star2.x, y: match.star2.y };
      const transformed = applyTransform(p1, transform);
      
      const error = Math.sqrt(
        Math.pow(transformed.x - p2.x, 2) + 
        Math.pow(transformed.y - p2.y, 2)
      );
      
      totalError += error;
      if (error < 3) inliers++;
    }

    return {
      quality: inliers / matches.length,
      error: totalError / matches.length,
      matchCount: matches.length,
      inlierCount: inliers
    };
  }

  return {
    detectStars,
    findStarCorrespondences,
    computeTransform,
    applyTransform,
    alignImage,
    alignImageList,
    estimateAlignmentQuality
  };
})();

export default ImageAligner;
