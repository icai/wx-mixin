import createPage from './../../utils/createPage';
import duplicate from './../../mixins/duplicate';

createPage({
  mixins: [duplicate],
  openDetail() {
    wx.navigateTo({
      url: '/pages/detail/detail'
    });
  }
});