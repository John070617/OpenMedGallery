var tinycolor = require('tinycolor2');

function ColorExtractor() {
    this.canvasId = 'colorCanvas';
  this.GRID_SIZE = 30; // 增加采样密度
  this.COLOR_DISTANCE_THRESHOLD = 15; // 降低相似度阈值，让更多不同的颜色能被区分
  this.SATURATION_THRESHOLD = 0.1; // 饱和度阈值
  this.LIGHTNESS_THRESHOLD_LOW = 0.1; // 最低亮度阈值
  this.LIGHTNESS_THRESHOLD_HIGH = 0.9; // 最高亮度阈值
  // 定义主要色系范围
  this.HUE_RANGES = [
    { name: '红色', start: 345, end: 15, count: 0 },
    { name: '橙黄', start: 15, end: 75, count: 0 },
    { name: '绿色', start: 75, end: 165, count: 0 },
    { name: '青蓝', start: 165, end: 255, count: 0 },
    { name: '紫色', start: 255, end: 345, count: 0 }
  ];
  this.MAX_COLORS_PER_HUE_RANGE = 2; // 每个色系最多2个颜色
}

ColorExtractor.prototype.extractColors = function(imageUrl, colorCount, page) {
  var self = this;
  colorCount = colorCount || 6;
      console.log('开始处理图片:', imageUrl);
      
  return new Promise(function(resolve, reject) {
    if (!page) {
      console.error('未提供page参数');
      resolve(self.getDefaultColors(colorCount));
      return;
    }

    // 使用传入的页面实例创建选择器
    var query = page.createSelectorQuery();
    query.select('#' + self.canvasId)
      .fields({ node: true, size: true })
      .exec(function(res) {
        console.log('Canvas查询结果:', res);
        
        if (!res || !res[0] || !res[0].node) {
          console.error('未找到canvas节点或不支持2D上下文');
          resolve(self.getDefaultColors(colorCount));
          return;
        }

        var canvas = res[0].node;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
          console.error('无法获取2D上下文');
          resolve(self.getDefaultColors(colorCount));
          return;
        }

        var size = 200;
        canvas.width = size;
        canvas.height = size;
        
        var img = canvas.createImage();
        img.onload = function() {
          try {
            ctx.clearRect(0, 0, size, size);
            ctx.drawImage(img, 0, 0, size, size);
            var imageData = ctx.getImageData(0, 0, size, size);
            if (!imageData || !imageData.data) {
              console.error('无法获取图像数据');
              resolve(self.getDefaultColors(colorCount));
              return;
            }

            var sampledColors = self.sampleColors(imageData.data, size);
            var clusters = self.clusterColors(sampledColors);
            var mainColors = self.getMainColors(clusters, colorCount);
            
            var colors = mainColors.map(function(color) {
              return {
                hex: color.toHexString(),
                rgb: color.toRgbString(),
                hsl: color.toHslString(),
                cmyk: self.rgbToCmyk(color.toRgb())
              };
            });

            while (colors.length < colorCount) {
              colors.push(self.getDefaultColors(1)[0]);
            }

            console.log('提取的颜色:', colors);
            resolve(colors);
          } catch (error) {
            console.error('处理图片颜色时出错:', error);
            resolve(self.getDefaultColors(colorCount));
          }
        };
        
        img.onerror = function(error) {
          console.error('图片加载失败:', error);
          resolve(self.getDefaultColors(colorCount));
        };
        
        // 直接使用图片路径
        img.src = imageUrl;
      });
  });
};

