import AdminManager from '../../utils/admin-manager';
import StatisticsManager from '../../utils/statistics-manager';

Page({
  data: {
    isAdmin: false,
    password: '',
    currentSection: '',
    legalHistory: [],
    announcements: [],
    resources: {},
    startDate: '',
    endDate: '',
    stats: null
  },

  onLoad() {
    // 检查是否已经是管理员
    const userId = wx.getStorageSync('userId');
    if (AdminManager.isAdmin(userId)) {
      this.setData({ isAdmin: true });
      this.loadData();
    }

    // 初始化日期范围（最近7天）
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    
    this.setData({
      startDate: this.formatDate(start),
      endDate: this.formatDate(end)
    });
    
    if (this.data.isAdmin) {
      this.loadStats();
    }
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  verifyAdmin() {
    // 实际应用中应该调用服务器验证
    if (this.data.password === 'admin123') {
      this.setData({ isAdmin: true });
      wx.setStorageSync('userId', 'admin1');
      this.loadData();
    } else {
      wx.showToast({
        title: '密码错误',
        icon: 'error'
      });
    }
  },

  loadData() {
    this.setData({
      legalHistory: AdminManager.getLegalHistory(),
      announcements: AdminManager.getAnnouncements(),
      resources: AdminManager.getResources()
    });
  },

  showSection(e) {
    const section = e.currentTarget.dataset.section;
    this.setData({ currentSection: section });
  },

  // ... 其他方法
});