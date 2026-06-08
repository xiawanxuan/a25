// 交互预览模块 - Canvas渲染、鼠标/触屏交互
const Previewer = (() => {
  class ImagePreviewer {
    constructor(canvas, placeholder = null) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.placeholder = placeholder;
      
      this.image = null;
      this.imageCanvas = null;
      this.originalImage = null;
      
      this.scale = 1;
      this.offsetX = 0;
      this.offsetY = 0;
      
      this.isDragging = false;
      this.lastX = 0;
      this.lastY = 0;
      
      this.isComparing = false;
      this.comparePosition = 0.5;
      this.isDraggingCompare = false;
      
      this.minScale = 0.1;
      this.maxScale = 10;
      
      this._initEvents();
      this._render();
    }
    
    setImage(imageCanvas) {
      this.imageCanvas = imageCanvas;
      this.image = imageCanvas;
      
      if (this.placeholder) {
        this.placeholder.style.display = 'none';
      }
      
      this.fitToScreen();
      this._render();
    }
    
    setOriginalImage(imageCanvas) {
      this.originalImage = imageCanvas;
    }
    
    clear() {
      this.image = null;
      this.imageCanvas = null;
      this.originalImage = null;
      this.scale = 1;
      this.offsetX = 0;
      this.offsetY = 0;
      
      if (this.placeholder) {
        this.placeholder.style.display = 'block';
      }
      
      this._render();
    }
    
    fitToScreen() {
      if (!this.imageCanvas) return;
      
      const wrapper = this.canvas.parentElement;
      const wrapperWidth = wrapper.clientWidth;
      const wrapperHeight = wrapper.clientHeight;
      
      const imgWidth = this.imageCanvas.width;
      const imgHeight = this.imageCanvas.height;
      
      const scaleX = (wrapperWidth - 40) / imgWidth;
      const scaleY = (wrapperHeight - 40) / imgHeight;
      
      this.scale = Math.min(scaleX, scaleY, 1);
      this.offsetX = 0;
      this.offsetY = 0;
      
      this._updateCanvasSize();
    }
    
    zoomIn(factor = 1.2, centerX = null, centerY = null) {
      if (!this.imageCanvas) return;
      
      const oldScale = this.scale;
      this.scale = Math.min(this.scale * factor, this.maxScale);
      
      if (centerX !== null && centerY !== null) {
        const rect = this.canvas.getBoundingClientRect();
        const cx = centerX - rect.left;
        const cy = centerY - rect.top;
        
        const imgX = (cx - this.canvas.width / 2 - this.offsetX) / oldScale;
        const imgY = (cy - this.canvas.height / 2 - this.offsetY) / oldScale;
        
        const newImgX = imgX * this.scale;
        const newImgY = imgY * this.scale;
        
        this.offsetX = cx - this.canvas.width / 2 - newImgX;
        this.offsetY = cy - this.canvas.height / 2 - newImgY;
      }
      
      this._render();
      return this.scale;
    }
    
    zoomOut(factor = 1.2, centerX = null, centerY = null) {
      if (!this.imageCanvas) return;
      
      const oldScale = this.scale;
      this.scale = Math.max(this.scale / factor, this.minScale);
      
      if (centerX !== null && centerY !== null) {
        const rect = this.canvas.getBoundingClientRect();
        const cx = centerX - rect.left;
        const cy = centerY - rect.top;
        
        const imgX = (cx - this.canvas.width / 2 - this.offsetX) / oldScale;
        const imgY = (cy - this.canvas.height / 2 - this.offsetY) / oldScale;
        
        const newImgX = imgX * this.scale;
        const newImgY = imgY * this.scale;
        
        this.offsetX = cx - this.canvas.width / 2 - newImgX;
        this.offsetY = cy - this.canvas.height / 2 - newImgY;
      }
      
      this._render();
      return this.scale;
    }
    
    resetZoom() {
      this.fitToScreen();
      return this.scale;
    }
    
    toggleCompare() {
      this.isComparing = !this.isComparing;
      this.comparePosition = 0.5;
      this._render();
      return this.isComparing;
    }
    
    setComparePosition(position) {
      this.comparePosition = Math.max(0, Math.min(1, position));
      this._render();
    }
    
    getZoomPercent() {
      return Math.round(this.scale * 100);
    }
    
    _initEvents() {
      this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
      window.addEventListener('mousemove', (e) => this._onMouseMove(e));
      window.addEventListener('mouseup', (e) => this._onMouseUp(e));
      
      this.canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
      
      this.canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
      this.canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
      this.canvas.addEventListener('touchend', (e) => this._onTouchEnd(e));
      
      window.addEventListener('resize', () => {
        this._updateCanvasSize();
        this._render();
      });
      
      setTimeout(() => {
        this._updateCanvasSize();
        this._render();
      }, 100);
    }
    
    _onMouseDown(e) {
      if (this.isComparing && this._isOnCompareDivider(e.clientX, e.clientY)) {
        this.isDraggingCompare = true;
        return;
      }
      
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.canvas.style.cursor = 'grabbing';
    }
    
    _onMouseMove(e) {
      if (this.isComparing && this._isOnCompareDivider(e.clientX, e.clientY)) {
        this.canvas.style.cursor = 'ew-resize';
      } else if (!this.isDragging) {
        this.canvas.style.cursor = 'grab';
      }
      
      if (this.isDraggingCompare) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        this.setComparePosition(x / this.canvas.width);
        return;
      }
      
      if (this.isDragging) {
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        
        this.offsetX += dx;
        this.offsetY += dy;
        
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        
        this._render();
      }
    }
    
    _onMouseUp(e) {
      this.isDragging = false;
      this.isDraggingCompare = false;
      this.canvas.style.cursor = 'grab';
    }
    
    _onWheel(e) {
      if (!this.imageCanvas) return;
      
      e.preventDefault();
      
      const delta = e.deltaY > 0 ? 1.1 : 0.9;
      
      if (delta > 1) {
        this.zoomOut(delta, e.clientX, e.clientY);
      } else {
        this.zoomIn(1 / delta, e.clientX, e.clientY);
      }
    }
    
    _onTouchStart(e) {
      e.preventDefault();
      
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastX = e.touches[0].clientX;
        this.lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        this._pinchStartDistance = this._getPinchDistance(e.touches);
        this._pinchStartScale = this.scale;
      }
    }
    
    _onTouchMove(e) {
      e.preventDefault();
      
      if (e.touches.length === 1 && this.isDragging) {
        const dx = e.touches[0].clientX - this.lastX;
        const dy = e.touches[0].clientY - this.lastY;
        
        this.offsetX += dx;
        this.offsetY += dy;
        
        this.lastX = e.touches[0].clientX;
        this.lastY = e.touches[0].clientY;
        
        this._render();
      } else if (e.touches.length === 2) {
        const distance = this._getPinchDistance(e.touches);
        const scale = distance / this._pinchStartDistance;
        
        const newScale = Math.max(this.minScale, Math.min(this.maxScale, this._pinchStartScale * scale));
        this.scale = newScale;
        
        this._render();
      }
    }
    
    _onTouchEnd(e) {
      this.isDragging = false;
      this._pinchStartDistance = 0;
    }
    
    _getPinchDistance(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
    
    _isOnCompareDivider(clientX, clientY) {
      if (!this.isComparing || !this.imageCanvas) return false;
      
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const dividerX = this.canvas.width * this.comparePosition;
      
      return Math.abs(x - dividerX) < 10;
    }
    
    _updateCanvasSize() {
      const wrapper = this.canvas.parentElement;
      const dpr = window.devicePixelRatio || 1;
      
      this.canvas.width = wrapper.clientWidth * dpr;
      this.canvas.height = wrapper.clientHeight * dpr;
      this.canvas.style.width = wrapper.clientWidth + 'px';
      this.canvas.style.height = wrapper.clientHeight + 'px';
      
      this.ctx.scale(dpr, dpr);
    }
    
    _render() {
      const width = this.canvas.width / (window.devicePixelRatio || 1);
      const height = this.canvas.height / (window.devicePixelRatio || 1);
      
      this.ctx.save();
      this.ctx.clearRect(0, 0, width, height);
      
      this.ctx.fillStyle = '#050508';
      this.ctx.fillRect(0, 0, width, height);
      
      if (this.imageCanvas) {
        const imgWidth = this.imageCanvas.width * this.scale;
        const imgHeight = this.imageCanvas.height * this.scale;
        const x = width / 2 + this.offsetX - imgWidth / 2;
        const y = height / 2 + this.offsetY - imgHeight / 2;
        
        if (this.isComparing && this.originalImage) {
          const dividerX = width * this.comparePosition;
          
          this.ctx.save();
          this.ctx.beginPath();
          this.ctx.rect(0, 0, dividerX, height);
          this.ctx.clip();
          this.ctx.drawImage(this.originalImage, x, y, imgWidth, imgHeight);
          this.ctx.restore();
          
          this.ctx.save();
          this.ctx.beginPath();
          this.ctx.rect(dividerX, 0, width - dividerX, height);
          this.ctx.clip();
          this.ctx.drawImage(this.imageCanvas, x, y, imgWidth, imgHeight);
          this.ctx.restore();
          
          this.ctx.strokeStyle = '#64b5f6';
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.moveTo(dividerX, 0);
          this.ctx.lineTo(dividerX, height);
          this.ctx.stroke();
          
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          this.ctx.fillRect(10, 10, 80, 24);
          this.ctx.fillStyle = '#fff';
          this.ctx.font = '12px sans-serif';
          this.ctx.fillText('原图', 25, 26);
          
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          this.ctx.fillRect(width - 90, 10, 80, 24);
          this.ctx.fillStyle = '#fff';
          this.ctx.fillText('处理后', width - 80, 26);
        } else {
          this.ctx.drawImage(this.imageCanvas, x, y, imgWidth, imgHeight);
        }
      }
      
      this.ctx.restore();
    }
  }
  
  function createPreviewer(canvas, placeholder = null) {
    return new ImagePreviewer(canvas, placeholder);
  }
  
  return {
    ImagePreviewer,
    createPreviewer
  };
})();

export default Previewer;