ColorExtractor.prototype.getDefaultColors = function(count) {
  var defaultColors = [
    { hex: '#cccccc', rgb: 'rgb(204, 204, 204)', hsl: 'hsl(0, 0%, 80%)', cmyk: { c: 0, m: 0, y: 0, k: 20 } },
    { hex: '#dddddd', rgb: 'rgb(221, 221, 221)', hsl: 'hsl(0, 0%, 87%)', cmyk: { c: 0, m: 0, y: 0, k: 13 } },
    { hex: '#eeeeee', rgb: 'rgb(238, 238, 238)', hsl: 'hsl(0, 0%, 93%)', cmyk: { c: 0, m: 0, y: 0, k: 7 } },
    { hex: '#f5f5f5', rgb: 'rgb(245, 245, 245)', hsl: 'hsl(0, 0%, 96%)', cmyk: { c: 0, m: 0, y: 0, k: 4 } },
    { hex: '#f9f9f9', rgb: 'rgb(249, 249, 249)', hsl: 'hsl(0, 0%, 98%)', cmyk: { c: 0, m: 0, y: 0, k: 2 } },
    { hex: '#ffffff', rgb: 'rgb(255, 255, 255)', hsl: 'hsl(0, 0%, 100%)', cmyk: { c: 0, m: 0, y: 0, k: 0 } }
  ];
  return defaultColors.slice(0, count);
};

ColorExtractor.prototype.sampleColors = function(imageData, size) {
  var colors = [];
  var gridSize = this.GRID_SIZE;
  var halfSize = size / 2;
  
  // 定义四个区域及其权重
  var regions = [
    { name: '左上', x: 0, y: 0, width: halfSize, height: halfSize, weight: 1.0 },
    { name: '右上', x: halfSize, y: 0, width: halfSize, height: halfSize, weight: 1.0 },
    { name: '左下', x: 0, y: halfSize, width: halfSize, height: halfSize, weight: 1.0 },
    { name: '右下', x: halfSize, y: halfSize, width: halfSize, height: halfSize, weight: 1.0 }
  ];
  
  // 对每个区域进行采样
  for (var r = 0; r < regions.length; r++) {
    var region = regions[r];
    var step = Math.floor(region.width / gridSize);
    var colorCounts = new Map(); // 记录每个颜色在区域中的出现次数
    
    for (var y = Math.floor(region.y); y < Math.floor(region.y + region.height); y += step) {
      for (var x = Math.floor(region.x); x < Math.floor(region.x + region.width); x += step) {
        var pixelIndex = (y * size + x) * 4;
        
        // 确保不越界
        if (pixelIndex + 2 >= imageData.length) continue;
        
        var color = tinycolor({
          r: imageData[pixelIndex],
          g: imageData[pixelIndex + 1],
          b: imageData[pixelIndex + 2]
        });
        
        var hsl = color.toHsl();
        
        if (this.isValidColor(hsl)) {
          var colorKey = this.getColorKey(color);
          var count = (colorCounts.get(colorKey) || 0) + 1;
          colorCounts.set(colorKey, count);
        }
      }
    }

    // 处理区域内的颜色统计
    colorCounts.forEach(function(count, colorKey) {
      var color = tinycolor(colorKey);
      var hsl = color.toHsl();
      var coverage = count / (gridSize * gridSize); // 颜色覆盖率
      
      // 计算颜色的重要性得分
      var importance = this.calculateColorImportance(hsl, coverage, region);
      
      colors.push({
        color: color,
        hsl: hsl,
        coverage: coverage,
        importance: importance,
        region: region.name,
        weight: coverage * region.weight,
        saliencyScore: importance
      });
    }.bind(this));
  }
  
  return colors;
};

ColorExtractor.prototype.isValidColor = function(hsl) {
  // 放宽饱和度和亮度的限制
  return hsl.s >= 0.1 && // 降低饱和度阈值
         hsl.l >= 0.1 && // 降低最低亮度阈值
         hsl.l <= 0.9;   // 提高最高亮度阈值
};

ColorExtractor.prototype.getColorKey = function(color) {
  // 将颜色量化，减少相似颜色的数量
  var rgb = color.toRgb();
  var quantize = function(value) { return Math.round(value / 8) * 8; };
  return 'rgb(' + quantize(rgb.r) + ',' + quantize(rgb.g) + ',' + quantize(rgb.b) + ')';
};

