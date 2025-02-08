var tinycolor = require('tinycolor2');

Component({
  properties: {
    image: {
      type: Object,
      value: {},
      observer: function(newVal) {
        if (newVal) {
          var colors = newVal.colors || [];
          if (colors.length === 0) {
            colors = [
              { hex: '#cccccc' },
              { hex: '#dddddd' },
              { hex: '#eeeeee' },
              { hex: '#f5f5f5' }
            ];
          }
          // 确保始终有4个颜色
          while (colors.length < 4) {
            colors.push({ hex: '#cccccc' });
          }
          // 只取前4个颜色
          colors = colors.slice(0, 4);
          this.setData({ sortedColors: colors });
        }
      }
    }
  },

  data: {
    sortedColors: []
  },

  methods: {
    // 将十六进制颜色转换为RGB
    hexToRgb(hex) {
      if (typeof hex !== 'string') {
        console.error('无效的颜色值:', hex);
        return null;
      }

      // 确保hex以#开头
      hex = hex.charAt(0) === '#' ? hex : '#' + hex;

      // 处理简写形式 (#fff => #ffffff)
      if (hex.length === 4) {
        hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
      }

      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    },

    // 计算颜色的饱和度
    calculateSaturation(rgb) {
      const max = Math.max(rgb.r, rgb.g, rgb.b);
      const min = Math.min(rgb.r, rgb.g, rgb.b);
      return max === 0 ? 0 : (max - min) / max;
    },

    // 判断是否为接近白色或灰色的背景色
    isBackgroundColor(hex) {
      const rgb = this.hexToRgb(hex);
      if (!rgb) return true;

      // 计算RGB值的平均值（亮度）和标准差（色彩分布）
      const values = [rgb.r, rgb.g, rgb.b];
      const avg = values.reduce((a, b) => a + b) / 3;
      const variance = values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / 3;
      const stdDev = Math.sqrt(variance);

      // 计算饱和度
      const saturation = this.calculateSaturation(rgb);

      // 判断条件：
      // 1. 过亮（接近白色）
      // 2. 饱和度过低（接近灰色）
      // 3. 标准差过小（颜色分布集中）
      return (
        (avg > 240 && stdDev < 10) || // 接近白色
        (saturation < 0.1) || // 接近灰色
        (avg > 220 && stdDev < 5 && saturation < 0.15) // 浅灰色
      );
    },

    sortColorsByLightness: function(colors) {
      if (!Array.isArray(colors) || colors.length === 0) {
        console.error('颜色数组无效:', colors);
        this.setData({ 
          sortedColors: [{ hex: '#cccccc' }]
        });
        return;
      }

      try {
        var validColors = colors.filter(function(color) {
          return color && color.hex && !this.isBackgroundColor(color.hex);
        }.bind(this));

        if (validColors.length === 0) {
          validColors = [{ hex: '#cccccc' }];
        }

        this.setData({
          sortedColors: validColors.slice(0, 4)
        });
      } catch (error) {
        console.error('颜色排序错误:', error);
        this.setData({ 
          sortedColors: [{ hex: '#cccccc' }]
        });
      }
    },

    // 计算颜色的平均值（用于判断深浅）
    calculateAvgColor(hex) {
      const rgb = this.hexToRgb(hex);
      if (!rgb) return 255;
      return (rgb.r + rgb.g + rgb.b) / 3;
    },

    onTap() {
      const { id } = this.properties.image;
      
      if (!id) {
        console.error('图片ID无效');
        return;
      }

      this.triggerEvent('tap', { id: id });
    },

    onLikeClick() {
      const { id } = this.properties.image;
      // 更新本地状态
      this.setData({
        'image.isLiked': !this.properties.image.isLiked
      });
      this.triggerEvent('like', { id: id });
    },

    onDownloadClick() {
      const { id } = this.properties.image;
      this.triggerEvent('download', { id: id });
    }
  }
}); 