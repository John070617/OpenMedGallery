Component({
  properties: {
    placeholder: {
      type: String,
      value: '搜索'
    }
  },
  
  methods: {
    onInput(e) {
      this.triggerEvent('search', { value: e.detail.value });
    }
  }
}); 