ColorExtractor.prototype.calculateColorImportance = function(hsl, coverage, region) {
  var coverageWeight = 0.6;    // 增加覆盖率权重
  var saturationWeight = 0.3;  // 降低饱和度权重
  var contrastWeight = 0.1;    // 进一步降低对比度权重

  // 覆盖率得分（使用非线性映射增强差异）
  var coverageScore = Math.pow(coverage, 0.7);
  
  // 饱和度得分
  var saturationScore = hsl.s;
  
  // 对比度得分（与中性灰的对比）
  var contrastScore = Math.abs(hsl.l - 0.5);

  return (coverageScore * coverageWeight +
          saturationScore * saturationWeight +
          contrastScore * contrastWeight) * region.weight;
};

ColorExtractor.prototype.clusterColors = function(sampledColors) {
  // 按色系分组
  var hueRangeClusters = {};
  this.HUE_RANGES.forEach(function(range) {
    hueRangeClusters[range.name] = [];
  });
  
  // 将颜色按色系分组
  sampledColors.forEach(function(sample) {
    var hueRange = this.getColorHueRange(sample.hsl.h);
    if (hueRange) {
      hueRangeClusters[hueRange.name].push(sample);
    }
  }.bind(this));
  
  var allClusters = [];
  
  // 对每个色系分别处理
  Object.keys(hueRangeClusters).forEach(function(rangeName) {
    var colors = hueRangeClusters[rangeName];
    if (colors.length === 0) return;
    
    // 在每个色系内进行聚类
    var clusters = [];
    colors.forEach(function(sample) {
      var foundCluster = false;
      
      for (var i = 0; i < clusters.length; i++) {
        var cluster = clusters[i];
        if (this.areColorsSimilar(sample.color, cluster.color)) {
          // 更新聚类，累加覆盖率
          cluster.coverage += sample.coverage;
          cluster.weight += sample.weight;
          cluster.count++;
          
          // 更新聚类中心（加权平均）
          var ratio = sample.coverage / cluster.coverage;
          cluster.hsl.h = (1 - ratio) * cluster.hsl.h + ratio * sample.hsl.h;
          cluster.hsl.s = (1 - ratio) * cluster.hsl.s + ratio * sample.hsl.s;
          cluster.hsl.l = (1 - ratio) * cluster.hsl.l + ratio * sample.hsl.l;
          cluster.color = tinycolor(cluster.hsl);
          
          foundCluster = true;
          break;
        }
      }
      
      if (!foundCluster) {
        clusters.push({
          color: sample.color,
          hsl: sample.hsl,
          coverage: sample.coverage,
          weight: sample.weight,
          count: 1,
          importance: sample.importance
        });
      }
    }.bind(this));
    
    // 按覆盖率排序，选择前两个最主要的颜色
    clusters.sort(function(a, b) {
      return b.coverage - a.coverage;
    });
    
    // 将该色系最主要的颜色添加到结果中
    allClusters.push.apply(allClusters, clusters.slice(0, this.MAX_COLORS_PER_HUE_RANGE));
  }.bind(this));
  
  return allClusters;
};

ColorExtractor.prototype.areColorsSimilar = function(color1, color2) {
  var lab1 = this.rgbToLab(color1.toRgb());
  var lab2 = this.rgbToLab(color2.toRgb());
  
  return this.calculateDeltaE(lab1, lab2) < this.COLOR_DISTANCE_THRESHOLD;
};

