const fs = require('fs');
const Koa = require('koa');
const route = require('koa-route');
const app = new Koa();

const about = ctx=>{
    ctx.response.type = 'html';
    ctx.response.body ='<a href="/">Index page</a>'
}
const main = ctx=>{
    ctx.response.body ='hello world';
}

app.use(route.get('/',main));
app.use(route.get('/about',about));

app.use(main);
app.listen(3000);