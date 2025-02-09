class ImageManager {
  constructor() {
    this.COMPRESS_OPTIONS = {
      maxSize: 800,
      quality: 0.6,
      fileType: 'jpg',
      maxFileSize: 1.8 * 1024 * 1024  // 1.8MB，留出一些余量
    };
    this.SMALL_IMAGE_DIR = '/images/small/';
    this.MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
    this.init();
  }

  // 初始化
  async init() {
    try {
      await this.ensureDirectoryExists();
      await this.cleanupCache();
    } catch (error) {
      console.error('初始化图片管理器失败:', error);
    }
  }

  // 确保目录存在
  async ensureDirectoryExists() {
    const dirPath = `${wx.env.USER_DATA_PATH}${this.SMALL_IMAGE_DIR}`;
    try {
      await new Promise((resolve, reject) => {
        wx.getFileSystemManager().access({
          path: dirPath,
          success: resolve,
          fail: () => {
            // 目录不存在,创建它
            wx.getFileSystemManager().mkdir({
              dirPath: dirPath,
              recursive: true,
              success: resolve,
              fail: reject
            });
          }
        });
      });
      console.log('small目录已就绪');
    } catch (error) {
      console.error('创建small目录失败:', error);
      throw error;
    }
  }

  // 清理缓存
  async cleanupCache() {
    try {
      const dirPath = `${wx.env.USER_DATA_PATH}${this.SMALL_IMAGE_DIR}`;
      const files = await new Promise((resolve, reject) => {
        wx.getFileSystemManager().readdir({
          dirPath: dirPath,
          success: (res) => resolve(res.files),
          fail: reject
        });
      });

      let totalSize = 0;
      const fileInfos = [];

      // 获取所有文件信息
      for (const file of files) {
        const filePath = `${dirPath}/${file}`;
        try {
          const stats = await new Promise((resolve, reject) => {
            wx.getFileSystemManager().stat({
              path: filePath,
              success: (res) => resolve(res.stats),
              fail: reject
            });
          });

          totalSize += stats.size;
          fileInfos.push({
            path: filePath,
            name: file,
            size: stats.size,
            createTime: stats.createTime
          });
        } catch (error) {
          console.error(`获取文件信息失败: ${file}`, error);
        }
      }

      // 如果总大小超过限制,删除最旧的文件
      if (totalSize > this.MAX_CACHE_SIZE) {
        // 按创建时间排序
        fileInfos.sort((a, b) => a.createTime - b.createTime);

        // 删除文件直到总大小小于限制
        while (totalSize > this.MAX_CACHE_SIZE && fileInfos.length > 0) {
          const fileToDelete = fileInfos.shift();
          try {
            await new Promise((resolve, reject) => {
              wx.getFileSystemManager().unlink({
                filePath: fileToDelete.path,
                success: resolve,
                fail: reject
              });
            });
            totalSize -= fileToDelete.size;
            console.log(`删除缓存文件: ${fileToDelete.name}`);
          } catch (error) {
            console.error(`删除文件失败: ${fileToDelete.name}`, error);
          }
        }
      }

      console.log(`缓存清理完成,当前大小: ${totalSize / 1024 / 1024}MB`);
    } catch (error) {
      console.error('清理缓存失败:', error);
    }
  }

  // 压缩图片
  compressImage(tempFilePath) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: tempFilePath,
        success: async (res) => {
          console.log('原始图片信息:', res);
          
          const compress = async (quality = 0.6, scale = 1.0, attempt = 1) => {
            const ctx = wx.createCanvasContext('compressCanvas');
            
            let targetWidth = res.width * scale;
            let targetHeight = res.height * scale;
            
            // 计算压缩比例
            const ratio = Math.min(
              this.COMPRESS_OPTIONS.maxSize / targetWidth, 
              this.COMPRESS_OPTIONS.maxSize / targetHeight
            );
            
            if (ratio < 1) {
              targetWidth = Math.floor(targetWidth * ratio);
              targetHeight = Math.floor(targetHeight * ratio);
            }
            
            console.log(`压缩尝试 #${attempt} - 尺寸:`, { width: targetWidth, height: targetHeight, quality, scale });
            
            try {
              // 绘制图片到canvas
              ctx.drawImage(tempFilePath, 0, 0, targetWidth, targetHeight);
              const drawResult = await new Promise((resolveD, rejectD) => {
                ctx.draw(false, () => resolveD());
              });
              
              // 导出压缩后的图片
              const exportResult = await new Promise((resolveE, rejectE) => {
                wx.canvasToTempFilePath({
                  canvasId: 'compressCanvas',
                  x: 0,
                  y: 0,
                  width: targetWidth,
                  height: targetHeight,
                  quality: quality,
                  destWidth: targetWidth,
                  destHeight: targetHeight,
                  fileType: this.COMPRESS_OPTIONS.fileType,
                  success: resolveE,
                  fail: rejectE
                });
              });
              
              // 检查文件大小
              const fileInfo = await new Promise((resolveF, rejectF) => {
                wx.getFileInfo({
                  filePath: exportResult.tempFilePath,
                  success: resolveF,
                  fail: rejectF
                });
              });
              
              console.log(`压缩后文件大小: ${fileInfo.size / 1024}KB`);
              
              if (fileInfo.size > this.COMPRESS_OPTIONS.maxFileSize) {
                if (attempt < 3) {
                  // 如果文件仍然过大，继续压缩
                  const newQuality = quality * 0.7;
                  const newScale = scale * 0.8;
                  return compress(newQuality, newScale, attempt + 1);
                } else {
                  throw new Error('无法将图片压缩到目标大小');
                }
              }
              
              resolve(exportResult);
            } catch (error) {
              if (attempt < 3) {
                // 如果处理失败，尝试用更低的参数重试
                const newQuality = quality * 0.7;
                const newScale = scale * 0.8;
                return compress(newQuality, newScale, attempt + 1);
              } else {
                reject(error);
              }
            }
          };
          
          // 开始压缩流程
          try {
            await compress();
          } catch (error) {
            reject(error);
          }
        },
        fail: reject
      });
    });
  }

  // 保存图片到small目录
  saveToSmallDir(tempFilePath, fileName) {
    return new Promise((resolve, reject) => {
      const targetPath = `${wx.env.USER_DATA_PATH}${this.SMALL_IMAGE_DIR}${fileName}`;
      
      wx.saveFile({
        tempFilePath: tempFilePath,
        filePath: targetPath,
        success: resolve,
        fail: reject
      });
    });
  }

  // 获取small目录中的图片
  getSmallImage(fileName) {
    return `${this.SMALL_IMAGE_DIR}${fileName}`;
  }

  // 检查图片是否存在于small目录
  checkImageExists(fileName) {
    return new Promise((resolve, reject) => {
      const filePath = `${wx.env.USER_DATA_PATH}${this.SMALL_IMAGE_DIR}${fileName}`;
      wx.getFileSystemManager().getFileInfo({
        filePath: filePath,
        success: () => resolve(true),
        fail: () => resolve(false)
      });
    });
  }

  // 处理新图片(下载、压缩、保存)
  async processNewImage(url) {
    try {
      // 下载原始图片
      const downloadRes = await new Promise((resolve, reject) => {
        wx.downloadFile({
          url: url,
          success: resolve,
          fail: reject
        });
      });

      if (downloadRes.statusCode !== 200) {
        throw new Error('下载图片失败');
      }

      // 压缩图片
      const compressRes = await this.compressImage(downloadRes.tempFilePath);
      
      // 生成文件名
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
      
      // 保存到small目录
      await this.saveToSmallDir(compressRes.tempFilePath, fileName);
      
      return this.getSmallImage(fileName);
    } catch (error) {
      console.error('处理图片失败:', error);
      throw error;
    }
  }
}

const imageManager = new ImageManager();
module.exports = imageManager; 