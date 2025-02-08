import StatisticsManager from '../../utils/statistics-manager';
import ColorExtractor from '../../utils/color-extractor';
import ImageManager from '../../utils/image-manager';

Page({
  data: {
    leftImages: [],
    rightImages: [],
    currentJournal: '',
    searchKeyword: '',
    statusBarHeight: 0,
    pageNum: 1,
    pageSize: 8,
    hasMore: true,
    isLoading: false,
    scrollHeight: 0,
    windowHeight: 0,
    totalCount: 0,
    maxImagesPerColumn: 20  // 添加每列最大图片数限制
  },

  onLoad: function() {
    // 获取系统信息
    var windowInfo = wx.getWindowInfo();
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight,
      windowHeight: windowInfo.windowHeight
    });

    // 记录用户访问
    var userId = wx.getStorageSync('userId') || this.generateUserId();
    StatisticsManager.recordUserVisit(userId);

    // 加载第一页数据
    this.loadImages();
  },

  // 计算需要加载的图片数量
  calculateNeededImages: function() {
    var cardHeight = 400;
    var screenHeight = this.data.windowHeight;
    // 增加初始屏幕高度的倍数，确保首屏加载更多图片
    var minImagesPerColumn = Math.ceil((screenHeight * 2) / cardHeight);
    
    // 确保每列至少显示3张图片，最多6张
    return Math.min(6, Math.max(3, minImagesPerColumn));
  },

  // 加载图片数据
  loadImages: function() {
    if (this.data.isLoading || !this.data.hasMore) return;

    this.setData({ isLoading: true });
    wx.showLoading({ title: '加载中...' });

    // 计算需要加载的图片数量
    var neededImages = this.calculateNeededImages();
    
    // 获取新的图片数据
    this.getPageImages(neededImages)
      .then(function(newImages) {
        if (!newImages || newImages.length === 0) {
          this.setData({ hasMore: false });
          wx.showToast({
            title: '没有更多数据',
            icon: 'none'
          });
          return Promise.reject('no more data');
        }
        
        // 处理图片颜色
        var processImages = newImages.map(function(image) {
          return ColorExtractor.extractColors(image.url, 6, this)
            .then(function(colors) {
              return Object.assign({}, image, { colors: colors });
            })
            .catch(function(error) {
              console.error('提取颜色失败:', error);
              return Object.assign({}, image, { 
                colors: ColorExtractor.getDefaultColors(6)
              });
            });
        }.bind(this));

        return Promise.all(processImages);
      }.bind(this))
      .then(function(processedImages) {
        if (!processedImages) return;

        // 更新左右两列数据
        var leftImages = this.data.leftImages;
        var rightImages = this.data.rightImages;
        
        processedImages.forEach(function(image) {
          if (this.getTotalHeight(leftImages) <= this.getTotalHeight(rightImages)) {
            leftImages.push(image);
          } else {
            rightImages.push(image);
          }
        }.bind(this));

        // 限制每列的图片数量
        if (leftImages.length > this.data.maxImagesPerColumn) {
          leftImages = leftImages.slice(-this.data.maxImagesPerColumn);
        }
        if (rightImages.length > this.data.maxImagesPerColumn) {
          rightImages = rightImages.slice(-this.data.maxImagesPerColumn);
        }

        this.setData({
          leftImages: leftImages,
          rightImages: rightImages,
          pageNum: this.data.pageNum + 1,
          hasMore: leftImages.length < this.data.maxImagesPerColumn || rightImages.length < this.data.maxImagesPerColumn,
          totalCount: this.data.totalCount + processedImages.length
        });

        // 如果达到最大限制，显示提示
        if (!this.data.hasMore) {
          wx.showToast({
            title: '已加载最大数量',
            icon: 'none',
            duration: 2000
          });
        }
      }.bind(this))
      .catch(function(error) {
        if (error !== 'no more data') {
          console.error('加载图片失败:', error);
        }
      }.bind(this))
      .finally(function() {
        this.setData({ isLoading: false });
        wx.hideLoading();
      }.bind(this));
  },

  // 获取指定页码的图片数据
  getPageImages: async function(count) {
    var totalCount = this.data.totalCount;
    var images = [];
    
    // 限制最大加载数量
    count = Math.min(count, this.data.maxImagesPerColumn * 2 - (this.data.leftImages.length + this.data.rightImages.length));
    if (count <= 0) {
      return Promise.resolve([]);
    }
    
    for (var i = 0; i < count; i++) {
      var currentIndex = totalCount + i;
      // 使用small目录中的测试图片（1-6）
      var imageIndex = (currentIndex % 6) + 1;  // 修改为6张图片循环
      var journalIndex = currentIndex % this.journals.length;
      var typeIndex = currentIndex % this.imageTypes.length;
      
      // 生成默认颜色
      var defaultColors = [
        { hex: '#4285F4', rgb: 'rgb(66, 133, 244)', hsl: 'hsl(217, 89%, 61%)', cmyk: { c: 73, m: 45, y: 0, k: 4 } },
        { hex: '#EA4335', rgb: 'rgb(234, 67, 53)', hsl: 'hsl(4, 81%, 56%)', cmyk: { c: 0, m: 71, y: 77, k: 8 } }
      ];

      try {
        // 直接使用small目录中的图片
        const fileName = `test${imageIndex}.jpg`;
        // 修改为使用相对路径
        const imageUrl = `/images/small/${fileName}`;
        // 获取完整的文件系统路径用于预览和下载
        const fullPath = `${wx.env.USER_DATA_PATH}/images/small/${fileName}`;
        // 添加原始URL
        const originalUrl = `https://example.com/original/test${imageIndex}.jpg`;  // 需要替换为实际的原始图片URL
        
        // 确保至少有4个关键词
        let keywords = [...this.imageTypes[typeIndex].keywords];
        if (keywords.length < 4) {
          // 如果关键词不够，从其他类型中补充
          const otherKeywords = this.imageTypes
            .filter((_, idx) => idx !== typeIndex)
            .flatMap(type => type.keywords)
            .filter(kw => !keywords.includes(kw));
          
          // 随机选择补充关键词
          while (keywords.length < 4 && otherKeywords.length > 0) {
            const randomIndex = Math.floor(Math.random() * otherKeywords.length);
            keywords.push(otherKeywords.splice(randomIndex, 1)[0]);
          }
        }
        // 如果关键词超过5个，只保留前5个
        keywords = keywords.slice(0, 5);
        
        var imageData = {
          id: 'img_' + currentIndex,
          url: imageUrl,
          fullPath: fullPath,  // 添加完整路径
          originalUrl: originalUrl,  // 添加原始URL
          title: this.imageTypes[typeIndex].type + (Math.floor(currentIndex / this.imageTypes.length) + 1),
          journal: this.journals[journalIndex].name,
          year: '2023',
          volume: this.journals[journalIndex].volume,
          issue: this.journals[journalIndex].issue,
          pages: (100 + currentIndex * 10) + '-' + (110 + currentIndex * 10),
          doi: '10.1038/xxx-xxx-' + currentIndex,
          keywords: keywords,
          isLiked: false,
          colors: defaultColors
        };
        
        images.push(imageData);
      } catch (error) {
        console.error('创建图片数据失败:', error);
      }
    }
    
    return Promise.resolve(images);
  },

  // 期刊数据
  journals: [
    { name: 'Nature Medicine', volume: '29', issue: '5' },
    { name: 'Cell', volume: '186', issue: '4' },
    { name: 'Science', volume: '380', issue: '6642' },
    { name: 'Lancet', volume: '401', issue: '10375' },
    { name: 'JAMA', volume: '329', issue: '8' },
    { name: 'New England Journal of Medicine', volume: '388', issue: '12' },
    { name: 'British Medical Journal', volume: '380', issue: '8' },
    { name: 'Nature Biotechnology', volume: '41', issue: '3' }
  ],

  // 图片类型数据
  imageTypes: [
    { 
      type: '肺部CT扫描图像',
      keywords: ['CT扫描', '肺部影像', '医学成像', '胸部影像']
    },
    { 
      type: '脑部MRI图像',
      keywords: ['MRI', '神经影像', '脑部成像', '神经系统']
    },
    { 
      type: '心脏超声图像',
      keywords: ['超声', '心脏影像', '心血管', '超声诊断']
    },
    { 
      type: '骨骼X光图像',
      keywords: ['X光', '骨科影像', '骨骼系统', '放射诊断']
    },
    { 
      type: '眼底检查图像',
      keywords: ['眼科', '眼底检查', '视网膜', '眼科影像']
    },
    { 
      type: '皮肤病变图像',
      keywords: ['皮肤科', '病变', '皮肤影像', '皮肤诊断']
    },
    { 
      type: '内窥镜检查图像',
      keywords: ['内窥镜', '消化系统', '内镜检查', '微创诊断']
    }
  ],

  // 计算列的总高度（用于决定新图片应该放在哪一列）
  getTotalHeight: function(images) {
    return images.length * 400; // 400是图片容器的固定高度
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    console.log('触发下拉刷新');
    this.setData({
      leftImages: [],
      rightImages: [],
      pageNum: 1,
      hasMore: true,
      isLoading: false,
      totalCount: 0
    }, () => {
      this.loadImages().then(() => {
        wx.stopPullDownRefresh();
      }).catch(() => {
        wx.stopPullDownRefresh();
      });
    });
  },

  // 触底加载更多
  onReachBottom: function() {
    console.log('触发触底加载');
    if (this.data.isLoading || !this.data.hasMore) {
      if (!this.data.hasMore) {
        wx.showToast({
          title: '已加载最大数量',
          icon: 'none',
          duration: 2000
        });
      }
      return;
    }
    this.loadImages();
  },

  // 监听页面滚动
  onPageScroll: function(e) {
    if (this.data.isLoading) return;
    
    var scrollTop = e.scrollTop;
    var windowHeight = this.data.windowHeight;
    var bottomDistance = this.data.scrollHeight - (scrollTop + windowHeight);
    
    if (bottomDistance <= 300) { // 当距离底部300px时加载更多
      this.onReachBottom();
    }
  },

  // 获取页面高度
  onShow: function() {
    var query = wx.createSelectorQuery();
    query.select('.container').boundingClientRect();
    query.exec((res) => {
      if (res && res[0]) {
        this.setData({
          scrollHeight: res[0].height
        });
      }
    });
  },

  generateUserId: function() {
    var userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    wx.setStorageSync('userId', userId);
    return userId;
  },

  onSearch: function(e) {
    var keyword = e.detail.value.toLowerCase();
    this.setData({ 
      searchKeyword: keyword,
      leftImages: [],
      rightImages: [],
      pageNum: 1,
      hasMore: true
    });
    this.loadImages();
  },

  onImageTap: function(e) {
    var id = e.currentTarget.dataset.id;
    var allImages = this.data.leftImages.concat(this.data.rightImages);
    var image = allImages.find(function(img) { return img.id === id; });
    
    if (!image) {
      console.error('找不到图片数据:', id);
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
      return;
    }

    StatisticsManager.recordImageAction(id, image.journal, 'view');
    
    var params = {
      id: image.id,
      url: encodeURIComponent(image.url),
      title: encodeURIComponent(image.title),
      journal: encodeURIComponent(image.journal),
      year: encodeURIComponent(image.year),
      volume: encodeURIComponent(image.volume),
      issue: encodeURIComponent(image.issue),
      pages: encodeURIComponent(image.pages),
      doi: encodeURIComponent(image.doi),
      keywords: encodeURIComponent(JSON.stringify(image.keywords || [])),
      colors: encodeURIComponent(JSON.stringify(image.colors || [])),
      isLiked: image.isLiked
    };

    var query = Object.keys(params)
      .map(function(key) { return key + '=' + params[key]; })
      .join('&');

    wx.navigateTo({
      url: '/pages/detail/detail?' + query
    });
  },

  onLikeTap: function(e) {
    var id = e.detail.id;
    // 在所有图片中查找并更新收藏状态
    var allImages = this.data.leftImages.concat(this.data.rightImages);
    var imageIndex = allImages.findIndex(function(img) { return img.id === id; });
    
    if (imageIndex !== -1) {
      var image = allImages[imageIndex];
      var isLiked = !image.isLiked;
      
      // 更新图片的收藏状态
      if (imageIndex < this.data.leftImages.length) {
        // 图片在左列
        var key = `leftImages[${imageIndex}].isLiked`;
        this.setData({
          [key]: isLiked
        });
      } else {
        // 图片在右列
        var rightIndex = imageIndex - this.data.leftImages.length;
        var key = `rightImages[${rightIndex}].isLiked`;
        this.setData({
          [key]: isLiked
        });
      }
      
      // 记录操作
      StatisticsManager.recordImageAction(id, image.journal, 'like');
      
      wx.showToast({
        title: isLiked ? '收藏成功' : '取消收藏',
        icon: 'success'
      });
    }
  },

  onDownloadTap: function(e) {
    var id = e.detail.id;
    var allImages = this.data.leftImages.concat(this.data.rightImages);
    var image = allImages.find(function(img) { return img.id === id; });
    
    if (image) {
      wx.showActionSheet({
        itemList: ['下载压缩图', '下载原始高清图'],
        success: (res) => {
          if (res.tapIndex === 0) {
            // 下载压缩图
            this.downloadCompressedImage(image);
          } else if (res.tapIndex === 1) {
            // 下载原始高清图
            this.downloadOriginalImage(image);
          }
        },
        fail: (error) => {
          console.error('显示操作菜单失败:', error);
        }
      });
    }
  },

  // 下载压缩图
  downloadCompressedImage: function(image) {
    wx.showLoading({
      title: '下载压缩图...'
    });

    const tempPath = `${wx.env.USER_DATA_PATH}/temp_${Date.now()}.jpg`;
    
    wx.getFileSystemManager().copyFile({
      srcPath: image.fullPath,
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
            StatisticsManager.recordImageAction(image.id, image.journal, 'download_compressed');
            
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
  downloadOriginalImage: function(image) {
    wx.showLoading({
      title: '下载原图...'
    });

    wx.downloadFile({
      url: image.originalUrl,
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
              StatisticsManager.recordImageAction(image.id, image.journal, 'download_original');
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

  // 分享到聊天
  onShareAppMessage: function(res) {
    if (res.from === 'button') {
      // 来自页面内分享按钮
      const image = res.target.dataset.image;
      return {
        title: image.title,
        path: `/pages/detail/detail?id=${image.id}&url=${encodeURIComponent(image.url)}`,
        imageUrl: image.url
      };
    }
    // 来自右上角分享菜单
    return {
      title: 'OpenMedGallery - 医学影像图片库',
      path: '/pages/index/index'
    };
  },

  // 分享到朋友圈
  onShareTimeline: function() {
    return {
      title: 'OpenMedGallery - 医学影像图片库',
      query: '',
      imageUrl: '/images/share-cover.jpg'  // 需要添加一个分享封面图
    };
  },

  onShare: function() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline'],
      success: function() {
        console.log('显示分享菜单成功');
      },
      fail: function(error) {
        console.error('显示分享菜单失败:', error);
      }
    });
  },
}); 