/**
 * 为每个页面提供mixin，page invoke桥接
 */

const isArray = v => Array.isArray(v);
const isFunction = v => typeof v === 'function';
const noop = function () { };

// 借鉴redux https://github.com/reactjs/redux
function compose(...funcs) {
  if (funcs.length === 0) {
    return arg => arg;
  }

  if (funcs.length === 1) {
    return funcs[0];
  }

  const last = funcs[funcs.length - 1];
  const rest = funcs.slice(0, -1);
  return (...args) => {
    return rest.reduceRight((composed, f) => f(composed), last(...args))
  };
}

/**
 * 方法存在返回值
 * @param  {...any} funcs 
 */
function composeCatch(...funcs) {
  if (funcs.length === 0) {
    return arg => arg;
  }
  if (funcs.length === 1) {
    return funcs[0];
  }
  // const last = funcs[funcs.length - 1];
  // const rest = funcs.slice(0, -1);
  return (...args) => {
    let s;
    let k = {};
    for (let index = funcs.length - 1; index >= 0; index--) {
      const item = funcs[index];
      if(isFunction(item)) {
        k = item(...args);
        if(k !== undefined) {
          s = k;
        }
      }
    }
    return s;
  };
}


// 页面堆栈
// const pagesStack = getApp().$pagesStack;

const PAGE_EVENT = ['onLoad', 'onReady', 'onShow', 'onHide', 'onUnload', 'onPullDownRefresh', 'onReachBottom', 'onShareAppMessage'];
const APP_EVENT = ['onLaunch', 'onShow', 'onHide', 'onError'];

const onLoad = function (opts) {
  // 把pageModel放入页面堆栈
  //  pagesStack.addPage(this);

  //   this.$invoke = (pagePath, methodName, ...args) => {
  //     pagesStack.invoke(pagePath, methodName, ...args);
  //   };

  this.onBeforeLoad(opts);
  this.onNativeLoad(opts);
  this.onAfterLoad(opts);
};

const getMixinData = (mixins, type = 'data') => {
  let ret = {};
  mixins.forEach(mixin => {
    let data = mixin[type] || {};
    Object.keys(data).forEach(key => {
      ret[key] = data[key];
    });
  });
  return ret;
};

const getMixinMethods = mixins => {
  let ret = {};

  mixins.forEach(mixin => {
    let { methods = {} } = mixin;

    // 提取methods
    Object.keys(methods).forEach(key => {
      if (isFunction(methods[key])) {
        // mixin中的onLoad方法会被丢弃
        if (key === 'onLoad') return;

        ret[key] = methods[key];
      }
    });

    // 提取lifecycle
    PAGE_EVENT.forEach(key => {
      if (isFunction(mixin[key]) && key !== 'onLoad') {
        if (ret[key]) {
          // 多个mixin有相同lifecycle时，将方法转为数组存储
          ret[key] = ret[key].concat(mixin[key]);
        } else {
          ret[key] = [mixin[key]];
        }
      }
    })
  });

  return ret;
};

const getMixinDataAuto = (mixins, type = 'dataBinder') => {
  let ret = {};
  mixins.forEach(mixin => {
    let data = mixin[type] || {};
    Object.keys(data).forEach(key => {
      if (ret[key]) {
        ret[key] = ret[key].concat(data[key]);
      } else {
        ret[key] = [data[key]];
      }
    });
  });
  return ret;
}


const mixMethodsAuto = (mixinMethods, pageConf) => {
  Object.keys(mixinMethods).forEach(key => {
    let methodsList = mixinMethods[key];
    if (pageConf[key]) {
      methodsList.push(pageConf[key]);
    }
    pageConf[key] = (function () {
      return function (...args) {
        // 合并为一次 一次插入
        // dataBinder: {
        //   videoplay$vid: "vid"
        //   videoplay$vid: "mixinvid"
        // }
        let strs = methodsList.filter(item =>  typeof item == 'string');
        let funcs = methodsList.filter(item =>  typeof item == 'function');
        return composeCatch(...[strs,...funcs].reverse().map(f => {
          if(isFunction(f)) {
            return f.bind(this)
          } else {
            // dataBinder 绑定合并
            return (v) => {
              let s = {};
              f.forEach(it=> {
                s[it] = v
              })
              // 绑定合并 一次插入
              this.setData(s);
            }
          }
        }))(...args);
      };
    })();
  });

  return pageConf;
};
  

/**
 * 重复冲突处理借鉴vue:
 * data, methods会合并，组件自身具有最高优先级，其次mixins中后配置的mixin优先级较高
 * lifecycle不会合并。先顺序执行mixins中的lifecycle，再执行组件自身的lifecycle
 */

const mixData = (minxinData, nativeData) => {
  Object.keys(minxinData).forEach(key => {
    // page中定义的data不会被覆盖    
    if (nativeData[key] === undefined) {
      nativeData[key] = minxinData[key];
    }
  });

  return nativeData;
};

const mixMethods = (mixinMethods, pageConf) => {
  Object.keys(mixinMethods).forEach(key => {
    // lifecycle方法
    if (PAGE_EVENT.includes(key)) {
      let methodsList = mixinMethods[key];

      if (isFunction(pageConf[key])) {
        methodsList.push(pageConf[key]);
      }

      pageConf[key] = (function () {
        return function (...args) {
          if(key != 'onShareAppMessage') {
            compose(...methodsList.reverse().map(f => f.bind(this)))(...args);
          } else {
            return composeCatch(...methodsList.reverse().map(f => f.bind(this)))(...args);
          }
        };
      })();
    }

    // 普通方法
    else {
      if (pageConf[key] == null) {
        pageConf[key] = mixinMethods[key];
      }
    }
  });

  return pageConf;
};

export default pageConf => {

  let {
    mixins = [],
    onBeforeLoad = noop,
    onAfterLoad = noop
  } = pageConf;

  let onNativeLoad = pageConf.onLoad || noop;
  let nativeData = pageConf.data || {};

  let minxinData = getMixinData(mixins, 'data');
  let mixinMethods = getMixinMethods(mixins);

  Object.assign(pageConf, {
    data: mixData(minxinData, nativeData),
    onLoad,
    onBeforeLoad,
    onAfterLoad,
    onNativeLoad,
  });


  pageConf = mixMethods(mixinMethods, pageConf);

  // 提供方法跨 mixins 调用
  pageConf.__callMixinMethod = function(method, ...arg) {
    if( isFunction(this[method]) ) {
      this[method](...arg);
    } else {
      console.warn(`${method} 在当前Page上没有定义，请检查`);
    }
  }

  return Page(pageConf);
};