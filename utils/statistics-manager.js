function StatisticsManager() {
  this.STORAGE_KEY = 'statistics';
  this.MAX_RECORDS = 1000;
}

StatisticsManager.prototype.recordUserVisit = function(userId) {
  var record = {
    type: 'visit',
    userId: userId,
    timestamp: Date.now()
  };
  this.saveRecord(record);
};

StatisticsManager.prototype.recordImageAction = function(imageId, journal, action) {
  var record = {
    type: 'image_action',
    imageId: imageId,
    journal: journal,
    action: action,
    timestamp: Date.now()
  };
  this.saveRecord(record);
};

StatisticsManager.prototype.saveRecord = function(record) {
  try {
    var records = wx.getStorageSync(this.STORAGE_KEY) || [];
    records.push(record);
    
    // 如果记录数超过最大限制，删除最旧的记录
    if (records.length > this.MAX_RECORDS) {
      records = records.slice(-this.MAX_RECORDS);
    }
    
    wx.setStorageSync(this.STORAGE_KEY, records);
  } catch (error) {
    console.error('保存统计记录失败:', error);
  }
};

StatisticsManager.prototype.getStatistics = function() {
  try {
    var records = wx.getStorageSync(this.STORAGE_KEY) || [];
    var stats = {
      totalVisits: 0,
      totalImageViews: 0,
      totalLikes: 0,
      totalDownloads: 0,
      journalStats: {},
      lastVisit: null
    };
    
    records.forEach(function(record) {
      if (record.type === 'visit') {
        stats.totalVisits++;
        if (!stats.lastVisit || record.timestamp > stats.lastVisit) {
          stats.lastVisit = record.timestamp;
        }
      } else if (record.type === 'image_action') {
        // 更新期刊统计
        if (!stats.journalStats[record.journal]) {
          stats.journalStats[record.journal] = {
            views: 0,
            likes: 0,
            downloads: 0
          };
        }
        
        switch (record.action) {
          case 'view':
            stats.totalImageViews++;
            stats.journalStats[record.journal].views++;
            break;
          case 'like':
            stats.totalLikes++;
            stats.journalStats[record.journal].likes++;
            break;
          case 'download':
            stats.totalDownloads++;
            stats.journalStats[record.journal].downloads++;
            break;
        }
      }
    });
    
    return stats;
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return null;
  }
};

var statisticsManager = new StatisticsManager();
module.exports = statisticsManager; 