const Koa = require('koa');
const app = new Koa();

//x- response-time
// app.use(async (ctx,next)=>{
//     const start = Date.now();
//     await next();
//     const ms = Date.now()-start;
//     ctx.set('X-Response-Time',`${ms}ms`);
// })

// //logger
// app.use(async (ctx,next)=>{
//     const start = Date.now();
//     await next();
//     const ms = Date.now()- start;
//     console.log(`${ctx.method} ${ctx.url} - ${ms}`);
// })

const main = ctx=>{
    if(ctx.request.accepts('xml')){
        ctx.response.type = 'xml';
        ctx.response.body = '<data>hello world</data>';
    }else if(ctx.request.accepts('json')){
        ctx.response.type = 'json';
        ctx.response.body = {data:'hello World'};
    }else if(ctx.request.accepts('html')){
        ctx.response.type = 'html';
        ctx.response.body ='<p>hello wordl</p>';
    }
}

app.use(main);

app.listen(3000);