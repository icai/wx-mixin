const isFunction = v => typeof v === 'function';
const getMixinMethods = mixins => {
  let ret = {};

  mixins.forEach(mixin => {
    let { methods = {} } = mixin;
    // 提取methods
    Object.keys(methods).forEach(key => {
      if (isFunction(methods[key])) {
        ret[key] = methods[key];
      }
    });
  });

  return ret;
};

// 简单复制
const mixMethods = (mixinMethods, pageConf) => {
  pageConf.methods = pageConf.methods || {};
  Object.keys(mixinMethods).forEach(key => {
    if (pageConf.methods[key] == null) {
      pageConf.methods[key] = mixinMethods[key];
    }
  });
  return pageConf;
};

export default pageConf => {
  let {
    mixins = []
  } = pageConf;
  let mixinMethods = getMixinMethods(mixins);
  pageConf = mixMethods(mixinMethods, pageConf);
  return Component(pageConf);
};