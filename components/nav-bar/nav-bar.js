Component({
  properties: {
    title: {
      type: String,
      value: 'OpenMedGallery'
    },
    showBack: {
      type: Boolean,
      value: true
    }
  },

  data: {
    statusBarHeight: 0
  },

  lifetimes: {
    attached() {
      const windowInfo = wx.getWindowInfo();
      this.setData({
        statusBarHeight: windowInfo.statusBarHeight
      });
    }
  },
  
  methods: {
    onBack() {
      if (this.data.showBack) {
        wx.navigateBack({
          delta: 1
        });
      }
    }
  }
}); 