ColorExtractor.prototype.rgbToLab = function(rgb) {
  // RGB到XYZ的转换
  var r = rgb.r / 255;
  var g = rgb.g / 255;
  var b = rgb.b / 255;
  
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
  
  var x = (r * 0.4124 + g * 0.3576 + b * 0.1805) * 100;
  var y = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 100;
  var z = (r * 0.0193 + g * 0.1192 + b * 0.9505) * 100;
  
  // XYZ到Lab的转换
  var xn = 95.047;
  var yn = 100.000;
  var zn = 108.883;
  
  var fx = x / xn > 0.008856 ? Math.pow(x / xn, 1/3) : (7.787 * x / xn) + 16/116;
  var fy = y / yn > 0.008856 ? Math.pow(y / yn, 1/3) : (7.787 * y / yn) + 16/116;
  var fz = z / zn > 0.008856 ? Math.pow(z / zn, 1/3) : (7.787 * z / zn) + 16/116;
  
  return {
    L: (116 * fy) - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  };
};

ColorExtractor.prototype.calculateDeltaE = function(lab1, lab2) {
  var deltaL = lab1.L - lab2.L;
  var deltaA = lab1.a - lab2.a;
  var deltaB = lab1.b - lab2.b;
  
  return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
};

ColorExtractor.prototype.getColorHueRange = function(hue) {
  // 处理色相环的循环性
  var normalizedHue = hue < 0 ? hue + 360 : hue;
  for (var i = 0; i < this.HUE_RANGES.length; i++) {
    var range = this.HUE_RANGES[i];
    if (range.start > range.end) { // 处理跨越0度的情况（如红色）
      if (normalizedHue >= range.start || normalizedHue <= range.end) {
        return range;
      }
    } else if (normalizedHue >= range.start && normalizedHue <= range.end) {
      return range;
    }
  }
};

ColorExtractor.prototype.getMainColors = function(clusters, count) {
  // 按覆盖率和重要性的综合得分排序
  clusters.sort(function(a, b) {
    var scoreA = a.coverage * 0.7 + a.importance * 0.3;
    var scoreB = b.coverage * 0.7 + b.importance * 0.3;
    return scoreB - scoreA;
  });

  var selectedClusters = clusters.slice(0, count);

  // 按色相排序展示
  selectedClusters.sort(function(a, b) {
    var hueA = a.hsl.h;
    var hueB = b.hsl.h;
    if (Math.abs(hueA - hueB) < 30) {
      // 同色系内按覆盖率排序
      return b.coverage - a.coverage;
    }
    return hueA - hueB;
  });

  return selectedClusters.map(function(cluster) { return cluster.color; });
};

ColorExtractor.prototype.isDistinctFromSelected = function(cluster, selectedClusters) {
  if (selectedClusters.length === 0) return true;

  for (var i = 0; i < selectedClusters.length; i++) {
    var selected = selectedClusters[i];
    // 检查色相差异
    var hueDiff = Math.abs(cluster.hsl.h - selected.hsl.h);
    var hueDiffNormalized = hueDiff > 180 ? 360 - hueDiff : hueDiff;

    // 检查Lab空间差异
    var deltaE = this.calculateDeltaE(
      this.rgbToLab(cluster.color.toRgb()),
      this.rgbToLab(selected.color.toRgb())
    );

    // 如果颜色太相似，返回false
    if (hueDiffNormalized < 20 && deltaE < this.COLOR_DISTANCE_THRESHOLD) {
      return false;
    }
  }

  return true;
};

ColorExtractor.prototype.rgbToCmyk = function(rgb) {
  var c = 1 - (rgb.r / 255);
  var m = 1 - (rgb.g / 255);
  var y = 1 - (rgb.b / 255);
  var k = Math.min(c, m, y);
    
    if (k === 1) {
      return { c: 0, m: 0, y: 0, k: 1 };
    }
    
    c = (c - k) / (1 - k);
    m = (m - k) / (1 - k);
    y = (y - k) / (1 - k);
    
    return {
      c: Math.round(c * 100),
      m: Math.round(m * 100),
      y: Math.round(y * 100),
      k: Math.round(k * 100)
    };
};

var colorExtractor = new ColorExtractor();
module.exports = colorExtractor; 