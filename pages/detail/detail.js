import StatisticsManager from '../../utils/statistics-manager';
import ImageManager from '../../utils/image-manager';

Page({
  data: {
    image: null
  },

  // 计算颜色的饱和度
  calculateSaturation(rgb) {
    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    return max === 0 ? 0 : (max - min) / max;
  },

  // 将十六进制颜色转换为RGB
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return null;
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    };
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

  // 处理颜色数据
  processColors(colors) {
    // 过滤掉背景色和重复色
    const uniqueColors = new Map();
    colors.forEach(color => {
      if (color && color.hex && !this.isBackgroundColor(color.hex)) {
        const rgb = this.hexToRgb(color.hex);
        // 使用RGB值的近似值作为key，合并相似颜色
        const key = `${Math.round(rgb.r/10)},${Math.round(rgb.g/10)},${Math.round(rgb.b/10)}`;
        if (!uniqueColors.has(key)) {
          uniqueColors.set(key, color);
        }
      }
    });

    const validColors = Array.from(uniqueColors.values());

    if (validColors.length === 0) {
      // 如果没有有效颜色，返回原始颜色中最深的几个
      return colors.filter(color => color && color.hex)
        .sort((a, b) => {
          const avgA = this.calculateAvgColor(a.hex);
          const avgB = this.calculateAvgColor(b.hex);
          return avgA - avgB; // 按颜色深浅排序
        })
        .slice(0, 6); // 取最深的6个颜色
    }

    // 按照颜色特征值排序
    return validColors.sort((a, b) => {
      const rgbA = this.hexToRgb(a.hex);
      const rgbB = this.hexToRgb(b.hex);
      const satA = this.calculateSaturation(rgbA);
      const satB = this.calculateSaturation(rgbB);
      const avgA = (rgbA.r + rgbA.g + rgbA.b) / 3;
      const avgB = (rgbB.r + rgbB.g + rgbB.b) / 3;
      // 优先考虑饱和度高的颜色，其次考虑深色
      return (satB * 255 - avgB) - (satA * 255 - avgA);
    });
  },

  // 计算颜色的平均值（用于判断深浅）
  calculateAvgColor(hex) {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return 255;
    return (rgb.r + rgb.g + rgb.b) / 3;
  },

  onLoad: function(options) {
    try {
      console.log('接收到的颜色数据:', options.colors);
      var decodedKeywords = JSON.parse(decodeURIComponent(options.keywords || '[]'));
      var decodedColors = JSON.parse(decodeURIComponent(options.colors || '[]'));
      console.log('解码后的颜色数据:', decodedColors);
      
      // 确保颜色数据有效
      if (!Array.isArray(decodedColors) || decodedColors.length === 0) {
        var colorExtractor = require('../../utils/color-extractor');
        decodedColors = colorExtractor.getDefaultColors(6);
      }

      // 处理颜色数据格式
      decodedColors = decodedColors.map(function(color) {
        if (typeof color === 'string') {
          return {
            hex: color,
            rgb: 'rgb(0, 0, 0)',
            hsl: 'hsl(0, 0%, 0%)',
            cmyk: { c: 0, m: 0, y: 0, k: 100 }
          };
        }
        return color;
      });

      // 确保始终有6个颜色
      while (decodedColors.length < 6) {
        decodedColors.push(require('../../utils/color-extractor').getDefaultColors(1)[0]);
      }
      
      // 只取前6个颜色
      decodedColors = decodedColors.slice(0, 6);

      const journal = decodeURIComponent(options.journal || '');
      const year = decodeURIComponent(options.year || '');
      const volume = decodeURIComponent(options.volume || '');
      const issue = decodeURIComponent(options.issue || '');
      const pages = decodeURIComponent(options.pages || '');
      const title = decodeURIComponent(options.title || '');
      const doi = decodeURIComponent(options.doi || '');
      
      // 构建引用格式
      const citation = `${title}. (${year}). ${journal}. ${volume}(${issue}):${pages}. DOI: ${doi}`;
      
      this.setData({
        image: {
          id: options.id,
          url: decodeURIComponent(options.url || ''),
          title: title,
          journal: journal,
          year: year,
          volume: volume,
          issue: issue,
          pages: pages,
          doi: doi,
          keywords: decodedKeywords,
          colors: decodedColors,
          isLiked: options.isLiked === 'true',
          citation: citation
        },
        journalName: journal,
        year: year,
        volume: volume,
        issue: issue,
        page: pages,
        citation: citation
      });

      console.log('设置后的图片数据:', this.data.image);
    } catch (error) {
      console.error('解析参数错误:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
    }
  },

  previewImage: function() {
    const url = this.data.image.url;
    console.log('预览图片URL:', url);

    wx.showLoading({
      title: '加载中...'
    });

    // 先下载图片
    wx.downloadFile({
      url: url,
      success: (downloadRes) => {
        if (downloadRes.statusCode !== 200) {
          wx.hideLoading();
          wx.showToast({
            title: '图片加载失败',
            icon: 'none'
          });
          return;
        }

        // 获取下载后的图片信息
        wx.getImageInfo({
          src: downloadRes.tempFilePath,
          success: (res) => {
            console.log('原始图片信息:', res);
            
            // 创建canvas用于压缩图片
            const ctx = wx.createCanvasContext('compressCanvas');
            
            // 设置更小的最大尺寸
            const maxSize = 800; // 进一步降低最大尺寸
            let targetWidth = res.width;
            let targetHeight = res.height;
            
            // 计算压缩比例
            const ratio = Math.min(maxSize / targetWidth, maxSize / targetHeight);
            if (ratio < 1) {
              targetWidth = Math.floor(targetWidth * ratio);
              targetHeight = Math.floor(targetHeight * ratio);
            }
            
            console.log('压缩后尺寸:', { width: targetWidth, height: targetHeight });
            
            // 分步压缩处理
            const compress = (quality = 0.5, attempt = 1) => {
              console.log(`开始第${attempt}次压缩，质量:${quality}`);
              
              // 绘制图片到canvas
              ctx.drawImage(downloadRes.tempFilePath, 0, 0, targetWidth, targetHeight);
              ctx.draw(false, () => {
                // 将canvas内容导出为图片
                wx.canvasToTempFilePath({
                  canvasId: 'compressCanvas',
                  x: 0,
                  y: 0,
                  width: targetWidth,
                  height: targetHeight,
                  quality: quality,
                  destWidth: targetWidth,
                  destHeight: targetHeight,
                  fileType: 'jpg',
                  success: (result) => {
                    // 获取压缩后的文件大小
                    wx.getFileInfo({
                      filePath: result.tempFilePath,
                      success: (fileInfo) => {
                        const sizeInMB = fileInfo.size / 1024 / 1024;
                        console.log(`压缩后文件大小: ${sizeInMB}MB`);
                        
                        if (sizeInMB > 1.8 && attempt < 3) {
                          // 如果文件仍然过大且尝试次数小于3次，继续压缩
                          const newQuality = quality * 0.7;
                          const newWidth = Math.floor(targetWidth * 0.8);
                          const newHeight = Math.floor(targetHeight * 0.8);
                          targetWidth = newWidth;
                          targetHeight = newHeight;
                          compress(newQuality, attempt + 1);
                        } else {
                          wx.hideLoading();
                          // 预览压缩后的图片
                          wx.previewImage({
                            current: result.tempFilePath,
                            urls: [result.tempFilePath],
                            success: () => {
                              console.log('预览成功');
                            },
                            fail: (err) => {
                              console.error('预览失败:', err);
                              wx.showToast({
                                title: '预览失败',
                                icon: 'none'
                              });
                            }
                          });
                        }
                      },
                      fail: (err) => {
                        wx.hideLoading();
                        console.error('获取文件信息失败:', err);
                        // 即使获取文件信息失败，也尝试预览
                        wx.previewImage({
                          current: result.tempFilePath,
                          urls: [result.tempFilePath]
                        });
                      }
                    });
                  },
                  fail: (err) => {
                    wx.hideLoading();
                    console.error('图片压缩失败:', err);
                    wx.showToast({
                      title: '图片处理失败',
                      icon: 'none'
                    });
                  }
                });
              });
            };
            
            // 开始压缩流程
            compress();
          },
          fail: (err) => {
            wx.hideLoading();
            console.error('获取图片信息失败:', err);
            wx.showToast({
              title: '获取图片信息失败',
              icon: 'none'
            });
          }
        });
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('下载图片失败:', err);
        wx.showToast({
          title: '图片加载失败',
          icon: 'none'
        });
      }
    });
  },

  copyDOI() {
    wx.setClipboardData({
      data: this.data.image.doi,
      success: () => {
        wx.showToast({
          title: 'DOI已复制',
          icon: 'success'
        });
      }
    });
  },

  onLike() {
    const isLiked = !this.data.image.isLiked;
    this.setData({
      'image.isLiked': isLiked
    });
    
    wx.showToast({
      title: isLiked ? '已收藏' : '已取消收藏',
      icon: 'success'
    });
  },

  onDownload() {
    wx.showActionSheet({
      itemList: ['下载压缩图', '下载原始高清图'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 下载压缩图
          this.downloadCompressedImage();
        } else if (res.tapIndex === 1) {
          // 下载原始高清图
          this.downloadOriginalImage();
        }
      },
      fail: (error) => {
        console.error('显示操作菜单失败:', error);
      }
    });
  },

  // 下载压缩图
  downloadCompressedImage() {
    wx.showLoading({
      title: '下载压缩图...'
    });

    const tempPath = `${wx.env.USER_DATA_PATH}/temp_${Date.now()}.jpg`;
    
    wx.getFileSystemManager().copyFile({
      srcPath: this.data.image.fullPath,
      destPath: tempPath,
      success: (res) => {
        wx.saveImageToPhotosAlbum({
          filePath: tempPath,
          success: () => {
            wx.showToast({
              title: '保存成功',
              icon: 'success',
              duration: 2000
            });
            StatisticsManager.recordImageAction(this.data.image.id, this.data.image.journal, 'download_compressed');
            
            wx.getFileSystemManager().unlink({
              filePath: tempPath,
              fail: (error) => {
                console.error('清理临时文件失败:', error);
              }
            });
          },
          fail: (error) => {
            console.error('保存到相册失败:', error);
            wx.showToast({
              title: '保存失败',
              icon: 'error',
              duration: 2000
            });
          }
        });
      },
      fail: (error) => {
        console.error('复制文件失败:', error);
        wx.showToast({
          title: '保存失败',
          icon: 'error',
          duration: 2000
        });
      },
      complete: () => {
        setTimeout(() => {
          wx.hideLoading();
        }, 500);
      }
    });
  },

  // 下载原始高清图
  downloadOriginalImage() {
    wx.showLoading({
      title: '下载原图...'
    });

    wx.downloadFile({
      url: this.data.image.originalUrl,
      success: (res) => {
        if (res.statusCode === 200) {
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              wx.showToast({
                title: '保存成功',
                icon: 'success',
                duration: 2000
              });
              StatisticsManager.recordImageAction(this.data.image.id, this.data.image.journal, 'download_original');
            },
            fail: (error) => {
              console.error('保存到相册失败:', error);
              wx.showToast({
                title: '保存失败',
                icon: 'error',
                duration: 2000
              });
            }
          });
        } else {
          wx.showToast({
            title: '下载失败',
            icon: 'error',
            duration: 2000
          });
        }
      },
      fail: (error) => {
        console.error('下载原图失败:', error);
        wx.showToast({
          title: '下载失败',
          icon: 'error',
          duration: 2000
        });
      },
      complete: () => {
        setTimeout(() => {
          wx.hideLoading();
        }, 500);
      }
    });
  },

  onShare() {
    wx.showActionSheet({
      itemList: ['分享给朋友', '分享到朋友圈'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.showShareMenu({
            withShareTicket: true,
            menus: ['shareAppMessage']
          });
        } else if (res.tapIndex === 1) {
          wx.showShareMenu({
            withShareTicket: true,
            menus: ['shareTimeline']
          });
        }
      }
    });
  },

  onShareAppMessage() {
    return {
      title: this.data.image.title,
      path: `/pages/detail/detail?id=${this.data.image.id}&url=${encodeURIComponent(this.data.image.url)}&originalUrl=${encodeURIComponent(this.data.image.originalUrl)}`,
      imageUrl: this.data.image.url
    };
  },

  onShareTimeline() {
    return {
      title: this.data.image.title,
      query: `id=${this.data.image.id}&url=${encodeURIComponent(this.data.image.url)}&originalUrl=${encodeURIComponent(this.data.image.originalUrl)}`,
      imageUrl: this.data.image.url
    };
  },

  copyCitation() {
    wx.setClipboardData({
      data: this.data.image.citation,
      success: () => {
        wx.showToast({
          title: '引用已复制',
          icon: 'success'
        });
      }
    });
  },

  onColorTap(e) {
    const color = e.currentTarget.dataset.color;
    if (!color || color.isPlaceholder) return;
    
    const formats = [
      { name: 'HEX', value: color.hex },
      { name: 'RGB', value: color.rgb },
      { name: 'HSL', value: color.hsl },
      { name: 'CMYK', value: `cmyk(${color.cmyk.c}%, ${color.cmyk.m}%, ${color.cmyk.y}%, ${color.cmyk.k}%)` }
    ];

    wx.showActionSheet({
      itemList: formats.map(f => `复制${f.name}格式`),
      success: (res) => {
        const selectedFormat = formats[res.tapIndex];
        wx.setClipboardData({
          data: selectedFormat.value,
          success: () => {
            wx.showToast({
              title: `已复制${selectedFormat.name}格式`,
              icon: 'success'
            });
          }
        });
      }
    });
  },

  // 处理图片长按菜单事件
  handleImageLongTap: function(e) {
    const itemList = ['发送给朋友', '保存图片', '收藏'];
    wx.showActionSheet({
      itemList: itemList,
      success: (res) => {
        switch (res.tapIndex) {
          case 0: // 发送给朋友
            this.onShare();
            break;
          case 1: // 保存图片
            this.onDownload();
            break;
          case 2: // 收藏
            this.onLike();
            break;
        }
      }
    });
  }
}); 