const isGeneratorFunction = require('is-generator-function');
const debug = require('debug')('koa:application');
const onFinished = require('on-finished');
const response = require('./response');
const compose = require('koa-compose');
const isJSON = require('koa-is-json');
const context = require('./context');
const request = require('./request');
const statuses = require('statuses');
const Cookies = require('cookies');
const accepts = require('accepts');
const Emitter = require('events');
const assert = require('assert');
const Stream = require('stream');
const http = require('http');
const only = require('only');
const convert = require('koa-convert');
const deprecate = require('depd')('koa');
//头部的引入模块 前面的文章有所描述

/**
 * Expose `Application` class.
 * Inherits from `Emitter.prototype`.
 */
// appliaction继承了nodejs 的Events模块
module.exports = class Application extends Emitter {
  /**
   * Initialize a new `Application`.
   *
   * @api public
   */
  // 初始化
  constructor() {
    super();
    
    this.proxy = false;
    this.middleware = [];
    this.subdomainOffset = 2;
    // 这个很常见，区分开发还是线上模式
    this.env = process.env.NODE_ENV || 'development';
    //前面几篇讲过的文件
    this.context = Object.create(context);
    this.request = Object.create(request);
    this.response = Object.create(response);
  }

  /**
   * Shorthand for:
   *
   *    http.createServer(app.callback()).listen(...)
   *
   * @param {Mixed} ...
   * @return {Server}
   * @api public
   */
  // 这块的用了个小细节。
  // http.createServer(app.callback()).listen(...)
  // 其实就是上面这个的形式
  listen(...args) {
    debug('listen');
    //callback是个很主要的点。
    const server = http.createServer(this.callback());
    return server.listen(...args);
  }

  /**
   * Return JSON representation.
   * We only bother showing settings.
   *
   * @return {Object}
   * @api public
   */

  toJSON() {
    return only(this, [
      'subdomainOffset',
      'proxy',
      'env'
    ]);
  }

  /**
   * Inspect implementation.
   *
   * @return {Object}
   * @api public
   */

  inspect() {
    return this.toJSON();
  }

  /**
   * Use the given middleware `fn`.
   *
   * Old-style middleware will be converted.
   *
   * @param {Function} fn
   * @return {Application} self
   * @api public
   */
  // 我们使用koa的时候.
  // var koa = require('koa')();
  // koa.use(async function(context,next){})
  // 这样子就相当于是一个简单的中间件了。
  use(fn) {
    // 判断传入类型 需要是函数
    if (typeof fn !== 'function') throw new TypeError('middleware must be a function!');
    // 如果是generator函数的话，那么我们应该使用conver转化一下。
    // 上一篇我的文章就有提到这个库。这里不提了
    if (isGeneratorFunction(fn)) {
      deprecate('Support for generators will be removed in v3. ' +
                'See the documentation for examples of how to convert old middleware ' +
                'https://github.com/koajs/koa/blob/master/docs/migration.md');
      fn = convert(fn);
    }
    debug('use %s', fn._name || fn.name || '-');
    //在this.middleware压入这个函数
    // 这里请联想一下koa-compose是传入什么的。
    this.middleware.push(fn);
    // 提供链式调用
    return this;
  }

  /**
   * Return a request handler callback
   * for node's native http server.
   *
   * @return {Function}
   * @api public
   */
  // 当callback用在createServer回调内。那么应该是一个function(req,res)的函数
  callback() {
    const fn = compose(this.middleware);
    // 使用compose处理我们的middleware中间件数组
    // 返回一个promise
    if (!this.listeners('error').length) this.on('error', this.onerror);
    
    // 唔 就是这个handleRequest
    const handleRequest = (req, res) => {
      // 默认设置statuscODE
      res.statusCode = 404;
      //  创建的上下文对象
      const ctx = this.createContext(req, res);
      // onerror函数
      const onerror = err => ctx.onerror(err);
      const handleResponse = () => respond(ctx);
      //这个也是说过的啦
      onFinished(res, onerror);
      // compose middlewares数组返回一个promise
      // 因为我们内部有trycatch显式地抛出状态，所以在链上可以catch
      // fn(ctx,undefined);
      return fn(ctx).then(handleResponse).catch(onerror);
    };

    return handleRequest;
  }

  /**
   * Initialize a new context.
   *
   * @api private
   */
  //创建我们中间件用的ctx对象
  createContext(req, res) {
    //下面是一波错综复杂的交替传递引用
    const context = Object.create(this.context);
    const request = context.request = Object.create(this.request);
    const response = context.response = Object.create(this.response);
    // context ---app--->request ---app--->response---app --->this
    //         ---req--->request ---req--->response---req --->req(原生可读流)
    //         ---res--->request ---res--->response---res --->res(原生可写流)
    //                           ---ctx--->response---ctx---->context
    //                           ---response->response
    //                                        response--request--->request
    // 这块注意区分req request res response就可以了  
    context.app = request.app = response.app = this;
    context.req = request.req = response.req = req;
    context.res = request.res = response.res = res;
    request.ctx = response.ctx = context;
    request.response = response;
    response.request = request;
    // 下面是一些属性方便调用吧
    // 而且还记得我们的context.js文件里面有一大堆属性方法的委托吧。那么意味着我们可以直接
    // ctx.body==>ctx.response.body
    context.originalUrl = request.originalUrl = req.url;
    context.cookies = new Cookies(req, res, {
      keys: this.keys,
      secure: request.secure
    });
    request.ip = request.ips[0] || req.socket.remoteAddress || '';
    context.accept = request.accept = accepts(req);
    context.state = {};
    return context;
  }

  /**
   * Default error handler.
   *
   * @param {Error} err
   * @api private
   */
  // 默认错误处理
  onerror(err) {
    assert(err instanceof Error, `non-error thrown: ${err}`);

    if (404 == err.status || err.expose) return;
    if (this.silent) return;

    const msg = err.stack || err.toString();
    console.error();
    console.error(msg.replace(/^/gm, '  '));
    console.error();
  }
};

/**
 * Response helper.
 */
// 可以想成res响应体辅助
function respond(ctx) {
  // allow bypassing koa
  if (false === ctx.respond) return;
    
  const res = ctx.res;
  if (!ctx.writable) return;

  let body = ctx.body;
  const code = ctx.status;

  // ignore body
  if (statuses.empty[code]) {
    // strip headers
    ctx.body = null;
    return res.end();
  }

  if ('HEAD' == ctx.method) {
    if (!res.headersSent && isJSON(body)) {
      ctx.length = Buffer.byteLength(JSON.stringify(body));
    }
    return res.end();
  }

  // status body
  if (null == body) {
    body = ctx.message || String(code);
    if (!res.headersSent) {
      ctx.type = 'text';
      ctx.length = Buffer.byteLength(body);
    }
    return res.end(body);
  }

  // responses
  // 三种处理  buffer 字符串 流
  if (Buffer.isBuffer(body)) return res.end(body);
  if ('string' == typeof body) return res.end(body);
  if (body instanceof Stream) return body.pipe(res);

  // body: json
  // bodyJSON字符串序列化 handle ctx.body是对象
  body = JSON.stringify(body);
  if (!res.headersSent) {
    ctx.length = Buffer.byteLength(body);
  }
  res.end(body);
}