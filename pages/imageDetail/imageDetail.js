import { extractColors } from '../../utils/colorExtractor';

Page({
  data: {
    imageUrl: '',
    imageColors: [],
    errorMsg: ''
  },
  
  async onLoad(options) {
    try {
      let imageUrl = options.imageUrl;
      
      if (!imageUrl) {
        throw new Error('未获取到图片URL');
      }
      
      console.log('原始图片URL:', imageUrl);
      
      // 如果是网络图片，需要先下载到本地
      if (imageUrl.startsWith('http')) {
        const res = await wx.downloadFile({
          url: imageUrl
        });
        if (res.statusCode !== 200) {
          throw new Error('下载图片失败');
        }
        imageUrl = res.tempFilePath;
        console.log('下载后的临时路径:', imageUrl);
      }
      
      this.setData({
        imageUrl: imageUrl
      }, async () => {
        try {
          const colors = await extractColors(imageUrl);
          console.log('提取的颜色:', colors);
          
          if (!colors || colors.length === 0) {
            throw new Error('未能提取到颜色');
          }
          
          this.setData({
            imageColors: colors,
            errorMsg: ''
          });
        } catch (error) {
          console.error('提取颜色失败:', error);
          this.setData({
            errorMsg: '提取颜色失败: ' + error.message
          });
        }
      });
    } catch (error) {
      console.error('处理图片失败:', error);
      this.setData({
        errorMsg: '处理图片失败: ' + error.message
      });
    }
  }
}); 