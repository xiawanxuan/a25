// 主控制器 - 整合所有模块
import ImageParser from './imageParser.js';
import StarStacker from './starStacker.js';
import ImageProcessor from './imageProcessor.js';
import Previewer from './previewer.js';

class StarTrailApp {
  constructor() {
    this.images = [];
    this.resultCanvas = null;
    this.resultImageData = null;
    this.originalResult = null;
    
    this.adjustments = {
      brightness: 0,
      contrast: 0,
      saturation: 0
    };
    
    this.separation = {
      threshold: 30,
      foregroundIntensity: 100,
      backgroundIntensity: 100,
      applied: false,
      starLayer: null,
      bgLayer: null
    };
    
    this.isProcessing = false;
    
    this._initElements();
    this._initPreviewer();
    this._bindEvents();
    this._updateStatus('就绪');
  }
  
  _initElements() {
    this.uploadArea = document.getElementById('uploadArea');
    this.fileInput = document.getElementById('fileInput');
    this.fileList = document.getElementById('fileList');
    
    this.blendMode = document.getElementById('blendMode');
    this.intensity = document.getElementById('intensity');
    this.intensityValue = document.getElementById('intensityValue');
    this.stackBtn = document.getElementById('stackBtn');
    
    this.brightness = document.getElementById('brightness');
    this.brightnessValue = document.getElementById('brightnessValue');
    this.contrast = document.getElementById('contrast');
    this.contrastValue = document.getElementById('contrastValue');
    this.saturation = document.getElementById('saturation');
    this.saturationValue = document.getElementById('saturationValue');
    
    this.threshold = document.getElementById('threshold');
    this.thresholdValue = document.getElementById('thresholdValue');
    this.foregroundIntensity = document.getElementById('foregroundIntensity');
    this.foregroundValue = document.getElementById('foregroundValue');
    this.backgroundIntensity = document.getElementById('backgroundIntensity');
    this.backgroundValue = document.getElementById('backgroundValue');
    this.applySeparationBtn = document.getElementById('applySeparation');
    
    this.exportFormat = document.getElementById('exportFormat');
    this.exportQuality = document.getElementById('exportQuality');
    this.qualityValue = document.getElementById('qualityValue');
    this.exportBtn = document.getElementById('exportBtn');
    
    this.zoomIn = document.getElementById('zoomIn');
    this.zoomOut = document.getElementById('zoomOut');
    this.zoomReset = document.getElementById('zoomReset');
    this.toggleCompare = document.getElementById('toggleCompare');
    this.zoomInfo = document.getElementById('zoomInfo');
    
    this.statusText = document.getElementById('statusText');
    this.imageInfo = document.getElementById('imageInfo');
    
    this.previewCanvas = document.getElementById('previewCanvas');
    this.canvasPlaceholder = document.getElementById('canvasPlaceholder');
  }
  
  _initPreviewer() {
    this.previewer = Previewer.createPreviewer(this.previewCanvas, this.canvasPlaceholder);
  }
  
  _bindEvents() {
    this.uploadArea.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this._handleFiles(e.target.files));
    
    this.uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.uploadArea.classList.add('dragover');
    });
    
    this.uploadArea.addEventListener('dragleave', () => {
      this.uploadArea.classList.remove('dragover');
    });
    
    this.uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      this.uploadArea.classList.remove('dragover');
      this._handleFiles(e.dataTransfer.files);
    });
    
    this.intensity.addEventListener('input', () => {
      this.intensityValue.textContent = this.intensity.value;
    });
    
    this.stackBtn.addEventListener('click', () => this._stackImages());
    
    this.brightness.addEventListener('input', () => {
      this.brightnessValue.textContent = this.brightness.value;
      this._applyAdjustments();
    });
    
    this.contrast.addEventListener('input', () => {
      this.contrastValue.textContent = this.contrast.value;
      this._applyAdjustments();
    });
    
    this.saturation.addEventListener('input', () => {
      this.saturationValue.textContent = this.saturation.value;
      this._applyAdjustments();
    });
    
    this.threshold.addEventListener('input', () => {
      this.thresholdValue.textContent = this.threshold.value;
    });
    
    this.foregroundIntensity.addEventListener('input', () => {
      this.foregroundValue.textContent = this.foregroundIntensity.value;
      if (this.separation.applied) {
        this._applySeparationBlend();
      }
    });
    
    this.backgroundIntensity.addEventListener('input', () => {
      this.backgroundValue.textContent = this.backgroundIntensity.value;
      if (this.separation.applied) {
        this._applySeparationBlend();
      }
    });
    
    this.applySeparationBtn.addEventListener('click', () => this._toggleSeparation());
    
    this.exportQuality.addEventListener('input', () => {
      this.qualityValue.textContent = this.exportQuality.value;
    });
    
    this.exportBtn.addEventListener('click', () => this._exportResult());
    
    this.zoomIn.addEventListener('click', () => {
      const scale = this.previewer.zoomIn(1.2);
      this.zoomInfo.textContent = Math.round(scale * 100) + '%';
    });
    
    this.zoomOut.addEventListener('click', () => {
      const scale = this.previewer.zoomOut(1.2);
      this.zoomInfo.textContent = Math.round(scale * 100) + '%';
    });
    
    this.zoomReset.addEventListener('click', () => {
      this.previewer.resetZoom();
      this.zoomInfo.textContent = '100%';
    });
    
    this.toggleCompare.addEventListener('click', () => {
      const isComparing = this.previewer.toggleCompare();
      this.toggleCompare.style.background = isComparing ? '#2a2a4a' : '';
    });
  }
  
  async _handleFiles(fileList) {
    const files = Array.from(fileList);
    
    if (files.length === 0) return;
    
    this._updateStatus(`正在导入 ${files.length} 张照片...`);
    this._showLoading();
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const parsed = await ImageParser.parseFile(file);
          this.images.push(parsed);
          this._updateFileList();
          this._updateStatus(`已导入 ${this.images.length}/${files.length} 张照片`);
        } catch (err) {
          console.error('文件解析失败:', file.name, err);
          this._updateStatus(`跳过无法解析的文件: ${file.name}`);
        }
      }
      
      if (this.images.length > 0) {
        this.stackBtn.disabled = false;
        
        const firstImage = this.images[0];
        this.previewer.setImage(firstImage.canvas);
        this._updateImageInfo(firstImage.width, firstImage.height, this.images.length);
        
        this._updateStatus(`成功导入 ${this.images.length} 张照片`);
      } else {
        this._updateStatus('没有成功导入的照片');
      }
    } catch (err) {
      console.error('导入失败:', err);
      this._updateStatus('导入失败: ' + err.message);
    } finally {
      this._hideLoading();
    }
  }
  
  _updateFileList() {
    if (this.images.length === 0) {
      this.fileList.innerHTML = '<p class="empty-hint">暂无导入的照片</p>';
      return;
    }
    
    this.fileList.innerHTML = '';
    
    this.images.forEach((img, index) => {
      const item = document.createElement('div');
      item.className = 'file-item';
      
      const thumb = ImageParser.createThumbnail(img.imageData, 48);
      thumb.className = 'file-thumb';
      
      const info = document.createElement('div');
      info.className = 'file-info';
      info.innerHTML = `
        <div class="file-name">${img.name}</div>
        <div class="file-size">${img.width}x${img.height} · ${ImageParser.formatFileSize(img.fileSize)}</div>
      `;
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = '×';
      removeBtn.title = '移除';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._removeImage(index);
      });
      
      item.appendChild(thumb);
      item.appendChild(info);
      item.appendChild(removeBtn);
      
      this.fileList.appendChild(item);
    });
  }
  
  _removeImage(index) {
    this.images.splice(index, 1);
    this._updateFileList();
    
    if (this.images.length === 0) {
      this.stackBtn.disabled = true;
      this.exportBtn.disabled = true;
      this.applySeparationBtn.disabled = true;
      this.resultCanvas = null;
      this.resultImageData = null;
      this.previewer.clear();
      this._updateImageInfo(0, 0, 0);
    }
    
    this._updateStatus(`剩余 ${this.images.length} 张照片`);
  }
  
  async _stackImages() {
    if (this.images.length < 2) {
      this._updateStatus('至少需要2张照片才能合成');
      return;
    }
    
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.stackBtn.disabled = true;
    this._updateStatus('正在合成星轨...');
    this._showLoading();
    
    try {
      const imageDataList = this.images.map(img => 
        ImageProcessor.cloneImageData(img.imageData)
      );
      
      const options = {
        mode: this.blendMode.value,
        intensity: parseInt(this.intensity.value)
      };
      
      await this._delay(50);
      
      const result = StarStacker.stackImages(imageDataList, options);
      
      this.resultCanvas = result.canvas;
      this.resultImageData = result.imageData;
      this.originalResult = ImageProcessor.cloneImageData(result.imageData);
      
      this.separation.applied = false;
      this.separation.starLayer = null;
      this.separation.bgLayer = null;
      
      this.brightness.value = 0;
      this.contrast.value = 0;
      this.saturation.value = 0;
      this.brightnessValue.textContent = '0';
      this.contrastValue.textContent = '0';
      this.saturationValue.textContent = '0';
      
      this.previewer.setImage(this.resultCanvas);
      this.previewer.setOriginalImage(this.images[0].canvas);
      
      this.exportBtn.disabled = false;
      this.applySeparationBtn.disabled = false;
      
      this._updateImageInfo(result.width, result.height, this.images.length);
      this._updateStatus('星轨合成完成！');
    } catch (err) {
      console.error('合成失败:', err);
      this._updateStatus('合成失败: ' + err.message);
    } finally {
      this.isProcessing = false;
      this.stackBtn.disabled = false;
      this._hideLoading();
    }
  }
  
  _applyAdjustments() {
    if (!this.resultCanvas || !this.originalResult) return;
    
    this.adjustments.brightness = parseInt(this.brightness.value);
    this.adjustments.contrast = parseInt(this.contrast.value);
    this.adjustments.saturation = parseInt(this.saturation.value);
    
    const imageData = ImageProcessor.cloneImageData(
      this.separation.applied ? this._getSeparationResult() : this.originalResult
    );
    
    ImageProcessor.adjustAll(imageData, this.adjustments);
    
    const ctx = this.resultCanvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    
    this.resultImageData = imageData;
    this.previewer.setImage(this.resultCanvas);
  }
  
  _toggleSeparation() {
    if (!this.resultCanvas || !this.originalResult) return;
    
    if (this.separation.applied) {
      this.separation.applied = false;
      this.applySeparationBtn.textContent = '应用分离';
      
      const imageData = ImageProcessor.cloneImageData(this.originalResult);
      ImageProcessor.adjustAll(imageData, this.adjustments);
      
      const ctx = this.resultCanvas.getContext('2d');
      ctx.putImageData(imageData, 0, 0);
      this.resultImageData = imageData;
      this.previewer.setImage(this.resultCanvas);
      
      this._updateStatus('已取消前景/背景分离');
    } else {
      this._applySeparation();
    }
  }
  
  _applySeparation() {
    if (!this.originalResult) return;
    
    const threshold = parseInt(this.threshold.value);
    const result = ImageProcessor.separateStarsAndBackground(
      ImageProcessor.cloneImageData(this.originalResult),
      threshold
    );
    
    this.separation.starLayer = result.stars.imageData;
    this.separation.bgLayer = result.background.imageData;
    this.separation.applied = true;
    
    this.applySeparationBtn.textContent = '取消分离';
    
    this._applySeparationBlend();
    
    this._updateStatus('已应用前景/背景分离');
  }
  
  _applySeparationBlend() {
    if (!this.separation.applied) return;
    
    const starIntensity = parseInt(this.foregroundIntensity.value) / 100;
    const bgIntensity = parseInt(this.backgroundIntensity.value) / 100;
    
    const result = ImageProcessor.blendStarBackground(
      this.separation.starLayer,
      this.separation.bgLayer,
      starIntensity,
      bgIntensity
    );
    
    const imageData = result.imageData;
    ImageProcessor.adjustAll(imageData, this.adjustments);
    
    const ctx = this.resultCanvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    this.resultImageData = imageData;
    this.previewer.setImage(this.resultCanvas);
  }
  
  _getSeparationResult() {
    const starIntensity = parseInt(this.foregroundIntensity.value) / 100;
    const bgIntensity = parseInt(this.backgroundIntensity.value) / 100;
    
    const result = ImageProcessor.blendStarBackground(
      this.separation.starLayer,
      this.separation.bgLayer,
      starIntensity,
      bgIntensity
    );
    
    return result.imageData;
  }
  
  _exportResult() {
    if (!this.resultCanvas) return;
    
    const format = this.exportFormat.value;
    const quality = parseInt(this.exportQuality.value) / 100;
    
    const dataUrl = ImageProcessor.exportCanvas(this.resultCanvas, format, quality);
    
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const filename = `star-trail-${Date.now()}.${ext}`;
    
    ImageProcessor.downloadImage(dataUrl, filename);
    
    this._updateStatus(`已导出: ${filename}`);
  }
  
  _updateStatus(text) {
    this.statusText.textContent = text;
  }
  
  _updateImageInfo(width, height, count) {
    if (width && height) {
      this.imageInfo.textContent = `${width} × ${height} 像素  ·  ${count} 张照片`;
    } else {
      this.imageInfo.textContent = '';
    }
  }
  
  _showLoading() {
    const existing = document.querySelector('.loading-overlay');
    if (existing) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="spinner"></div>
      <div class="loading-text">处理中...</div>
    `;
    
    const container = document.querySelector('.canvas-wrapper');
    if (container) {
      container.style.position = 'relative';
      container.appendChild(overlay);
    }
  }
  
  _hideLoading() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
      overlay.remove();
    }
  }
  
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new StarTrailApp();
});
